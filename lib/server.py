#!/usr/bin/env python3
"""Chinna V6 — Dashboard Server (Python stdlib only, zero deps)."""
import base64, hashlib, http.server, json, os, plistlib, re, secrets, shutil, subprocess, sys, tempfile, threading, time, traceback, unicodedata, urllib.parse, urllib.request
from datetime import datetime, timezone

CHINNA_VERSION = "6.0.0"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7777
CHINNA_HOME = os.environ.get('CHINNA_HOME', os.path.expanduser('~/.chinna'))
DASHBOARD_DIR = os.path.join(CHINNA_HOME, 'dashboard')
HOME = os.path.expanduser('~')
API_KEYS_FILE = os.path.join(CHINNA_HOME, 'api_keys.json')
PAIR_STATE_FILE = os.path.join(CHINNA_HOME, 'telegram_pair.json')
CHAT_DB_FILE = os.path.join(CHINNA_HOME, 'state/chat_db.json')

# Shared TURN fallback for first-run users. Override via env if needed.
DEFAULT_TURN_URLS = os.environ.get(
    'CHINNA_DEFAULT_TURN_URLS',
    'turn:openrelay.metered.ca:80?transport=udp, turns:openrelay.metered.ca:443?transport=tcp'
)
DEFAULT_TURN_USERNAME = os.environ.get('CHINNA_DEFAULT_TURN_USERNAME', 'openrelayproject')
DEFAULT_TURN_CREDENTIAL = os.environ.get('CHINNA_DEFAULT_TURN_CREDENTIAL', 'openrelayproject')
os.makedirs(DASHBOARD_DIR, exist_ok=True)

stats_cache = {}
cache_lock = threading.Lock()
jobs = {}
jobs_lock = threading.Lock()
chat_lock = threading.Lock()

def sh(cmd, timeout=20):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, timeout=timeout).decode(errors='replace').strip()
    except Exception:
        return ''

def shq(value):
    return "'{}'".format(str(value).replace("'", "'\\''"))

def safe_text(value, keep_newlines=False):
    if value is None:
        return ''
    text = unicodedata.normalize('NFKC', str(value)).replace('\u2028', ' ').replace('\u2029', ' ')
    out = []
    for ch in text:
        if ch == '\n' and keep_newlines:
            out.append(ch)
        elif ch in '\r\t':
            out.append(' ')
        elif ch.isprintable():
            out.append(ch)
        else:
            out.append(' ')
    cleaned = ''.join(out)
    return re.sub(r'[ \t]+', ' ', cleaned).strip() if not keep_newlines else '\n'.join(re.sub(r'[ \t]+', ' ', line).strip() for line in cleaned.splitlines()).strip()

def read_json(path, default=None):
    try:
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
    except Exception:
        pass
    return default if default is not None else {}

def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

def _chat_default():
    return {'users': {}, 'messages': [], 'last_id': 0}

def load_chat_db():
    data = read_json(CHAT_DB_FILE, _chat_default())
    if not isinstance(data, dict):
        return _chat_default()
    data.setdefault('users', {})
    data.setdefault('messages', [])
    data.setdefault('last_id', 0)
    return data

def save_chat_db(data):
    write_json(CHAT_DB_FILE, data)

def safe_id(value):
    return re.sub(r'[^a-zA-Z0-9_.-]', '', str(value or ''))[:64]

def build_icns_from_svg(svg_path, icns_path):
    if not os.path.exists(svg_path):
        return False, 'icon asset missing'
    if not shutil.which('qlmanage') or not shutil.which('sips') or not shutil.which('iconutil'):
        return False, 'macOS icon tools unavailable'
    try:
        with tempfile.TemporaryDirectory(prefix='chinna-icon-') as tmp:
            subprocess.run(['qlmanage', '-t', '-s', '1024', '-o', tmp, svg_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            previews = [os.path.join(tmp, name) for name in os.listdir(tmp) if name.endswith('.png')]
            if not previews:
                return False, 'failed to rasterize icon asset'
            src = previews[0]
            iconset = os.path.join(tmp, 'Chinna.iconset')
            os.makedirs(iconset, exist_ok=True)
            for size, name in [
                (16, 'icon_16x16.png'),
                (32, 'icon_16x16@2x.png'),
                (32, 'icon_32x32.png'),
                (64, 'icon_32x32@2x.png'),
                (128, 'icon_128x128.png'),
                (256, 'icon_128x128@2x.png'),
                (256, 'icon_256x256.png'),
                (512, 'icon_256x256@2x.png'),
                (512, 'icon_512x512.png'),
            ]:
                subprocess.run(['sips', '-z', str(size), str(size), src, '--out', os.path.join(iconset, name)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            shutil.copy2(src, os.path.join(iconset, 'icon_512x512@2x.png'))
            subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', icns_path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True, ''
    except Exception as e:
        return False, safe_text(str(e))

def style_mac_app_bundle(app_path):
    info_path = os.path.join(app_path, 'Contents', 'Info.plist')
    if not os.path.exists(info_path):
        return False, 'Info.plist missing'
    try:
        with open(info_path, 'rb') as f:
            info = plistlib.load(f)
        info['CFBundleDisplayName'] = 'Chinna'
        info['CFBundleName'] = 'Chinna'
        info['CFBundleIdentifier'] = 'com.pichimail.chinna'
        info['CFBundleIconFile'] = 'applet'
        info['CFBundleShortVersionString'] = CHINNA_VERSION
        info['CFBundleVersion'] = CHINNA_VERSION
        info['LSApplicationCategoryType'] = 'public.app-category.productivity'
        info['LSMinimumSystemVersion'] = '13.0'
        with open(info_path, 'wb') as f:
            plistlib.dump(info, f)
        return True, ''
    except Exception as e:
        return False, safe_text(str(e))

def read_shell_config():
    cfg = {}
    path = os.path.join(CHINNA_HOME, 'config')
    if not os.path.exists(path):
        return cfg
    try:
        with open(path) as f:
            for line in f:
                m = re.match(r"export\s+([A-Z0-9_]+)=['\"]?(.*?)['\"]?$", line.strip())
                if m:
                    cfg[m.group(1)] = m.group(2)
    except Exception:
        pass
    return cfg

def load_keys():
    keys = read_json(API_KEYS_FILE, {})
    shell_cfg = read_shell_config()
    for name in (
        'OPENROUTER_API_KEY',
        'OPENAI_API_KEY',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID',
        'TURN_ENABLED',
        'TURN_URLS',
        'TURN_USERNAME',
        'TURN_CREDENTIAL',
    ):
        if not keys.get(name) and shell_cfg.get(name):
            keys[name] = shell_cfg[name]
        if not keys.get(name) and os.environ.get(name):
            keys[name] = os.environ[name]

    # Ensure voice/video calling has TURN fallback for all users by default.
    if not keys.get('TURN_URLS') and DEFAULT_TURN_URLS:
        keys['TURN_URLS'] = DEFAULT_TURN_URLS
    if not keys.get('TURN_USERNAME') and DEFAULT_TURN_USERNAME:
        keys['TURN_USERNAME'] = DEFAULT_TURN_USERNAME
    if not keys.get('TURN_CREDENTIAL') and DEFAULT_TURN_CREDENTIAL:
        keys['TURN_CREDENTIAL'] = DEFAULT_TURN_CREDENTIAL
    if not keys.get('TURN_ENABLED') and keys.get('TURN_URLS'):
        keys['TURN_ENABLED'] = '1'
    return keys

def save_keys(d):
    cur = load_keys(); cur.update(d)
    write_json(API_KEYS_FILE, cur)

def generate_turn_credentials():
    uname = 'chinna-' + secrets.token_hex(4)
    cred = secrets.token_urlsafe(24)
    return uname, cred

def save_pair_state(state):
    write_json(PAIR_STATE_FILE, state)

def load_pair_state():
    return read_json(PAIR_STATE_FILE, {})

def new_job():
    jid = hashlib.md5(str(time.time()).encode()).hexdigest()[:10]
    with jobs_lock:
        jobs[jid] = {'lines': [], 'done': False, 'ok': True, 'started': time.time()}
    return jid

def job_log(jid, line):
    with jobs_lock:
        if jid in jobs: jobs[jid]['lines'].append(line)

def job_done(jid, ok=True):
    with jobs_lock:
        if jid in jobs:
            jobs[jid]['done'] = True; jobs[jid]['ok'] = ok

def collect_stats():
    s = {}
    s['home'] = HOME
    df = sh("df -h /System/Volumes/Data 2>/dev/null || df -h /")
    ln = df.split('\n')
    if len(ln) > 1:
        p = ln[1].split()
        s['disk'] = {'total': p[1] if len(p)>1 else '?', 'used': p[2] if len(p)>2 else '?',
                     'free': p[3] if len(p)>3 else '?', 'pct': int(p[4].rstrip('%')) if len(p)>4 and p[4].rstrip('%').isdigit() else 0}
    ncpu = int(sh("sysctl -n hw.ncpu") or 8)
    cpu_raw = sh("ps -A -o %cpu | awk '{s+=$1}END{printf \"%.0f\",s}'")
    try: cpu = min(100, round(float(cpu_raw)/ncpu))
    except: cpu = 0
    s['cpu'] = {'pct': cpu, 'cores': ncpu}
    vm = sh("vm_stat"); page = 16384
    def vpg(k):
        m = re.search(rf'{k}[^0-9]*(\d+)', vm); return int(m.group(1))*page if m else 0
    active = vpg('Pages active'); wired = vpg('Pages wired down'); comp = vpg('Pages occupied by compressor')
    tot = int(sh("sysctl -n hw.memsize") or 17179869184); used = active+wired+comp
    s['memory'] = {'total': round(tot/1073741824,1), 'used': round(used/1073741824,1),
                   'free': round((tot-used)/1073741824,1), 'pct': min(100, round(used/tot*100)) if tot else 0}
    bat = sh("pmset -g batt"); m = re.search(r'(\d+)%;', bat)
    s['battery'] = {'pct': int(m.group(1)) if m else 0, 'charging': 'AC Power' in bat}
    ip = sh("ipconfig getifaddr en0") or sh("ipconfig getifaddr en1") or 'offline'
    s['network'] = {'ip': ip, 'status': 'connected' if ip!='offline' else 'offline'}
    s['os'] = {'hostname': sh("hostname -s") or 'Mac', 'version': sh("sw_vers -productVersion"),
               'arch': sh("uname -m"), 'chip': sh("sysctl -n machdep.cpu.brand_string")}
    bt = sh("sysctl -n kern.boottime | awk -F'[{,]' '{print $2}' | tr -d ' '")
    try:
        secs = int(time.time())-int(bt); d,r = divmod(secs,86400); h,r = divmod(r,3600); mn = r//60
        s['uptime'] = f"{d}d {h}h" if d else (f"{h}h {mn}m" if h else f"{mn}m")
    except: s['uptime'] = '—'
    ps = sh("ps aux"); procs = []
    for line in ps.split('\n')[1:]:
        c = line.split(None,10)
        if len(c)>=11:
            try: procs.append({'pid': int(c[1]), 'cpu': float(c[2]), 'mem': float(c[3]), 'name': c[10][:80]})
            except: pass
    procs.sort(key=lambda x:x['mem'], reverse=True)
    s['processes'] = procs[:40]
    try:
        s['disk_breakdown'] = storage_breakdown(HOME, limit=6, offset=0).get('items', [])
    except Exception:
        s['disk_breakdown'] = []
    return s

def stats_loop():
    while True:
        try:
            d = collect_stats()
            with cache_lock: stats_cache.update(d)
        except: pass
        time.sleep(2)

KIND = {'pdf':'PDF','mp4':'Video','mov':'Video','mkv':'Video','mp3':'Audio','m4a':'Audio','wav':'Audio',
        'zip':'Archive','tar':'Archive','gz':'Archive','dmg':'Disk Image','iso':'Disk Image','app':'App',
        'pkg':'Installer','js':'Code','py':'Code','ts':'Code','jsx':'Code','tsx':'Code','json':'Data',
        'csv':'Data','jpg':'Image','jpeg':'Image','png':'Image','gif':'Image','webp':'Image','heic':'Image',
        'doc':'Doc','docx':'Doc','xls':'Sheet','xlsx':'Sheet','ppt':'Slides','pptx':'Slides','txt':'Text','md':'Text'}

def fsize(n):
    return f"{n/1073741824:.2f} GB" if n>1073741824 else f"{n/1048576:.1f} MB" if n>1048576 else f"{n/1024:.0f} KB"

def path_size_bytes(path, timeout=10):
    p = os.path.expanduser(path or '')
    if not p or not os.path.exists(p):
        return 0
    out = sh(f"du -sk {shq(p)} 2>/dev/null | awk '{{print $1}}'", timeout)
    return int(out) * 1024 if out.strip().isdigit() else 0

def disk_df_bytes():
    out = sh("df -k /System/Volumes/Data 2>/dev/null | awk 'NR==2{print $2, $3, $4}'")
    if not out:
        out = sh("df -k / 2>/dev/null | awk 'NR==2{print $2, $3, $4}'")
    p = out.split()
    if len(p) >= 3 and all(x.isdigit() for x in p[:3]):
        total = int(p[0]) * 1024
        used = int(p[1]) * 1024
        free = int(p[2]) * 1024
        return total, used, free
    return 0, 0, 0

def parse_last_used_epoch(app_path):
    raw = sh(f"mdls -name kMDItemLastUsedDate -raw {shq(app_path)} 2>/dev/null")
    txt = raw.strip()
    if not txt or txt == '(null)':
        return 0
    try:
        return int(datetime.strptime(txt, '%Y-%m-%d %H:%M:%S %z').timestamp())
    except Exception:
        return 0

def list_installed_apps(limit=400):
    apps = []
    for base in ['/Applications', os.path.expanduser('~/Applications')]:
        if not os.path.isdir(base):
            continue
        try:
            for n in sorted(os.listdir(base)):
                if not n.endswith('.app'):
                    continue
                fp = os.path.join(base, n)
                szb = path_size_bytes(fp, timeout=6)
                apps.append({
                    'name': n[:-4],
                    'path': fp,
                    'size': fsize(szb),
                    'size_bytes': szb,
                    'last_used_epoch': parse_last_used_epoch(fp)
                })
        except Exception:
            pass
    apps.sort(key=lambda x: x.get('size_bytes', 0), reverse=True)
    return apps[:max(1, int(limit or 400))]

def deep_clean_catalog(include_unused_apps=True):
    now = int(time.time())
    targets = []

    def add_target(tid, label, size_bytes, commands, kind='cache', scope='system', path='', default_selected=True, extra=None, requires_force=False):
        targets.append({
            'id': tid,
            'label': label,
            'size_bytes': max(0, int(size_bytes or 0)),
            'size': fsize(max(0, int(size_bytes or 0))),
            'commands': commands or [],
            'kind': kind,
            'scope': scope,
            'path': path,
            'default_selected': bool(default_selected),
            'requires_force': bool(requires_force),
            'extra': extra or {}
        })

    add_target(
        'system_temp',
        'System temp folders (/private/var/folders)',
        0,
        [
            "sudo rm -rf /private/var/folders/*/T/* 2>/dev/null || true",
            "sudo rm -rf /private/var/folders/*/C/* 2>/dev/null || true"
        ],
        kind='system_temp', scope='system', path='/private/var/folders', default_selected=False, requires_force=True,
        extra={'risk': 'System-level temp cleanup; force recommended only when disk pressure is severe.'}
    )
    add_target('user_caches', 'User caches', path_size_bytes('~/Library/Caches', 8), ["rm -rf ~/Library/Caches/* 2>/dev/null || true"], path='~/Library/Caches')
    add_target('system_caches', 'System caches', path_size_bytes('/Library/Caches', 8), ["sudo rm -rf /Library/Caches/* 2>/dev/null || true"], scope='system', path='/Library/Caches', default_selected=False, requires_force=True, extra={'risk': 'May remove caches used by installed tools until rebuilt.'})
    add_target('trash', 'Trash', path_size_bytes('~/.Trash', 8), ["rm -rf ~/.Trash/* 2>/dev/null || true", "osascript -e 'tell application \"Finder\" to empty trash' 2>/dev/null || true"], kind='trash', path='~/.Trash')

    add_target('xcode_derived', 'Xcode DerivedData', path_size_bytes('~/Library/Developer/Xcode/DerivedData', 8), ["rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true"], kind='dev', path='~/Library/Developer/Xcode/DerivedData')
    add_target('xcode_archives', 'Xcode Archives', path_size_bytes('~/Library/Developer/Xcode/Archives', 8), ["rm -rf ~/Library/Developer/Xcode/Archives/* 2>/dev/null || true"], kind='dev', path='~/Library/Developer/Xcode/Archives')
    add_target('xcode_devicesupport', 'Xcode DeviceSupport', path_size_bytes('~/Library/Developer/Xcode/iOS DeviceSupport', 8), ["rm -rf ~/Library/Developer/Xcode/iOS\\ DeviceSupport/* 2>/dev/null || true"], kind='dev', path='~/Library/Developer/Xcode/iOS DeviceSupport')
    add_target('simulator_caches', 'CoreSimulator caches', path_size_bytes('~/Library/Developer/CoreSimulator/Caches', 8), ["rm -rf ~/Library/Developer/CoreSimulator/Caches/* 2>/dev/null || true", "xcrun simctl delete unavailable 2>/dev/null || true"], kind='dev', path='~/Library/Developer/CoreSimulator/Caches')

    add_target('npm_cache', 'npm cache', path_size_bytes('~/.npm', 7), ["npm cache clean --force 2>/dev/null || true"], kind='package', path='~/.npm')
    add_target('pnpm_store', 'pnpm store', path_size_bytes('~/Library/pnpm/store', 7), ["pnpm store prune 2>/dev/null || true"], kind='package', path='~/Library/pnpm/store')
    add_target('yarn_cache', 'yarn cache', path_size_bytes('~/Library/Caches/Yarn', 7), ["yarn cache clean 2>/dev/null || true"], kind='package', path='~/Library/Caches/Yarn')
    add_target('bun_cache', 'bun cache', path_size_bytes('~/.bun/install/cache', 7), ["rm -rf ~/.bun/install/cache 2>/dev/null || true"], kind='package', path='~/.bun/install/cache')
    add_target('pip_cache', 'pip cache', path_size_bytes('~/.cache/pip', 7) + path_size_bytes('~/Library/Caches/pip', 7), ["rm -rf ~/.cache/pip ~/Library/Caches/pip 2>/dev/null || true"], kind='package', path='~/.cache/pip')
    add_target('gradle_cache', 'Gradle cache', path_size_bytes('~/.gradle/caches', 7), ["rm -rf ~/.gradle/caches ~/.gradle/daemon ~/.gradle/wrapper/dists 2>/dev/null || true"], kind='package', path='~/.gradle')
    brew_cache_dir = sh('brew --cache 2>/dev/null')
    add_target('brew_cache', 'Homebrew cache', path_size_bytes(brew_cache_dir, 7) if brew_cache_dir else 0, ["brew cleanup -s --prune=all 2>/dev/null || true"], kind='package', path=brew_cache_dir or 'brew cache')

    docker_est = path_size_bytes('~/Library/Containers/com.docker.docker', 8) + path_size_bytes('~/Library/Group Containers/group.com.docker', 8)
    add_target('docker_data', 'Docker data (images/volumes/cache)', docker_est, ["docker system prune -af --volumes 2>/dev/null || true", "rm -rf ~/Library/Containers/com.docker.docker/Data/vms/* 2>/dev/null || true"], kind='docker', path='~/Library/Containers/com.docker.docker', default_selected=False, requires_force=True, extra={'risk': 'Removes images/volumes and can disrupt running containers.'})

    add_target('logs_crash', 'Logs and crash reports', path_size_bytes('~/Library/Logs', 8) + path_size_bytes('~/Library/Logs/DiagnosticReports', 8), ["rm -rf ~/Library/Logs/* 2>/dev/null || true", "rm -rf ~/Library/Logs/DiagnosticReports/* 2>/dev/null || true", "sudo rm -rf /Library/Logs/DiagnosticReports/* 2>/dev/null || true"], kind='logs', path='~/Library/Logs')

    add_target('python_cache', 'Python caches (__pycache__, .pytest, .mypy)', 0, ["find ~ -maxdepth 7 -type d \\( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' \\) -prune -exec rm -rf {} + 2>/dev/null || true"], kind='dev', path='~', default_selected=True)
    add_target('old_node_modules', 'Old node_modules (unchanged > 7 days)', 0, ["find ~/Documents ~/Desktop ~/Developer ~/repos ~/code ~/projects ~/Sites ~/dev -maxdepth 6 -type d -name node_modules -print0 2>/dev/null | xargs -0 -I{} sh -c 'p=$(dirname \"{}\"); lm=$(stat -f %m \"$p\" 2>/dev/null || echo 0); cutoff=$(($(date +%s)-604800)); [ \"$lm\" -lt \"$cutoff\" ] && rm -rf \"{}\" 2>/dev/null || true'"], kind='dev', path='~/Documents', default_selected=False)

    add_target('apfs_snapshots', 'APFS local snapshots', 0, ["for snap in $(tmutil listlocalsnapshotdates / 2>/dev/null | grep -E '^[0-9]{4}-'); do sudo tmutil deletelocalsnapshots \"$snap\" >/dev/null 2>&1; done", "sudo diskutil apfs deleteAllSnapshots / >/dev/null 2>&1 || true"], kind='system', scope='system', path='APFS snapshots', default_selected=False, requires_force=True, extra={'risk': 'Removes local restore snapshots.'})
    add_target('purge_ram', 'Purge inactive RAM', 0, ["sudo purge 2>/dev/null || purge 2>/dev/null || true"], kind='memory', scope='system', path='RAM', default_selected=True)

    # Add top heavy cache children for per-folder custom targeting.
    for parent in ['~/Library/Caches', '~/.Trash']:
        p = os.path.expanduser(parent)
        if not os.path.isdir(p):
            continue
        try:
            children = storage_breakdown(p, limit=30, offset=0).get('items', [])
            for child in children[:20]:
                sz = int(child.get('size_bytes') or 0)
                if sz < 200 * 1024 * 1024:
                    continue
                cpath = child.get('path') or ''
                if not cpath:
                    continue
                add_target(
                    'item_' + hashlib.md5(cpath.encode()).hexdigest()[:10],
                    f"Large item: {os.path.basename(cpath)}",
                    sz,
                    [f"rm -rf {shq(cpath)} 2>/dev/null || true"],
                    kind='item',
                    scope='custom',
                    path=cpath,
                    default_selected=False,
                    extra={'parent': parent}
                )
        except Exception:
            pass

    if include_unused_apps:
        stale_days = 90
        cutoff = now - stale_days * 86400
        for app in list_installed_apps(limit=200):
            app_path = app.get('path') or ''
            if not app_path:
                continue
            last_used = int(app.get('last_used_epoch') or 0)
            sz = int(app.get('size_bytes') or 0)
            # Keep this candidate list focused on potentially removable large/unused apps.
            if sz < 500 * 1024 * 1024:
                continue
            if last_used and last_used > cutoff:
                continue
            base = app.get('name') or os.path.basename(app_path).replace('.app', '')
            safe_base = str(base).replace('"', '\\"')
            add_target(
                'app_' + hashlib.md5(app_path.encode()).hexdigest()[:10],
                f"Unused app candidate: {base}",
                sz,
                [
                    f"rm -rf {shq(app_path)} 2>/dev/null || true",
                    f"rm -rf \"$HOME/Library/Application Support/{safe_base}\" \"$HOME/Library/Caches/{safe_base}\" \"$HOME/Library/Logs/{safe_base}\" 2>/dev/null || true"
                ],
                kind='app',
                scope='custom',
                path=app_path,
                default_selected=False,
                extra={
                    'last_used_epoch': last_used,
                    'last_used_days_ago': int((now - last_used) / 86400) if last_used else None
                }
            )

    targets.sort(key=lambda x: x.get('size_bytes', 0), reverse=True)
    return targets

def run_deep_clean_job(jid, selected_ids=None, strict=True, allow_force=False):
    selected_set = set(selected_ids or [])
    catalog = deep_clean_catalog(include_unused_apps=True)
    if selected_set:
        tasks = [x for x in catalog if x.get('id') in selected_set]
    else:
        tasks = [x for x in catalog if x.get('default_selected')]

    if not allow_force:
        blocked = [x for x in tasks if x.get('requires_force')]
        if blocked:
            for item in blocked:
                job_log(jid, f"Skipped (force required): {item.get('label')}")
        tasks = [x for x in tasks if not x.get('requires_force')]

    before_total, before_used, before_free = disk_df_bytes()
    est = sum(int(x.get('size_bytes') or 0) for x in tasks)

    mode = "ON" if allow_force else "OFF"
    job_log(jid, f"Starting strict deep clean with {len(tasks)} selected target(s)... (force mode: {mode})")
    job_log(jid, f"Volume before: total {fsize(before_total)} | used {fsize(before_used)} | free {fsize(before_free)}")
    job_log(jid, f"Estimated reclaim from selection: {fsize(est)}")

    if not tasks:
        job_log(jid, 'No targets selected. Nothing to clean.')
        job_done(jid)
        return

    total = len(tasks)
    for idx, item in enumerate(tasks, 1):
        label = item.get('label', 'target')
        sz = item.get('size', '0 KB')
        job_log(jid, f"[{idx}/{total}] Processing {label} ({sz})")
        for cmd in item.get('commands') or []:
            sh(cmd, 90 if strict else 45)
        job_log(jid, f"  done: {label}")

    after_total, after_used, after_free = disk_df_bytes()
    gained = max(0, after_free - before_free)
    job_log(jid, f"Deep clean complete. Estimated: {fsize(est)} | actual immediate free gain: {fsize(gained)}")
    job_log(jid, f"Volume after: total {fsize(after_total)} | used {fsize(after_used)} | free {fsize(after_free)}")
    job_log(jid, "Note: macOS System Data may recalculate over time. Reboot can reflect final reclaim.")
    job_done(jid)

def entry(fp):
    try:
        st = os.stat(fp); name = os.path.basename(fp)
        ext = os.path.splitext(name)[1].lower().lstrip('.')
        return {'name': name, 'path': fp, 'size': fsize(st.st_size), 'size_bytes': st.st_size,
                'mtime': int(st.st_mtime), 'kind': KIND.get(ext,'File')}
    except: return None

def md5_quick(fp, chunk=65536):
    try:
        sz = os.path.getsize(fp); h = hashlib.md5(); h.update(str(sz).encode())
        with open(fp,'rb') as f:
            h.update(f.read(chunk))
            if sz > chunk*2:
                f.seek(-chunk, 2); h.update(f.read(chunk))
        return h.hexdigest()
    except: return None

def quote_join(paths):
    return ' '.join("'{}'".format(p.replace("'", "'\\''")) for p in paths)

def list_children(path):
    try:
        entries = []
        with os.scandir(path) as it:
            for ent in it:
                if ent.name.startswith('.Trash'):
                    continue
                entries.append(ent)
        entries.sort(key=lambda e: (not e.is_dir(follow_symlinks=False), e.name.lower()))
        return entries
    except Exception:
        return []

def storage_breakdown(path, limit=60, offset=0):
    path = os.path.expanduser(path or HOME)
    if not os.path.exists(path):
        path = HOME
    items = []
    children = list_children(path)
    slice_children = children[offset:offset + max(1, int(limit or 60))]
    for ent in slice_children:
        fp = ent.path
        try:
            st = ent.stat(follow_symlinks=False)
            size_bytes = st.st_size
            if ent.is_dir(follow_symlinks=False):
                size_txt = sh(f"du -sk '{fp}' 2>/dev/null | cut -f1", 4)
                if size_txt.strip().isdigit():
                    size_bytes = int(size_txt.strip()) * 1024
            items.append({
                'path': fp,
                'name': ent.name,
                'size': fsize(size_bytes),
                'size_bytes': size_bytes,
                'is_dir': ent.is_dir(follow_symlinks=False)
            })
        except Exception:
            continue
    return {
        'items': items,
        'path': path,
        'count': len(children),
        'offset': offset,
        'limit': limit,
        'has_more': (offset + len(slice_children)) < len(children),
        'next_offset': offset + len(slice_children)
    }

def file_snippet(path, max_lines=24):
    try:
        if os.path.isdir(path):
            return ''
        if os.path.getsize(path) > 1024 * 64:
            return ''
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return safe_text('\n'.join(f.readlines()[:max_lines]), keep_newlines=True)
    except Exception:
        return ''

def extract_query_tokens(message):
    tokens = []
    for token in re.findall(r"[A-Za-z0-9_.-]{3,}", safe_text(message)):
        lower = token.lower()
        if lower in {
            'what', 'show', 'tell', 'about', 'this', 'that', 'file', 'folder', 'config', 'status', 'disk', 'current',
            'currentstatus', 'local', 'storage', 'context', 'any', 'and', 'the', 'with', 'from', 'into', 'that', 'this',
            'your', 'you', 'please', 'can', 'could', 'would', 'should', 'help', 'me', 'for', 'open', 'find', 'search'
        }:
            continue
        tokens.append(token)
    return tokens[:4]

def current_status_context():
    with cache_lock:
        s = dict(stats_cache)
    keys = load_keys()
    telegram = keys.get('TELEGRAM_BOT_TOKEN')
    pair = load_pair_state()
    return [
        f"Mac status: CPU {s.get('cpu', {}).get('pct', 0)}%, RAM {s.get('memory', {}).get('pct', 0)}%, Disk {s.get('disk', {}).get('pct', 0)}%, Battery {s.get('battery', {}).get('pct', 0)}%, Host {s.get('os', {}).get('hostname', 'Mac')}, IP {s.get('network', {}).get('ip', 'offline')}, Uptime {s.get('uptime', '—')}",
        f"Config: OpenRouter={'yes' if keys.get('OPENROUTER_API_KEY') else 'no'}, OpenAI={'yes' if keys.get('OPENAI_API_KEY') else 'no'}, TelegramBot={'yes' if telegram else 'no'}, TelegramPaired={'yes' if keys.get('TELEGRAM_CHAT_ID') else 'no'}",
        f"Telegram pair: active={'yes' if pair.get('code') else 'no'}, code={pair.get('code', '—') if pair.get('code') else '—'}"
    ]

def local_context_for(prompt, extra_path=None):
    prompt = safe_text(prompt).lower()
    sources = []
    if any(word in prompt for word in ('disk', 'storage', 'ram', 'cpu', 'battery', 'status', 'config', 'current', 'system', 'mac', 'health')):
        sources.extend(current_status_context())
    if any(word in prompt for word in ('storage', 'disk', 'space')) or extra_path:
        target = os.path.expanduser(extra_path or HOME)
        target = target if os.path.exists(target) else HOME
        breakdown = storage_breakdown(target, limit=8, offset=0)
        if breakdown['items']:
            sources.append(f"Storage at {breakdown['path']}: " + '; '.join(f"{item['name']} ({item['size']})" for item in breakdown['items'][:8]))
    if any(word in prompt for word in ('file', 'folder', 'path', 'directory', 'where', 'open', 'contents', 'snippet', 'find', 'search')) or extra_path:
        target = os.path.expanduser(extra_path or HOME)
        target = target if os.path.exists(target) else HOME
        tokens = extract_query_tokens(prompt)
        if tokens:
            for token in tokens[:3]:
                hits = sh(f"find '{HOME}' -maxdepth 6 -iname '*{token}*' -not -path '*/.Trash/*' 2>/dev/null | head -8", 10)
                for hit in [x for x in hits.split('\n') if x.strip()]:
                    if os.path.exists(hit):
                        sources.append(f"Match for '{token}': {hit}")
                        snippet = file_snippet(hit)
                        if snippet:
                            sources.append(f"Snippet from {hit}:\n{snippet}")
                        break
    if not sources:
        sources.extend(current_status_context()[:1])
    return sources[:8]

def build_chat_prompt(message, context):
    safe_message = safe_text(message, keep_newlines=True)
    safe_context = '\n'.join(f"- {safe_text(line, keep_newlines=True)}" for line in context)
    return (
        "You are Chinna, a concise but helpful Mac assistant.\n"
        "Answer directly using the local context below when relevant.\n"
        "If the local context does not contain the answer, say so clearly.\n"
        "Never invent file names, paths, settings, or status values.\n"
        "Use short bullet points when listing facts.\n\n"
        f"Local context:\n{safe_context}\n\n"
        f"User question:\n{safe_message}"
    )

def openrouter_chat(messages, model='meta-llama/llama-3.3-70b-instruct:free', tools=None):
    """Send full messages array (supports history + tool calls). Returns (message_dict or None, model)."""
    key = load_keys().get('OPENROUTER_API_KEY', '')
    if not key:
        return None, 'no_key'
    payload = {
        "model": model,
        "max_tokens": 1100,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    try:
        proc = subprocess.run([
            'curl', '-sS', '--max-time', '55',
            'https://openrouter.ai/api/v1/chat/completions',
            '-H', f'Authorization: Bearer {key}',
            '-H', 'Content-Type: application/json; charset=utf-8',
            '-H', 'HTTP-Referer: https://chinna.local',
            '-H', 'X-Title: Chinna Dashboard',
            '--data-binary', '@-'
        ], input=json.dumps(payload, ensure_ascii=False).encode('utf-8'), capture_output=True)
        if proc.returncode != 0 or not proc.stdout:
            return None, f'curl_failed:{proc.returncode}'
        data = json.loads(proc.stdout.decode('utf-8', errors='replace'))
        msg = data.get('choices', [{}])[0].get('message', {})
        return msg, model
    except Exception as e:
        return None, f'error:{e}'

def openai_chat(messages, model='gpt-4o-mini', tools=None):
    key = load_keys().get('OPENAI_API_KEY', '')
    if not key:
        return None, 'no_key'
    payload = {"model": model, "max_tokens": 900, "messages": messages}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    try:
        proc = subprocess.run([
            'curl', '-sS', '--max-time', '50',
            'https://api.openai.com/v1/chat/completions',
            '-H', f'Authorization: Bearer {key}',
            '-H', 'Content-Type: application/json; charset=utf-8',
            '--data-binary', '@-'
        ], input=json.dumps(payload, ensure_ascii=False).encode('utf-8'), capture_output=True)
        if proc.returncode != 0 or not proc.stdout:
            return None, f'curl_failed:{proc.returncode}'
        data = json.loads(proc.stdout.decode('utf-8', errors='replace'))
        msg = data.get('choices', [{}])[0].get('message', {})
        return msg, model
    except Exception as e:
        return None, f'error:{e}'

def telegram_bot_meta():
    token = load_keys().get('TELEGRAM_BOT_TOKEN', '')
    if not token:
        return {}
    try:
        resp = sh(f"curl -s 'https://api.telegram.org/bot{token}/getMe' 2>/dev/null", 10)
        data = json.loads(resp or '{}')
        if data.get('ok'):
            return data.get('result', {}) or {}
    except Exception:
        pass
    return {}

def telegram_send_message(text):
    keys = load_keys()
    token = keys.get('TELEGRAM_BOT_TOKEN', '')
    chat_id = keys.get('TELEGRAM_CHAT_ID', '')
    if not token or not chat_id:
        return False, 'Telegram is not fully configured'
    payload = urllib.parse.urlencode({'chat_id': chat_id, 'text': safe_text(text, keep_newlines=True)[:3900]}).encode()
    req = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=payload)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            json.loads(resp.read())
        return True, 'sent'
    except Exception as e:
        return False, str(e)

def update_telegram_chat_id(chat_id):
    keys = load_keys()
    keys['TELEGRAM_CHAT_ID'] = str(chat_id)
    save_keys(keys)

def telegram_status():
    keys = load_keys()
    meta = telegram_bot_meta()
    pair = load_pair_state()
    return {
        'configured': bool(keys.get('TELEGRAM_BOT_TOKEN')),
        'paired': bool(keys.get('TELEGRAM_CHAT_ID')),
        'chat_id': keys.get('TELEGRAM_CHAT_ID', ''),
        'bot_username': meta.get('username', ''),
        'bot_name': meta.get('first_name', ''),
        'pair_code': pair.get('code', ''),
        'pair_expires': pair.get('expires', 0),
        'pair_url': pair.get('pair_url', ''),
        'qr_url': pair.get('qr_url', '')
    }

# ═══════════════════════════════════════════════════════════════
# CHINNA AI — Conversation History + Real Dynamic Tools
# ═══════════════════════════════════════════════════════════════

# Rolling conversation history (last N turns). Simple & effective for local single-user tool.
AI_HISTORY = []
AI_HISTORY_LIMIT = 18  # ~9 user + assistant turns

def add_to_history(role, content, tool_calls=None, tool_call_id=None, name=None):
    entry = {"role": role, "content": content or ""}
    if tool_calls: entry["tool_calls"] = tool_calls
    if tool_call_id: entry["tool_call_id"] = tool_call_id
    if name: entry["name"] = name
    AI_HISTORY.append(entry)
    # trim
    while len(AI_HISTORY) > AI_HISTORY_LIMIT:
        AI_HISTORY.pop(0)

def clear_ai_history():
    AI_HISTORY.clear()

# Tool definitions (OpenAI / OpenRouter compatible format)
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_system_status",
            "description": "Get live CPU, RAM, Disk, Battery, uptime and network status of this Mac.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_top_processes",
            "description": "List top memory and CPU consuming processes currently running.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "kill_process",
            "description": "Force kill a process by PID. Use with caution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pid": {"type": "integer", "description": "Process ID to kill"}
                },
                "required": ["pid"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_files",
            "description": "Search for files and folders by name pattern under the user's home.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search term or glob-like pattern"},
                    "limit": {"type": "integer", "description": "Max results (default 12)"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reveal_in_finder",
            "description": "Reveal a file or folder in Finder (equivalent to right-click → Show in Finder).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Absolute path to reveal"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "trash_path",
            "description": "Move a file or folder to Trash safely.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Absolute path to move to trash"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "purge_ram",
            "description": "Run macOS RAM purge (frees inactive memory). May require sudo.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "deep_clean",
            "description": "Trigger deep system clean (user caches, npm, brew, trash, etc.). Returns a job id to track progress.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_disk_usage",
            "description": "Get detailed storage breakdown for a path (defaults to ~).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to analyze (default home)"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file_snippet",
            "description": "Read the beginning of a text file (safe, limited size).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "max_lines": {"type": "integer", "description": "Max lines to read (default 30)"}
                },
                "required": ["path"]
            }
        }
    }
]

# ─── Vision Model Recommendations (OpenRouter) ───────────────────
VISION_MODELS = [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-opus",
    "google/gemini-flash-1.5",
    "qwen/qwen-2-vl-72b-instruct",
    "meta-llama/llama-3.2-90b-vision-instruct",
    "meta-llama/llama-3.2-11b-vision-instruct",
]

def select_best_vision_model(preferred_model, has_images):
    """Auto-select a strong vision model when images are attached."""
    if not has_images:
        return preferred_model

    pref = preferred_model or ""
    # If already a known good vision model, keep it
    if any(v in pref.lower() for v in ["gpt-4o", "claude-3", "gemini", "qwen-2-vl", "llama-3.2", "vision"]):
        return preferred_model

    # Default to a reliable vision model (gpt-4o is excellent on OpenRouter)
    return "openai/gpt-4o"

# ─── Long-term Memory (persisted) ─────────────────────────────────
AI_MEMORY_FILE = os.path.join(CHINNA_HOME, 'ai_memory.json')

def load_memory():
    try:
        if os.path.exists(AI_MEMORY_FILE):
            with open(AI_MEMORY_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception:
        pass
    return []

def save_memory(memories):
    os.makedirs(os.path.dirname(AI_MEMORY_FILE), exist_ok=True)
    with open(AI_MEMORY_FILE, 'w') as f:
        json.dump(memories, f, indent=2, ensure_ascii=False)

def add_memory_fact(fact, category="general", importance=5):
    mem = load_memory()
    entry = {
        "id": hashlib.md5(f"{fact}{time.time()}".encode()).hexdigest()[:10],
        "fact": safe_text(fact),
        "category": safe_text(category or "general"),
        "importance": max(1, min(10, int(importance or 5))),
        "created": int(time.time()),
        "last_used": int(time.time())
    }
    mem.append(entry)
    # keep only last 200 facts
    if len(mem) > 200:
        mem = sorted(mem, key=lambda x: (x.get('importance',5), x.get('last_used',0)), reverse=True)[:200]
    save_memory(mem)
    return entry["id"]

def search_memory(query, limit=8):
    mem = load_memory()
    q = safe_text(query).lower()
    if not q:
        return sorted(mem, key=lambda x: -x.get('importance', 5))[:limit]
    scored = []
    for m in mem:
        text = (m.get('fact','') + ' ' + m.get('category','')).lower()
        score = sum(1 for word in q.split() if word in text)
        if score > 0:
            scored.append((score + m.get('importance',5)*0.3, m))
    scored.sort(reverse=True)
    results = [m for _, m in scored[:limit]]
    # update last_used
    now = int(time.time())
    for m in results:
        m['last_used'] = now
    save_memory(mem)
    return results

def delete_memory(mem_id):
    mem = load_memory()
    mem = [m for m in mem if m.get('id') != mem_id]
    save_memory(mem)
    return True

# ─── File Attachments Processing ──────────────────────────────────
UPLOADS_DIR = os.path.join(CHINNA_HOME, 'uploads')
UPLOADED_FILES_INDEX = os.path.join(CHINNA_HOME, 'uploaded_files.json')
os.makedirs(UPLOADS_DIR, exist_ok=True)

def load_uploaded_files_index():
    try:
        if os.path.exists(UPLOADED_FILES_INDEX):
            with open(UPLOADED_FILES_INDEX) as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}

def save_uploaded_files_index(index):
    os.makedirs(os.path.dirname(UPLOADED_FILES_INDEX), exist_ok=True)
    with open(UPLOADED_FILES_INDEX, 'w') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

def register_uploaded_file(name, mime, size, saved_path):
    """Persistently register an uploaded file so AI can reference it later."""
    index = load_uploaded_files_index()
    file_id = hashlib.md5(f"{name}{saved_path}{time.time()}".encode()).hexdigest()[:12]
    index[file_id] = {
        "id": file_id,
        "name": name,
        "mime": mime,
        "size": size,
        "path": saved_path,
        "uploaded_at": int(time.time())
    }
    save_uploaded_files_index(index)
    return file_id

def process_attachments(attachments):
    """
    attachments: list of {name, mime, size, data_b64}
    Returns list of rich context blocks + vision images ready for model.
    Also registers files persistently.
    """
    results = []
    vision_images = []   # for multi-modal messages
    index = load_uploaded_files_index()

    for att in attachments or []:
        name = safe_text(att.get('name', 'file'))
        mime = att.get('mime', '') or ''
        size = int(att.get('size', 0))
        data_b64 = att.get('data_b64', '')

        # Save file
        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', name)[:80]
        ts = int(time.time())
        saved_path = os.path.join(UPLOADS_DIR, f"{ts}_{safe_name}")
        try:
            if data_b64:
                with open(saved_path, 'wb') as f:
                    f.write(base64.b64decode(data_b64))
        except Exception:
            pass

        # Register persistently
        file_id = register_uploaded_file(name, mime, size, saved_path)

        entry = {
            "id": file_id,
            "name": name,
            "mime": mime,
            "size": size,
            "path": saved_path
        }

        # Text / Code / Logs / JSON / Markdown
        if any(x in mime for x in ['text/', 'application/json', 'application/javascript', 'application/xml']) or \
           name.lower().endswith(('.txt', '.md', '.json', '.py', '.js', '.ts', '.tsx', '.go', '.rs', '.sh', '.log', '.yaml', '.yml', '.toml', '.csv')):
            try:
                with open(saved_path, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read(16000)
                entry["type"] = "text"
                entry["content"] = content
                results.append(entry)
                continue
            except Exception:
                pass

        # Images → prepare for vision
        if mime.startswith('image/') or name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic')):
            entry["type"] = "image"
            if data_b64:
                entry["image_data"] = f"data:{mime};base64,{data_b64}"
                vision_images.append({
                    "type": "image_url",
                    "image_url": {"url": entry["image_data"]}
                })
            results.append(entry)
            continue

        # PDF
        if mime == 'application/pdf' or name.lower().endswith('.pdf'):
            entry["type"] = "pdf"
            txt = sh(f"pdftotext '{saved_path}' - 2>/dev/null | head -200", 12)
            entry["content"] = txt or "(PDF text extraction failed)"
            results.append(entry)
            continue

        # Everything else
        entry["type"] = "binary"
        entry["note"] = "Binary/unknown file. Ask for specific analysis if needed."
        results.append(entry)

    return results, vision_images

# Tool: list previously uploaded files
TOOLS.append({
    "type": "function",
    "function": {
        "name": "list_uploaded_files",
        "description": "List all files the user has previously uploaded to Chinna AI (persistent across sessions).",
        "parameters": {"type": "object", "properties": {}}
    }
})

# Dedicated Error Log Analysis Tool
TOOLS.append({
    "type": "function",
    "function": {
        "name": "analyze_error_log",
        "description": "Specialized tool for deeply analyzing crash logs, build errors, stack traces, console output, or any error logs. Returns structured diagnosis + fix suggestions.",
        "parameters": {
            "type": "object",
            "properties": {
                "log_content": {"type": "string", "description": "The full or partial error log / stack trace / build output"},
                "context": {"type": "string", "description": "Extra context (what the user was doing, OS, language, framework, etc.)"}
            },
            "required": ["log_content"]
        }
    }
})

# ─── Safe Terminal Allowlist ─────────────────────────────────────
SAFE_TERMINAL_ALLOWLIST = {
    'ls', 'pwd', 'whoami', 'date', 'uptime', 'df', 'du', 'free', 'top', 'ps',
    'brew', 'git', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'python3', 'pip3',
    'sw_vers', 'sysctl', 'vm_stat', 'ioreg', 'system_profiler',
    'mdfind', 'mdls', 'find', 'head', 'tail', 'wc', 'cat', 'file', 'stat',
    'ping', 'curl -I', 'dig', 'host', 'scutil'
}

def is_safe_terminal_command(cmd):
    cmd = cmd.strip().lower()
    if any(x in cmd for x in ['rm ', 'sudo ', 'mv ', 'cp ', 'kill ', 'launchctl', 'defaults write', 'chmod', 'chown', '| bash', '| sh', 'curl |', 'wget |', 'eval ', 'exec ', '>', '>>', 'mkfs']):
        return False
    first_word = cmd.split()[0] if cmd.split() else ''
    return first_word in SAFE_TERMINAL_ALLOWLIST or any(cmd.startswith(p) for p in SAFE_TERMINAL_ALLOWLIST)

# ─── Tool Definitions Extension ───────────────────────────────────
TOOLS.append({
    "type": "function",
    "function": {
        "name": "run_terminal_command",
        "description": "Run a SAFE read-only terminal command (ls, git status, brew list, du, find, etc.). Destructive commands are blocked.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The shell command to run (must be safe/read-only)"}
            },
            "required": ["command"]
        }
    }
})

TOOLS.append({
    "type": "function",
    "function": {
        "name": "save_to_memory",
        "description": "Save an important fact, preference, or note about the user/system for long-term recall (persisted in ~/.chinna/ai_memory.json).",
        "parameters": {
            "type": "object",
            "properties": {
                "fact": {"type": "string"},
                "category": {"type": "string", "description": "e.g. preference, project, hardware, habit"},
                "importance": {"type": "integer", "description": "1-10, higher = more important"}
            },
            "required": ["fact"]
        }
    }
})

TOOLS.append({
    "type": "function",
    "function": {
        "name": "search_memory",
        "description": "Search the long-term memory for relevant facts, preferences or past context.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to search for"},
                "limit": {"type": "integer"}
            },
            "required": ["query"]
        }
    }
})

TOOLS.append({
    "type": "function",
    "function": {
        "name": "get_job_status",
        "description": "Check progress of a long-running job (deep clean, uninstall, etc.).",
        "parameters": {
            "type": "object",
            "properties": {
                "job_id": {"type": "string"}
            },
            "required": ["job_id"]
        }
    }
})

def execute_tool(name, args):
    """Execute a tool safely. Returns (result_text, is_long_job)."""
    try:
        if name == "get_system_status":
            with cache_lock:
                s = dict(stats_cache)
            return json.dumps({
                "cpu": s.get("cpu", {}),
                "memory": s.get("memory", {}),
                "disk": s.get("disk", {}),
                "battery": s.get("battery", {}),
                "uptime": s.get("uptime"),
                "os": s.get("os"),
                "network": s.get("network")
            }), False

        elif name == "list_top_processes":
            with cache_lock:
                procs = (dict(stats_cache).get("processes") or [])[:10]
            return json.dumps(procs), False

        elif name == "kill_process":
            pid = args.get("pid")
            if not pid: return "Error: pid required", False
            sh(f"kill -9 {int(pid)} 2>/dev/null || true")
            return f"Sent SIGKILL to PID {pid}", False

        elif name == "find_files":
            q = args.get("query", "").strip()
            lim = int(args.get("limit", 12))
            if not q: return "[]", False
            out = sh(f"find ~ -maxdepth 7 -iname '*{q}*' -not -path '*/.Trash/*' -not -path '*/node_modules/*' 2>/dev/null | head -{lim}", 8)
            hits = [x for x in out.splitlines() if x.strip()]
            return json.dumps(hits), False

        elif name == "reveal_in_finder":
            p = args.get("path", "")
            if p and os.path.exists(os.path.expanduser(p)):
                sh(f"open -R '{os.path.expanduser(p)}'")
                return f"Revealed in Finder: {p}", False
            return "Path not found", False

        elif name == "trash_path":
            p = os.path.expanduser(args.get("path", ""))
            if not p or not os.path.exists(p):
                return "Path does not exist", False
            # Use macOS trash via osascript for safety
            sh(f"osascript -e 'tell app \"Finder\" to delete POSIX file \"{p}\"' 2>/dev/null || rm -rf '{p}'")
            return f"Moved to Trash: {p}", False

        elif name == "purge_ram":
            sh("sudo purge 2>/dev/null || purge 2>/dev/null", 25)
            return "RAM purge completed", False

        elif name == "deep_clean":
            jid = new_job()
            threading.Thread(target=run_deep_clean_job, args=(jid, None, True, False), daemon=True).start()
            return json.dumps({"job_id": jid, "status": "started"}), False

        elif name == "get_disk_usage":
            target = os.path.expanduser(args.get("path") or HOME)
            data = storage_breakdown(target, limit=10, offset=0)
            return json.dumps(data), False

        elif name == "read_file_snippet":
            p = os.path.expanduser(args.get("path", ""))
            maxl = int(args.get("max_lines", 30))
            if not os.path.exists(p): return "File not found", False
            return file_snippet(p, max_lines=maxl) or "(empty or binary)", False

        elif name == "run_terminal_command":
            cmd = (args.get("command") or "").strip()
            if not cmd:
                return "No command provided", False
            if not is_safe_terminal_command(cmd):
                return "Command blocked for safety. Only read-only / informational commands are allowed.", False
            out = sh(cmd, timeout=18)
            return out[:1800] or "(no output)", False

        elif name == "save_to_memory":
            fact = args.get("fact", "")
            if not fact: return "Nothing to remember", False
            mid = add_memory_fact(fact, args.get("category"), args.get("importance"))
            return f"Remembered (id:{mid})", False

        elif name == "search_memory":
            results = search_memory(args.get("query", ""), int(args.get("limit", 8)))
            return json.dumps(results), False

        elif name == "get_job_status":
            jid = args.get("job_id")
            if not jid:
                return "job_id required", False
            with jobs_lock:
                job = jobs.get(jid, {"lines": ["Job not found"], "done": True, "ok": False})
            return json.dumps(job), False

        elif name == "list_uploaded_files":
            index = load_uploaded_files_index()
            # Return recent 30 files
            files = sorted(index.values(), key=lambda x: -x.get("uploaded_at", 0))[:30]
            return json.dumps(files), False

        elif name == "analyze_error_log":
            log = args.get("log_content", "")[:12000]
            ctx = args.get("context", "")
            if not log:
                return "No log content provided", False

            # Structured analysis (the model will still reason, but we give it a strong head start)
            analysis = {
                "summary": "Error log received. Key patterns detected:",
                "length": len(log),
                "likely_type": "unknown",
                "top_lines": log.splitlines()[:8]
            }
            lower = log.lower()
            if any(x in lower for x in ["exception", "traceback", "error:", "fatal"]):
                analysis["likely_type"] = "exception / crash"
            if any(x in lower for x in ["build failed", "compilation error", "syntaxerror", "module not found"]):
                analysis["likely_type"] = "build / compile error"
            if "react" in lower or "next" in lower:
                analysis["framework"] = "React/Next.js likely"
            if "swift" in lower or "xcode" in lower:
                analysis["framework"] = "iOS/Swift"

            return json.dumps({
                "analysis": analysis,
                "full_log_preview": log[:2500],
                "user_context": ctx,
                "instruction": "Now provide a clear diagnosis + step-by-step fix. Be specific."
            }), False

        else:
            return f"Unknown tool: {name}", False
    except Exception as e:
        return f"Tool error: {safe_text(str(e))}", False

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=DASHBOARD_DIR, **k)
    def log_message(self, *a): pass
    def _json(self, d, code=200):
        b = json.dumps(d, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def _bd(self):
        l = int(self.headers.get('Content-Length',0)); return json.loads(self.rfile.read(l)) if l else {}
    def do_OPTIONS(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        p_raw = parsed.path or '/'
        p = p_raw if p_raw == '/' else p_raw.rstrip('/')
        q = dict(urllib.parse.parse_qsl(parsed.query))
        if p == '/favicon.ico':
            favicon_path = os.path.join(DASHBOARD_DIR, 'assets', 'chinna-favicon.svg')
            if os.path.exists(favicon_path):
                with open(favicon_path, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/svg+xml')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_response(204)
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()
            return
        if p == '/api/stats':
            with cache_lock:
                self._json(stats_cache)
        elif p == '/api/job':
            with jobs_lock:
                self._json(jobs.get(q.get('id',''), {'lines':['job not found'],'done':True,'ok':False}))
        elif p == '/api/files':
            self._json(self.get_files(q.get('tab','large'), q.get('sort','size')))
        elif p == '/api/apps':
            self._json({'apps': self.list_apps()})
        elif p == '/api/loginitems':
            self._json({'result': self.login_items()})
        elif p == '/api/batteryhealth':
            self._json(self.battery_health())
        elif p == '/api/storage':
            self._json(storage_breakdown(q.get('path', HOME), limit=int(q.get('limit', '60') or 60), offset=int(q.get('offset', '0') or 0)))
        elif p == '/api/ports':
            self._json({'result': sh("lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $1\"  pid:\"$2\"  \"$9}' | head -30") or 'No listening ports'})
        elif p == '/api/doctor':
            self._json({'result': self.doctor()})
        elif p == '/api/sysreport':
            self._json(self.sys_report())
        elif p == '/api/get_keys':
            k = load_keys()
            turn_enabled = str(k.get('TURN_ENABLED', '')).strip().lower() in ('1', 'true', 'yes', 'on')
            self._json({
                'chinna_ai_set': bool(k.get('OPENROUTER_API_KEY')),
                'openai_set': bool(k.get('OPENAI_API_KEY')),
                'telegram_set': bool(k.get('TELEGRAM_BOT_TOKEN')),
                'telegram_paired': bool(k.get('TELEGRAM_CHAT_ID')),
                'telegram_bot': telegram_status().get('bot_username', ''),
                'pair_code': telegram_status().get('pair_code', ''),
                'turn_enabled': turn_enabled,
                'turn_urls': safe_text(k.get('TURN_URLS', '')),
                'turn_username': safe_text(k.get('TURN_USERNAME', '')),
                'turn_credential': safe_text(k.get('TURN_CREDENTIAL', '')),
                'turn_credential_set': bool(k.get('TURN_CREDENTIAL')),
            })
        elif p == '/api/version':
            self._json({'version': CHINNA_VERSION, 'name': 'Chinna V6'})
        elif p == '/api/check-update':
            self._json(self.check_update())
        elif p == '/api/models':
            self._json(self.list_models())
        elif p == '/api/projects':
            self.serve_projects()
        elif p == '/api/whatsapp/status':
            self._json({'ok': True, 'app': 'WhatsApp', 'web': 'https://web.whatsapp.com'})
        elif p == '/api/telegram/status':
            self._json(telegram_status())
        elif p in ('/api/chat/user', '/chat/api/user'):
            self.chat_get_user(q.get('id', ''))
        elif p in ('/api/chat/poll', '/chat/api/poll'):
            self.chat_poll(q)
        elif p in ('/api/chat/history', '/chat/api/history'):
            self.chat_history(q)
        elif p in ('/',''):
            self.path = '/index.html'; super().do_GET()
        elif p.startswith('/api/'):
            self._json({'error': f'unknown {p}'}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        p_raw = parsed.path or '/'
        p = p_raw if p_raw == '/' else p_raw.rstrip('/')
        q = dict(urllib.parse.parse_qsl(parsed.query))
        b = self._bd()
        if p == '/api/save_keys':
            d = {}
            if b.get('chinna_ai_key'): d['OPENROUTER_API_KEY'] = b['chinna_ai_key']
            if b.get('openai_key'): d['OPENAI_API_KEY'] = b['openai_key']
            if b.get('telegram_token'): d['TELEGRAM_BOT_TOKEN'] = b['telegram_token']
            if b.get('telegram_chat'): d['TELEGRAM_CHAT_ID'] = b['telegram_chat']
            if 'turn_enabled' in b: d['TURN_ENABLED'] = '1' if bool(b.get('turn_enabled')) else '0'
            if b.get('turn_urls') is not None: d['TURN_URLS'] = safe_text(b.get('turn_urls', ''))[:800]
            if b.get('turn_username') is not None: d['TURN_USERNAME'] = safe_text(b.get('turn_username', ''))[:120]
            if b.get('turn_credential') is not None: d['TURN_CREDENTIAL'] = safe_text(b.get('turn_credential', ''))[:200]
            save_keys(d); self._json({'result':'✅ Keys saved'})
        elif p == '/api/turn/generate':
            uname, cred = generate_turn_credentials()
            d = {
                'TURN_ENABLED': '1',
                'TURN_USERNAME': uname,
                'TURN_CREDENTIAL': cred,
            }
            # Optional: allow caller to set URLs while generating credentials.
            if b.get('turn_urls') is not None:
                d['TURN_URLS'] = safe_text(b.get('turn_urls', ''))[:800]
            save_keys(d)
            self._json({
                'ok': True,
                'turn_enabled': True,
                'turn_username': uname,
                'turn_credential': cred,
                'turn_urls': d.get('TURN_URLS', safe_text(load_keys().get('TURN_URLS', ''))),
                'result': '✅ TURN credentials generated'
            })
        elif p == '/api/purge':
            jid = new_job(); threading.Thread(target=self.job_purge, args=(jid,), daemon=True).start(); self._json({'job': jid})
        elif p == '/api/clean':
            jid = new_job(); threading.Thread(target=self.job_clean, args=(jid,), daemon=True).start(); self._json({'job': jid})
        elif p == '/api/clean/scan':
            total, used, free = disk_df_bytes()
            items = deep_clean_catalog(include_unused_apps=True)
            self._json({
                'items': items,
                'volume': {
                    'path': '/System/Volumes/Data',
                    'total_bytes': total,
                    'used_bytes': used,
                    'free_bytes': free,
                    'total': fsize(total),
                    'used': fsize(used),
                    'free': fsize(free)
                },
                'estimated_total_bytes': sum(int(x.get('size_bytes') or 0) for x in items),
                'force_required_ids': [x.get('id') for x in items if x.get('requires_force')],
                'recommended_ids': [x.get('id') for x in items if x.get('default_selected')]
            })
        elif p == '/api/clean/custom':
            selected_ids = b.get('selected_ids') or []
            strict = bool(b.get('strict', True))
            allow_force = bool(b.get('allow_force', False))
            jid = new_job()
            threading.Thread(target=run_deep_clean_job, args=(jid, selected_ids, strict, allow_force), daemon=True).start()
            self._json({'job': jid})
        elif p == '/api/uninstall':
            jid = new_job(); threading.Thread(target=self.job_uninstall, args=(jid, b.get('path',''), b.get('name','')), daemon=True).start(); self._json({'job': jid})
        elif p == '/api/delete-dupes':
            jid = new_job(); threading.Thread(target=self.job_delete, args=(jid, b.get('paths',[])), daemon=True).start(); self._json({'job': jid})
        elif p == '/api/trash':
            fp = b.get('path','')
            if fp and os.path.exists(fp): sh(f"osascript -e 'tell app \"Finder\" to delete POSIX file \"{fp}\"'",10); self._json({'result':'Moved to Trash'})
            else: self._json({'error':'not found'},404)
        elif p == '/api/delete':
            fp = b.get('path','')
            if fp and os.path.exists(fp): sh(f"rm -rf '{fp}'"); self._json({'result':'Deleted'})
            else: self._json({'error':'not found'},404)
        elif p == '/api/reveal':
            fp = b.get('path','')
            if fp and os.path.exists(fp): sh(f"open -R '{fp}'"); self._json({'result':'Revealed'})
            else: self._json({'error':'not found'},404)
        elif p == '/api/kill':
            pid = b.get('pid')
            if pid: sh(f"kill -9 {pid}"); self._json({'result':f'Killed {pid}'})
            else: self._json({'error':'no pid'},400)
        elif p == '/api/chat':
            self.chat(b)
        elif p == '/api/telegram/pair':
            self.telegram_pair(b)
        elif p == '/api/telegram/test':
            ok, msg = telegram_send_message(b.get('message') or '✅ Chinna dashboard test message')
            self._json({'ok': ok, 'result': msg}, 200 if ok else 400)
        elif p == '/api/voice/transcribe':
            self.voice_transcribe(b)
        elif p == '/api/chat/clear':
            clear_ai_history()
            self._json({'ok': True, 'message': 'Conversation memory cleared'})
        elif p in ('/api/chat/register', '/chat/api/register'):
            self.chat_register(b)
        elif p in ('/api/chat/add-contact', '/chat/api/add-contact'):
            self.chat_add_contact(b)
        elif p in ('/api/chat/send', '/chat/api/send'):
            self.chat_send(b)
        elif p == '/api/uploaded-file':
            self.serve_uploaded_file(q.get('id'))
        elif p == '/api/projects':
            self.serve_projects()
        elif p == '/api/project/open-folder':
            self.open_project_folder(q.get('path'))
        elif p == '/api/project/open-url':
            self.open_project_url(q.get('url'))
        elif p == '/api/projects/export':
            self.export_projects(q.get('format', 'json'))
        elif p == '/api/project':
            self.handle_project_action(q, b)
        elif p == '/api/whatsapp':
            self.whatsapp_action(b)
        elif p == '/api/whatsapp-webhook':
            self.whatsapp_webhook(b)
        elif p == '/api/model-set':
            self._json(self.model_set_cmd(b.get('preset',''), b.get('custom','')))
        elif p == '/api/automation':
            self._json(self.toggle_automation(b.get('mode','')))
        elif p == '/api/music':
            self._json(self.music_control(b.get('action','play')))
        elif p == '/api/mac':
            self._json(self.mac_action(b))
        elif p == '/api/audit':
            jid = new_job()
            threading.Thread(target=self.job_audit, args=(jid, b.get('path', HOME)), daemon=True).start()
            self._json({'job': jid})
        elif p == '/api/install-app':
            self.install_dashboard_app()
        elif p == '/api/install-swiftbar':
            self._json(self.install_swiftbar_quick_actions())
        else:
            self._json({'error': f'unknown {p}'}, 404)

    def get_files(self, tab, sort):
        files = []
        if tab == 'large':
            # Use Spotlight (mdfind) — instant on macOS, no TCC permission issues
            out = sh("mdfind -onlyin ~ 'kMDItemFSSize > 10485760' 2>/dev/null | grep -v '/.Trash/' | grep -v '/node_modules/' | grep -v '/.git/' | head -200", 12)
            if not out.strip():
                # Fallback: targeted find on common user directories
                out = sh(f"find '{HOME}/Downloads' '{HOME}/Desktop' '{HOME}/Documents' '{HOME}/Movies' '{HOME}/Music' '{HOME}/Pictures' -maxdepth 5 -type f -size +10M -not -path '*/.Trash/*' 2>/dev/null | head -120", 25)
            for f in [x for x in out.split('\n') if x.strip()]:
                e = entry(f)
                if e: files.append(e)
        elif tab == 'downloads':
            dl = os.path.expanduser('~/Downloads')
            try:
                for n in os.listdir(dl):
                    e = entry(os.path.join(dl,n))
                    if e: files.append(e)
            except: pass
        elif tab == 'dupes':
            out = sh("find ~/Downloads ~/Desktop ~/Documents ~/Movies -maxdepth 5 -type f -size +1M 2>/dev/null | head -400", 40)
            by_size = {}
            for f in [x for x in out.split('\n') if x.strip()]:
                try: by_size.setdefault(os.path.getsize(f), []).append(f)
                except: pass
            for sz, paths in by_size.items():
                if len(paths) < 2: continue
                by_hash = {}
                for fp in paths:
                    h = md5_quick(fp)
                    if h: by_hash.setdefault(h, []).append(fp)
                for h, group in by_hash.items():
                    if len(group) > 1:
                        for fp in group:
                            e = entry(fp)
                            if e: e['dupe_group'] = h; files.append(e)
        key = {'size':'size_bytes','date':'mtime','name':'name'}.get(sort,'size_bytes')
        if key == 'name':
            files.sort(key=lambda x: x.get('name','').lower())
        else:
            files.sort(key=lambda x: x.get(key, 0), reverse=True)
        return {'files': files[:150], 'count': len(files), 'tab': tab, 'sort': sort}

    def list_apps(self):
        return list_installed_apps(limit=400)

    def login_items(self):
        items = sh("osascript -e 'tell application \"System Events\" to get the name of every login item' 2>/dev/null")
        agents = sh("ls -1 ~/Library/LaunchAgents /Library/LaunchAgents 2>/dev/null | grep plist | head -40")
        return f"=== LOGIN ITEMS ===\n{items or '(none)'}\n\n=== LAUNCH AGENTS ===\n{agents or '(none)'}"

    def battery_health(self):
        raw = sh("system_profiler SPPowerDataType 2>/dev/null")
        def grab(k):
            m = re.search(rf'{k}:\s*(.+)', raw); return m.group(1).strip() if m else '—'
        return {'cycles': grab('Cycle Count'), 'condition': grab('Condition'),
                'max_capacity': grab('Maximum Capacity'), 'charging': grab('Charging')}

    def doctor(self):
        return '\n'.join([
            "Homebrew: " + (sh("brew --version | head -1") or "not installed"),
            "Node:     " + (sh("node -v") or "not installed"),
            "Python:   " + (sh("python3 --version") or "not installed"),
            "Git:      " + (sh("git --version") or "not installed"),
            "Xcode CLI:" + (sh("xcode-select -p") or " not installed"),
        ])

    def sys_report(self):
        rpt = "\n".join([
            "CHINNA V6 SYSTEM REPORT", "="*40,
            f"Host:    {sh('hostname -s')}",
            f"macOS:   {sh('sw_vers -productVersion')} ({sh('uname -m')})",
            f"Chip:    {sh('sysctl -n machdep.cpu.brand_string')}",
            f"Uptime:  {sh('uptime')}",
            "", "DISK:", sh("df -h / 2>/dev/null"),
            "", "MEMORY:", sh("vm_stat | head -6"),
            "", "TOP RAM:", sh("ps aux | sort -rk4 | head -6 | awk '{print $3\"% \"$11}'"),
        ])
        out = os.path.join(HOME, 'Desktop', f'chinna-report-{int(time.time())}.txt')
        try:
            with open(out,'w') as f: f.write(rpt)
            return {'result': rpt, 'saved': out}
        except:
            return {'result': rpt, 'saved': None}

    def install_dashboard_app(self):
        port = int(os.environ.get('CHINNA_DASHBOARD_PORT', PORT))
        url = f"http://localhost:{port}"
        app_dir = os.path.join(HOME, 'Applications')
        app_path = os.path.join(app_dir, 'Chinna.app')
        os.makedirs(app_dir, exist_ok=True)
        try:
            if os.path.exists(app_path):
                shutil.rmtree(app_path)
            script = f'open location "{url}"'
            subprocess.run(['osacompile', '-o', app_path, '-e', script], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            style_ok, style_err = style_mac_app_bundle(app_path)
            icon_svg = os.path.join(DASHBOARD_DIR, 'assets', 'chinna-icon.svg')
            icon_path = os.path.join(app_path, 'Contents', 'Resources', 'applet.icns')
            icon_ok, icon_err = build_icns_from_svg(icon_svg, icon_path)
            sh(f"xattr -dr com.apple.quarantine {shq(app_path)} 2>/dev/null || true")
            subprocess.run(['open', '-a', app_path], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self._json({
                'ok': True,
                'app_path': app_path,
                'url': url,
                'result': 'installed',
                'icon_installed': icon_ok,
                'style_applied': style_ok,
                'icon_note': icon_err,
                'style_note': style_err,
            })
        except Exception as e:
            self._json({'error': safe_text(str(e))}, 500)

    def install_swiftbar_quick_actions(self):
        try:
            plugin_dir = os.path.join(HOME, 'Library', 'Application Support', 'SwiftBar', 'Plugins')
            plugin_path = os.path.join(plugin_dir, 'chinna.1m.sh')
            dash_url = f"http://localhost:{int(os.environ.get('CHINNA_DASHBOARD_PORT', PORT))}"
            chinna_bin = shutil.which('chinna') or os.path.join(CHINNA_HOME, 'bin', 'chinna')
            os.makedirs(plugin_dir, exist_ok=True)
            plugin = f"""#!/usr/bin/env bash
echo \"CH\"
echo \"---\"
echo \"Open Dashboard | bash='open' param1='{dash_url}' terminal=false refresh=false\"
echo \"Install / Refresh Mac App | bash='{chinna_bin}' param1='app-install' terminal=false refresh=false\"
echo \"Install / Refresh SwiftBar Actions | bash='{chinna_bin}' param1='notch' terminal=false refresh=false\"
echo \"⚡ Purge RAM | bash='{chinna_bin}' param1='purge' terminal=false refresh=true\"
echo \"🧹 Deep Clean | bash='{chinna_bin}' param1='clean' terminal=false refresh=true\"
echo \"⬆️ Update Now | bash='{chinna_bin}' param1='update' param2='--apply' terminal=false refresh=true\"
"""
            with open(plugin_path, 'w') as f:
                f.write(plugin)
            os.chmod(plugin_path, 0o755)
            subprocess.run(['open', '-a', 'SwiftBar'], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {
                'ok': True,
                'plugin_path': plugin_path,
                'swiftbar_app': os.path.exists('/Applications/SwiftBar.app'),
                'result': 'SwiftBar quick actions installed'
            }
        except Exception as e:
            return {'error': safe_text(str(e))}

    # ── Encrypted Chat Backend ───────────────────────────────
    def chat_register(self, b):
        uid = safe_id(b.get('user_id'))
        if not uid:
            self._json({'error': 'user_id required'}, 400)
            return
        display = safe_text(b.get('display_name', uid))[:80]
        public_key = b.get('public_key_jwk') or {}

        with chat_lock:
            db = load_chat_db()
            users = db.setdefault('users', {})
            u = users.setdefault(uid, {'contacts': []})
            u['id'] = uid
            u['display_name'] = display
            u['public_key_jwk'] = public_key
            u['updated'] = int(time.time())
            u.setdefault('contacts', [])
            save_chat_db(db)

        self._json({'ok': True, 'user': {'id': uid, 'display_name': display}})

    def chat_get_user(self, uid):
        uid = safe_id(uid)
        if not uid:
            self._json({'error': 'id required'}, 400)
            return
        db = load_chat_db()
        u = db.get('users', {}).get(uid)
        if not u:
            self._json({'error': 'user not found'}, 404)
            return
        self._json({
            'id': uid,
            'display_name': u.get('display_name', uid),
            'public_key_jwk': u.get('public_key_jwk') or {},
            'updated': u.get('updated', 0)
        })

    def chat_add_contact(self, b):
        uid = safe_id(b.get('user_id'))
        peer = safe_id(b.get('peer_id'))
        if not uid or not peer:
            self._json({'error': 'user_id and peer_id required'}, 400)
            return

        with chat_lock:
            db = load_chat_db()
            users = db.setdefault('users', {})
            if uid not in users or peer not in users:
                self._json({'error': 'one or both users not registered'}, 404)
                return
            users[uid].setdefault('contacts', [])
            users[peer].setdefault('contacts', [])
            if peer not in users[uid]['contacts']:
                users[uid]['contacts'].append(peer)
            if uid not in users[peer]['contacts']:
                users[peer]['contacts'].append(uid)
            save_chat_db(db)

        self._json({'ok': True, 'user_id': uid, 'peer_id': peer})

    def chat_send(self, b):
        frm = safe_id(b.get('from_id'))
        to = safe_id(b.get('to_id'))
        cipher = b.get('cipher_b64') or ''
        iv = b.get('iv_b64') or ''
        meta = b.get('meta') or {}
        if not frm or not to or not cipher or not iv:
            self._json({'error': 'from_id, to_id, cipher_b64, iv_b64 required'}, 400)
            return

        with chat_lock:
            db = load_chat_db()
            if frm not in db.get('users', {}) or to not in db.get('users', {}):
                self._json({'error': 'user not registered'}, 404)
                return
            db['last_id'] = int(db.get('last_id', 0)) + 1
            msg = {
                'id': db['last_id'],
                'from_id': frm,
                'to_id': to,
                'cipher_b64': cipher,
                'iv_b64': iv,
                'meta': meta,
                'created': int(time.time())
            }
            db.setdefault('messages', []).append(msg)
            # keep db bounded for initial users
            db['messages'] = db['messages'][-4000:]
            save_chat_db(db)

        self._json({'ok': True, 'id': msg['id'], 'created': msg['created']})

    def chat_poll(self, q):
        uid = safe_id(q.get('user_id', ''))
        since = int(q.get('since_id', '0') or 0)
        if not uid:
            self._json({'error': 'user_id required'}, 400)
            return

        db = load_chat_db()
        users = db.get('users', {})
        if uid not in users:
            self._json({'error': 'user not registered'}, 404)
            return

        out = []
        for m in db.get('messages', []):
            mid = int(m.get('id', 0))
            if mid <= since:
                continue
            if m.get('to_id') == uid or m.get('from_id') == uid:
                out.append(m)
        out.sort(key=lambda x: x.get('id', 0))
        self._json({'messages': out[-300:], 'last_id': (out[-1]['id'] if out else since)})

    def chat_history(self, q):
        uid = safe_id(q.get('user_id', ''))
        peer = safe_id(q.get('peer_id', ''))
        lim = int(q.get('limit', '200') or 200)
        if not uid or not peer:
            self._json({'error': 'user_id and peer_id required'}, 400)
            return
        db = load_chat_db()
        out = []
        for m in db.get('messages', []):
            a = m.get('from_id')
            b = m.get('to_id')
            if (a == uid and b == peer) or (a == peer and b == uid):
                out.append(m)
        out.sort(key=lambda x: x.get('id', 0))
        self._json({'messages': out[-max(1, min(1000, lim)):], 'count': len(out)})

    def chat(self, b):
        """New dynamic Chinna AI with full conversation history + real tool calling loop + attachments."""
        user_msg = safe_text(b.get('message', ''), keep_newlines=True)
        model = safe_text(b.get('model', 'meta-llama/llama-3.3-70b-instruct:free'))
        incoming_history = b.get('history') or []
        raw_attachments = b.get('attachments') or []

        # Detect images early for auto model selection
        has_images = any(
            (a.get('mime','').startswith('image/') or 
             a.get('name','').lower().endswith(('.png','.jpg','.jpeg','.webp','.gif')))
            for a in raw_attachments
        )

        if not load_keys().get('OPENROUTER_API_KEY') and not load_keys().get('OPENAI_API_KEY'):
            self._json({'error': 'No API key configured. Add OpenRouter key in Settings.'}, 400)
            return

        # Process any attached files (text, code, images, pdf, etc.)
        attachment_context, vision_images = process_attachments(raw_attachments)

        # Auto-select best vision model if images are attached
        if has_images:
            model = select_best_vision_model(model, True)

        # Merge incoming history
        if incoming_history:
            AI_HISTORY.clear()
            for h in incoming_history[-AI_HISTORY_LIMIT:]:
                AI_HISTORY.append(h)

        # Build rich user message that includes attachment summaries
        full_user_content = user_msg
        if attachment_context:
            full_user_content += "\n\n[Attached files:]\n"
            for a in attachment_context:
                if a.get("type") == "text":
                    full_user_content += f"\n--- {a['name']} ---\n{a.get('content','')[:6000]}\n"
                elif a.get("type") == "image":
                    full_user_content += f"\n[Image attached: {a['name']}]\n"
                elif a.get("type") == "pdf":
                    full_user_content += f"\n--- PDF: {a['name']} ---\n{a.get('content','')[:3000]}\n"
                else:
                    full_user_content += f"\n[File: {a['name']} ({a.get('mime','binary')})]\n"

        add_to_history("user", full_user_content)

        # Build the messages array we will send (system + history)
        # Inject long-term memory context
        memory_facts = load_memory()
        memory_context = ""
        if memory_facts:
            top = sorted(memory_facts, key=lambda x: -x.get('importance', 5))[:6]
            memory_context = "\n\nKnown facts about this user / setup:\n" + "\n".join(f"- {m.get('fact')}" for m in top)

        system_prompt = (
            "You are Chinna, a concise, witty, and extremely capable Mac assistant.\n"
            "You have access to real tools to inspect and control the user's Mac.\n"
            "Use tools proactively when the user asks to do something (clean, kill, find, open, purge, run commands, etc).\n"
            "After using tools, give a short, direct, friendly answer.\n"
            "Never make up file paths or numbers — use the tool results.\n"
            "When you call tools, the results will be fed back to you automatically.\n"
            "You have long-term memory — use search_memory / save_to_memory when the user mentions preferences, projects, or recurring facts.\n\n"
            "If you need the user to upload a file (screenshot, log, code, config, etc.) to help better, reply with a short message AND include the special marker in your final answer like this:\n"
            "[NEEDS_UPLOAD: Please attach the screenshot of the error / the build log / the config file]\n"
            "Only use this when it would genuinely help."
            + memory_context
        )

        messages = [{"role": "system", "content": system_prompt}]

        # Inject history (with special handling for the very last user message if it has vision)
        history_to_send = AI_HISTORY[-12:]
        if vision_images and history_to_send and history_to_send[-1]["role"] == "user":
            last = history_to_send[-1]
            # Convert last user message into multi-modal format for vision models
            content_parts = [{"type": "text", "text": last.get("content", "")}]
            content_parts.extend(vision_images)
            history_to_send[-1] = {"role": "user", "content": content_parts}

        messages.extend(history_to_send)

        used_model = model
        final_reply = ""
        tool_traces = []
        needs_upload = False
        upload_request = None

        try:
            # === Dynamic Tool Calling Loop (up to 5 rounds) ===
            for round_num in range(5):
                # Try OpenRouter first (usually better tool calling)
                msg, used_model = openrouter_chat(messages, model=model, tools=TOOLS)
                if not msg and load_keys().get('OPENAI_API_KEY'):
                    msg, used_model = openai_chat(messages, model='gpt-4o-mini', tools=TOOLS)

                if not msg:
                    final_reply = "AI request failed. Check your API key or try again."
                    break

                # If the model wants to call tools
                tool_calls = msg.get("tool_calls") or []
                assistant_content = msg.get("content") or ""

                if tool_calls:
                    # Record the assistant's tool call decision
                    add_to_history("assistant", assistant_content, tool_calls=tool_calls)
                    messages.append({"role": "assistant", "content": assistant_content, "tool_calls": tool_calls})

                    # Execute every tool the model asked for
                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        name = fn.get("name")
                        args = {}
                        try:
                            args = json.loads(fn.get("arguments") or "{}")
                        except:
                            args = {}

                        result_text, is_long = execute_tool(name, args)
                        tool_traces.append({"tool": name, "args": args, "result": result_text[:800]})

                        # Feed result back as a tool message
                        tool_msg = {
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "name": name,
                            "content": result_text
                        }
                        add_to_history("tool", result_text, tool_call_id=tc.get("id"), name=name)
                        messages.append(tool_msg)

                    # Continue the loop so the model can reason over tool results
                    continue

                # No more tool calls — we have the final answer
                final_reply = assistant_content or "(no response)"

                # Detect if AI is explicitly asking for an upload
                needs_upload = False
                upload_request = None
                if "[NEEDS_UPLOAD:" in final_reply:
                    needs_upload = True
                    try:
                        upload_request = final_reply.split("[NEEDS_UPLOAD:", 1)[1].split("]", 1)[0].strip()
                    except:
                        upload_request = "Please attach the relevant file (screenshot, log, config, etc.)"
                    # Clean the marker from the visible reply
                    final_reply = final_reply.split("[NEEDS_UPLOAD:")[0].strip()

                add_to_history("assistant", final_reply)
                break

            # Fallback if loop exhausted without reply
            if not final_reply:
                final_reply = "I processed your request but didn't get a clean final answer. Try rephrasing."

            self._json({
                "reply": final_reply,
                "model": used_model,
                "history": AI_HISTORY[-AI_HISTORY_LIMIT:],
                "tool_calls": tool_traces,
                "attachments_processed": len(attachment_context),
                "needs_upload": needs_upload,
                "upload_request": upload_request
            })

        except Exception as e:
            try:
                with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                    log.write("CHAT ERROR:\n" + traceback.format_exc() + "\n")
            except:
                pass
            self._json({"error": safe_text(str(e))}, 500)

    def telegram_pair(self, b):
        keys = load_keys()
        token = keys.get('TELEGRAM_BOT_TOKEN', '')
        if not token:
            self._json({'error': 'Telegram bot token is not configured'}, 400)
            return
        meta = telegram_bot_meta()
        code = re.sub(r'[^A-Z0-9]', '', hashlib.sha1(f"{token}-{time.time()}".encode()).hexdigest().upper())[:8]
        bot_username = meta.get('username', '')
        pair_url = f"https://t.me/{bot_username}?start=PAIR_{code}" if bot_username else f"https://t.me/share/url?url=PAIR_{code}"
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={urllib.parse.quote(pair_url, safe='')}"
        save_pair_state({'code': code, 'created': int(time.time()), 'expires': int(time.time()) + 15 * 60, 'pair_url': pair_url, 'qr_url': qr_url})
        self._json({'code': code, 'bot_username': bot_username, 'pair_url': pair_url, 'qr_url': qr_url, 'expires': int(time.time()) + 15 * 60})

    def voice_transcribe(self, b):
        audio_b64 = b.get('audio_b64', '')
        mime = b.get('mime_type', 'audio/webm')
        if not audio_b64:
            self._json({'error': 'No audio provided'}, 400)
            return
        keys = load_keys()
        api_key = keys.get('OPENAI_API_KEY', '')
        if not api_key:
            self._json({'error': 'OpenAI key required for transcription'}, 400)
            return
        try:
            audio = base64.b64decode(audio_b64)
            boundary = f'chinna_{int(time.time())}'
            body = b''.join([
                f'--{boundary}\r\n'.encode(),
                b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n',
                f'--{boundary}\r\n'.encode(),
                b'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n',
                f'Content-Type: {mime}\r\n\r\n'.encode(),
                audio, b'\r\n',
                f'--{boundary}--\r\n'.encode()
            ])
            req = urllib.request.Request(
                'https://api.openai.com/v1/audio/transcriptions',
                data=body,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': f'multipart/form-data; boundary={boundary}'
                }
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                d = json.loads(resp.read())
            self._json({'text': safe_text(d.get('text', ''))})
        except Exception as e:
            self._json({'error': safe_text(e), 'text': ''}, 500)

    def serve_uploaded_file(self, file_id):
        """Return a previously uploaded file so it can be re-attached to AI chat."""
        if not file_id:
            self._json({'error': 'file id required'}, 400)
            return
        index = load_uploaded_files_index()
        meta = index.get(file_id)
        if not meta or not os.path.exists(meta.get('path', '')):
            self._json({'error': 'File not found or was deleted'}, 404)
            return
        try:
            with open(meta['path'], 'rb') as f:
                data = base64.b64encode(f.read()).decode()
            self._json({
                'id': file_id,
                'name': meta['name'],
                'mime': meta['mime'],
                'size': meta['size'],
                'data_b64': data
            })
        except Exception as e:
            self._json({'error': safe_text(str(e))}, 500)

    def serve_projects(self):
        """Return tracked projects from the registry for the dashboard."""
        registry_path = os.path.join(CHINNA_HOME, 'state/projects.json')
        try:
            if os.path.exists(registry_path):
                with open(registry_path) as f:
                    data = json.load(f)
                projects = data.get('projects', {})
            else:
                projects = {}

            # Convert to list and sort by most recently updated
            project_list = []
            for path, info in projects.items():
                project_list.append({
                    'path': path,
                    'short_path': path.replace(os.path.expanduser('~'), '~'),
                    'stack': info.get('stack', 'unknown'),
                    'port': info.get('port'),
                    'url': info.get('url'),
                    'status': info.get('status', 'unknown'),
                    'updated': info.get('updated', 0),
                    'notes': info.get('notes', ''),
                    'tags': info.get('tags', [])
                })

            project_list.sort(key=lambda x: -x.get('updated', 0))
            self._json({'projects': project_list[:15]})  # Limit to recent 15
        except Exception as e:
            self._json({'projects': [], 'error': safe_text(str(e))})

    def open_project_folder(self, path):
        if not path:
            self._json({'error': 'path required'}, 400)
            return
        expanded = os.path.expanduser(path)
        if os.path.exists(expanded):
            sh(f"open -R '{expanded}'")
            self._json({'ok': True, 'action': 'open-folder', 'path': expanded})
        else:
            self._json({'error': 'Path not found'}, 404)

    def open_project_url(self, url):
        if not url:
            self._json({'error': 'url required'}, 400)
            return
        sh(f"open '{url}'")
        self._json({'ok': True, 'action': 'open-url', 'url': url})

    def handle_project_action(self, q, b):
        """Unified handler for project CRUD + notes/tags (supports both GET and POST)."""
        registry_path = os.path.join(CHINNA_HOME, 'state/projects.json')
        method = self.command

        try:
            if os.path.exists(registry_path):
                with open(registry_path) as f:
                    data = json.load(f)
            else:
                data = {"projects": {}}

            if method == 'POST':
                body = b or {}
                path = body.get('path')
                action = body.get('action')

                if not path:
                    self._json({'error': 'path required'}, 400)
                    return

                abs_path = os.path.abspath(os.path.expanduser(path))
                proj = data.setdefault('projects', {}).setdefault(abs_path, {})

                if action == 'delete':
                    if abs_path in data.get('projects', {}):
                        del data['projects'][abs_path]
                        with open(registry_path, 'w') as f:
                            json.dump(data, f, indent=2)
                        self._json({'ok': True})
                    else:
                        self._json({'error': 'Not found'}, 404)
                    return

                if 'notes' in body:
                    proj['notes'] = safe_text(body['notes'])[:3000]

                if 'tags' in body:
                    tags = body['tags']
                    if isinstance(tags, str):
                        tags = [t.strip() for t in tags.split(',') if t.strip()]
                    proj['tags'] = [safe_text(t)[:40] for t in (tags or [])][:8]

                with open(registry_path, 'w') as f:
                    json.dump(data, f, indent=2)

                self._json({'ok': True, 'project': proj})
                return

            # GET single project
            path = q.get('path')
            if path:
                abs_path = os.path.abspath(os.path.expanduser(path))
                proj = data.get('projects', {}).get(abs_path, {})
                self._json({'path': abs_path, 'project': proj})
            else:
                self._json({'error': 'path required for GET'})

        except Exception as e:
            self._json({'error': safe_text(str(e))}, 500)


    def check_update(self):
        try:
            import urllib.request
            url = "https://raw.githubusercontent.com/pichimail/chinna-go/main/VERSION"
            latest = urllib.request.urlopen(url, timeout=5).read().decode().strip()
            return {"current": CHINNA_VERSION, "latest": latest, "update_available": latest != CHINNA_VERSION}
        except:
            return {"current": CHINNA_VERSION, "latest": CHINNA_VERSION, "update_available": False, "error": "offline"}

    def list_models(self):
        models_file = os.path.join(CHINNA_HOME, "models")
        presets = {}
        active = ""
        try:
            if os.path.exists(models_file):
                for line in open(models_file):
                    line = line.strip()
                    if line.startswith("ACTIVE_MODEL="):
                        active = line.split("=",1)[1].strip().strip('"')
                    elif line.startswith("MODEL_"):
                        k, v = line.split("=",1)
                        presets[k.replace("MODEL_","")] = v.strip().strip('"')
        except:
            pass
        return {"active": active, "presets": presets}

    def model_set_cmd(self, preset, custom=''):
        models_file = os.path.join(CHINNA_HOME, "models")
        try:
            presets = self.list_models()["presets"]
            if custom:
                new_model = custom.strip()
            elif preset in presets:
                new_model = presets[preset]
            else:
                return {"error": f"Unknown preset: {preset}. Use: {', '.join(presets.keys())}"}
            # Update ACTIVE_MODEL in models file
            lines = []
            replaced = False
            if os.path.exists(models_file):
                for line in open(models_file):
                    if line.strip().startswith("ACTIVE_MODEL="):
                        lines.append(f'ACTIVE_MODEL="{new_model}"\n')
                        replaced = True
                    else:
                        lines.append(line)
            if not replaced:
                lines.append(f'ACTIVE_MODEL="{new_model}"\n')
            with open(models_file, "w") as f:
                f.writelines(lines)
            return {"ok": True, "active": new_model, "preset": preset or "custom"}
        except Exception as e:
            return {"error": str(e)}

    def toggle_automation(self, mode):
        env_file = os.path.join(CHINNA_HOME, "env")
        try:
            new_mode = mode if mode in ("on","off") else None
            lines = []
            found = False
            if os.path.exists(env_file):
                for line in open(env_file):
                    if line.strip().startswith("APPAUTOMATIONMODE="):
                        if new_mode is None:
                            cur = line.split("=",1)[1].strip().strip('"')
                            new_mode = "off" if cur == "on" else "on"
                        lines.append(f"APPAUTOMATIONMODE={new_mode}\n")
                        found = True
                    else:
                        lines.append(line)
            if not found:
                if new_mode is None: new_mode = "on"
                lines.append(f"APPAUTOMATIONMODE={new_mode}\n")
            with open(env_file, "w") as f:
                f.writelines(lines)
            return {"ok": True, "mode": new_mode}
        except Exception as e:
            return {"error": str(e)}

    def music_control(self, action):
        scripts = {
            "play":  'tell application "Music" to play',
            "pause": 'tell application "Music" to pause',
            "next":  'tell application "Music" to next track',
            "prev":  'tell application "Music" to previous track',
            "info":  'tell application "Music" to return (name of current track) & " — " & (artist of current track)',
        }
        script = scripts.get(action)
        if not script:
            return {"error": f"unknown action: {action}"}
        result = sh(f"osascript -e '{script}' 2>/dev/null")
        return {"ok": True, "action": action, "result": result or "done"}

    def mac_action(self, b):
        action = b.get("action","")
        if action == "lock":
            sh("osascript -e 'tell application \"System Events\" to keystroke \"q\" using {command down, control down}' 2>/dev/null || open -a ScreenSaverEngine 2>/dev/null")
            return {"ok": True, "action": "lock"}
        elif action == "sleep":
            sh("osascript -e 'tell application \"System Events\" to sleep' 2>/dev/null")
            return {"ok": True, "action": "sleep"}
        elif action == "kill-port":
            port = b.get("port","")
            if not port: return {"error": "port required"}
            pids = sh(f"lsof -ti TCP:{port} 2>/dev/null")
            if pids:
                sh(f"kill -9 {pids.replace(chr(10),' ')} 2>/dev/null")
                return {"ok": True, "killed": pids.split(), "port": port}
            return {"ok": True, "result": f"No process on port {port}"}
        elif action == "open-app":
            app = b.get("app","")
            if not app: return {"error": "app required"}
            sh(f"open -a '{app}' 2>/dev/null")
            return {"ok": True, "action": "open-app", "app": app}
        elif action == "screen-share":
            ip = sh("ipconfig getifaddr en0 2>/dev/null") or sh("ipconfig getifaddr en1 2>/dev/null") or "?"
            host = sh("scutil --get LocalHostName 2>/dev/null") or sh("hostname -s 2>/dev/null") or "mac"
            vnc = f"vnc://{ip}"
            sh(f"echo '{vnc}' | pbcopy 2>/dev/null")
            sh("open 'x-apple.systempreferences:com.apple.preferences.sharing?ScreenSharing' 2>/dev/null")
            return {"ok": True, "ip": ip, "host": host, "vnc": vnc, "copied": True}
        elif action == "open-finder":
            path = b.get("path", HOME)
            sh(f"open -a Finder '{path}' 2>/dev/null")
            return {"ok": True, "action": "open-finder", "path": path}
        return {"error": f"unknown mac action: {action}"}

    def job_audit(self, jid, path):
        path = os.path.expanduser(path)
        job_log(jid, f"Auditing: {path}")
        if not os.path.exists(path):
            job_log(jid, "Path not found."); job_done(jid, False); return
        job_log(jid, "Detecting stack...")
        pkg = "package.json" if os.path.exists(os.path.join(path,"package.json")) else ""
        req = "requirements.txt" if os.path.exists(os.path.join(path,"requirements.txt")) else ""
        cargo = "Cargo.toml" if os.path.exists(os.path.join(path,"Cargo.toml")) else ""
        stack = "node" if pkg else ("python" if req else ("rust" if cargo else "unknown"))
        job_log(jid, f"Stack: {stack}")
        job_log(jid, "Top directories by size...")
        sizes = sh(f"du -sh '{path}'/*/ 2>/dev/null | sort -hr | head -10", 20)
        for ln in (sizes or "").split("\n")[:8]:
            if ln.strip(): job_log(jid, f"  {ln.strip()}")
        job_log(jid, "Git status...")
        git_s = sh(f"cd '{path}' && git status --short 2>/dev/null | head -10")
        if git_s:
            for ln in git_s.split("\n")[:8]:
                if ln.strip(): job_log(jid, f"  {ln.strip()}")
        else:
            job_log(jid, "  (not a git repo or clean)")
        job_log(jid, "Large files (>5MB)...")
        big = sh(f"find '{path}' -maxdepth 5 -type f -size +5M -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -8", 15)
        for ln in (big or "").split("\n")[:8]:
            if ln.strip(): job_log(jid, f"  {os.path.basename(ln.strip())}")
        job_log(jid, "TODOs / FIXMEs...")
        todos = sh(f"grep -rn 'TODO' '{path}' --include='*.js' --include='*.py' --include='*.ts' 2>/dev/null | head -4", 15)
        for ln in (todos or "").split("\n")[:6]:
            if ln.strip(): job_log(jid, f"  {ln.strip()[:80]}")
        if stack == 'node':
            job_log(jid, "npm audit...")
            npm_out = sh(f"cd '{path}' && npm audit --audit-level=high 2>/dev/null | tail -5", 30)
            if npm_out:
                for ln in npm_out.split("\n")[:4]:
                    if ln.strip(): job_log(jid, f"  {ln.strip()}")
            else:
                job_log(jid, "  (npm audit clean or npm not found)")
        if stack == 'python':
            job_log(jid, "Python compile check...")
            py_out = sh(f"cd '{path}' && python3 -m py_compile $(find . -name '*.py' -not -path './.venv/*' | head -20) 2>&1", 20)
            job_log(jid, "  " + (py_out.strip() or "✅ No syntax errors"))
        # Save audit report
        out = os.path.join(HOME, "Desktop", f"chinna-audit-{int(time.time())}.txt")
        try:
            with open(out, "w") as f:
                f.write(f"Chinna V6 Audit\n{'='*40}\nPath: {path}\nStack: {stack}\n\n")
                f.write(f"--- Top Directories ---\n{sizes}\n\n")
                f.write(f"--- Git Status ---\n{git_s or 'clean'}\n\n")
                f.write(f"--- Large Files ---\n{big or 'none'}\n\n")
                f.write(f"--- TODOs ---\n{todos or 'none'}\n")
            job_log(jid, f"Report saved: {out}")
        except:
            pass
        job_log(jid, "Audit complete."); job_done(jid)


    def whatsapp_action(self, b):
        action = b.get('action', 'open')
        number = b.get('number', '')
        message = b.get('message', '')
        if action == 'open':
            sh("open -a WhatsApp 2>/dev/null || open 'https://web.whatsapp.com' 2>/dev/null")
            self._json({'ok': True, 'action': 'opened WhatsApp'})
        elif action == 'send':
            import urllib.parse
            # Normalize number: strip non-digits
            clean = ''.join(c for c in number if c.isdigit())
            if not clean:
                self._json({'error': 'valid number required'}); return
            encoded = urllib.parse.quote(message)
            url = f"https://wa.me/{clean}?text={encoded}"
            sh(f"open '{url}' 2>/dev/null")
            self._json({'ok': True, 'url': url, 'number': clean})
        else:
            self._json({'error': f'unknown action: {action}'})

    def whatsapp_webhook(self, b):
        import json as _json
        log_dir = os.path.join(CHINNA_HOME, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, 'whatsapp-webhook.log')
        try:
            entry = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {_json.dumps(b)}\n"
            with open(log_file, 'a') as f:
                f.write(entry)
        except:
            pass
        self._json({'ok': True, 'logged': True})

    def job_purge(self, jid):
        job_log(jid, "Requesting RAM purge (may prompt for sudo in your terminal)...")
        sh("sudo purge 2>/dev/null", 30)
        job_log(jid, "RAM purged."); job_done(jid)

    def job_clean(self, jid):
        run_deep_clean_job(jid, selected_ids=None, strict=True, allow_force=False)

    def job_uninstall(self, jid, app_path, name):
        if not app_path or not os.path.exists(app_path):
            job_log(jid, "App not found."); job_done(jid, False); return
        base = name or os.path.basename(app_path)[:-4]
        job_log(jid, f"Uninstalling: {base}")
        job_log(jid, f"Removing app bundle: {app_path}")
        sh(f"rm -rf '{app_path}'", 30)
        crumbs = [f"~/Library/Application Support/{base}", f"~/Library/Caches/{base}",
                  f"~/Library/Preferences/*{base}*", f"~/Library/Logs/{base}",
                  f"~/Library/Saved Application State/*{base}*"]
        for c in crumbs:
            full = os.path.expanduser(c)
            found = sh(f"ls -d {full} 2>/dev/null")
            if found:
                job_log(jid, f"Removing leftover: {found.splitlines()[0]}")
                sh(f"rm -rf {full} 2>/dev/null")
        job_log(jid, f"{base} fully uninstalled."); job_done(jid)

    def job_delete(self, jid, paths):
        job_log(jid, f"Deleting {len(paths)} file(s)...")
        n = 0
        for fp in paths:
            if fp and os.path.exists(fp):
                sh(f"rm -f '{fp}'"); n += 1
                job_log(jid, f"  removed: {os.path.basename(fp)}")
        job_log(jid, f"Removed {n} file(s)."); job_done(jid)

if __name__ == '__main__':
    print(f"Chinna V6 -> http://localhost:{PORT}")
    print(f"serving {DASHBOARD_DIR}")
    threading.Thread(target=stats_loop, daemon=True).start()
    try:
        http.server.HTTPServer(('0.0.0.0', PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
