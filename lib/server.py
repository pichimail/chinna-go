#!/usr/bin/env python3
"""Chinna V5 — Dashboard Server (Python stdlib only, zero deps)."""
import base64, hashlib, http.server, json, os, re, subprocess, sys, threading, time, traceback, unicodedata, urllib.parse, urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7777
CHINNA_HOME = os.environ.get('CHINNA_HOME', os.path.expanduser('~/.chinna'))
DASHBOARD_DIR = os.path.join(CHINNA_HOME, 'dashboard')
HOME = os.path.expanduser('~')
API_KEYS_FILE = os.path.join(CHINNA_HOME, 'api_keys.json')
PAIR_STATE_FILE = os.path.join(CHINNA_HOME, 'telegram_pair.json')
os.makedirs(DASHBOARD_DIR, exist_ok=True)

stats_cache = {}
cache_lock = threading.Lock()
jobs = {}
jobs_lock = threading.Lock()

def sh(cmd, timeout=20):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, timeout=timeout).decode(errors='replace').strip()
    except Exception:
        return ''

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
    for name in ('OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'):
        if not keys.get(name) and shell_cfg.get(name):
            keys[name] = shell_cfg[name]
        if not keys.get(name) and os.environ.get(name):
            keys[name] = os.environ[name]
    return keys

def save_keys(d):
    cur = load_keys(); cur.update(d)
    write_json(API_KEYS_FILE, cur)

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

def openrouter_chat(prompt, model='meta-llama/llama-3.3-70b-instruct:free'):
    key = load_keys().get('OPENROUTER_API_KEY', '')
    if not key:
        return None, 'no_key'
    payload = json.dumps({'model': model, 'max_tokens': 900, 'messages': [{'role': 'user', 'content': prompt}]}, ensure_ascii=False).encode('utf-8')
    cmd = [
        'curl', '-sS', '--max-time', '40',
        'https://openrouter.ai/api/v1/chat/completions',
        '-H', f'Authorization: Bearer {key}',
        '-H', 'Content-Type: application/json; charset=utf-8',
        '-H', 'HTTP-Referer: https://chinna.local',
        '-H', 'X-Title: Chinna Dashboard',
        '--data-binary', '@-'
    ]
    proc = subprocess.run(cmd, input=payload, capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        return None, f'curl_failed:{proc.returncode}'
    data = json.loads(proc.stdout.decode('utf-8', errors='replace'))
    return safe_text(data.get('choices', [{}])[0].get('message', {}).get('content', '')), model

def openai_chat(prompt, model='gpt-4o-mini'):
    key = load_keys().get('OPENAI_API_KEY', '')
    if not key:
        return None, 'no_key'
    payload = json.dumps({'model': model, 'max_tokens': 900, 'messages': [{'role': 'user', 'content': prompt}]}, ensure_ascii=False).encode('utf-8')
    cmd = [
        'curl', '-sS', '--max-time', '40',
        'https://api.openai.com/v1/chat/completions',
        '-H', f'Authorization: Bearer {key}',
        '-H', 'Content-Type: application/json; charset=utf-8',
        '--data-binary', '@-'
    ]
    proc = subprocess.run(cmd, input=payload, capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        return None, f'curl_failed:{proc.returncode}'
    data = json.loads(proc.stdout.decode('utf-8', errors='replace'))
    return safe_text(data.get('choices', [{}])[0].get('message', {}).get('content', '')), model

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
        p = parsed.path
        q = dict(urllib.parse.parse_qsl(parsed.query))
        if p == '/favicon.ico':
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
            self._json({
                'chinna_ai_set': bool(k.get('OPENROUTER_API_KEY')),
                'openai_set': bool(k.get('OPENAI_API_KEY')),
                'telegram_set': bool(k.get('TELEGRAM_BOT_TOKEN')),
                'telegram_paired': bool(k.get('TELEGRAM_CHAT_ID')),
                'telegram_bot': telegram_status().get('bot_username', ''),
                'pair_code': telegram_status().get('pair_code', '')
            })
        elif p == '/api/telegram/status':
            self._json(telegram_status())
        elif p in ('/',''):
            self.path = '/index.html'; super().do_GET()
        elif p.startswith('/api/'):
            self._json({'error': f'unknown {p}'}, 404)
        else:
            super().do_GET()

    def do_POST(self):
        p = self.path; b = self._bd()
        if p == '/api/save_keys':
            d = {}
            if b.get('chinna_ai_key'): d['OPENROUTER_API_KEY'] = b['chinna_ai_key']
            if b.get('openai_key'): d['OPENAI_API_KEY'] = b['openai_key']
            if b.get('telegram_token'): d['TELEGRAM_BOT_TOKEN'] = b['telegram_token']
            if b.get('telegram_chat'): d['TELEGRAM_CHAT_ID'] = b['telegram_chat']
            save_keys(d); self._json({'result':'✅ Keys saved'})
        elif p == '/api/purge':
            jid = new_job(); threading.Thread(target=self.job_purge, args=(jid,), daemon=True).start(); self._json({'job': jid})
        elif p == '/api/clean':
            jid = new_job(); threading.Thread(target=self.job_clean, args=(jid,), daemon=True).start(); self._json({'job': jid})
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
        apps = []
        for base in ['/Applications', os.path.expanduser('~/Applications')]:
            if not os.path.isdir(base): continue
            try:
                for n in sorted(os.listdir(base)):
                    if n.endswith('.app'):
                        fp = os.path.join(base, n)
                        sz = sh(f"du -sk '{fp}' 2>/dev/null | cut -f1")
                        try: szb = int(sz)*1024
                        except: szb = 0
                        apps.append({'name': n[:-4], 'path': fp, 'size': fsize(szb), 'size_bytes': szb})
            except: pass
        apps.sort(key=lambda x: x['size_bytes'], reverse=True)
        return apps

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
            "CHINNA V5 SYSTEM REPORT", "="*40,
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

    def chat(self, b):
        msg = safe_text(b.get('message',''), keep_newlines=True)
        model = safe_text(b.get('model','meta-llama/llama-3.3-70b-instruct:free'))
        key = load_keys().get('OPENROUTER_API_KEY','')
        if not key:
            self._json({'error':'No API key. Open Settings and add your OpenRouter key.'}, 400)
            return
        try:
            with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                log.write(f"chat:start msg_len={len(msg)}\n")
            context = local_context_for(msg, b.get('path'))
            with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                log.write(f"chat:context count={len(context)}\n")
            prompt = build_chat_prompt(msg, context)
            with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                log.write(f"chat:prompt len={len(prompt)}\n")
            reply, used_model = openrouter_chat(prompt, model=model or 'meta-llama/llama-3.3-70b-instruct:free')
            if not reply and load_keys().get('OPENAI_API_KEY'):
                with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                    log.write("chat:fallback=openai\n")
                reply, used_model = openai_chat(prompt, model='gpt-4o-mini')
            with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                log.write(f"chat:reply type={type(reply).__name__} len={len(reply or '')}\n")
            if reply is None:
                self._json({'error':'AI request failed — try again'}, 502)
                return
            self._json({'reply': reply, 'model': used_model, 'sources': context})
        except Exception as e:
            try:
                with open(os.path.join(CHINNA_HOME, 'dashboard.log'), 'a') as log:
                    log.write(traceback.format_exc() + '\n')
            except Exception:
                pass
            self._json({'error': safe_text(e)}, 500)

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

    def job_purge(self, jid):
        job_log(jid, "Requesting RAM purge (may prompt for sudo in your terminal)...")
        sh("sudo purge 2>/dev/null", 30)
        job_log(jid, "RAM purged."); job_done(jid)

    def job_clean(self, jid):
        steps = [("User caches", "rm -rf ~/Library/Caches/* 2>/dev/null"),
                 ("npm cache", "npm cache clean --force 2>/dev/null"),
                 ("Homebrew cleanup", "brew cleanup -s 2>/dev/null"),
                 ("Trash", "rm -rf ~/.Trash/* 2>/dev/null")]
        for label, cmd in steps:
            job_log(jid, f"Cleaning {label} ...")
            sh(cmd, 40)
            job_log(jid, f"  done: {label}")
        job_log(jid, "Deep clean complete."); job_done(jid)

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
    print(f"Chinna V5 -> http://localhost:{PORT}")
    print(f"serving {DASHBOARD_DIR}")
    threading.Thread(target=stats_loop, daemon=True).start()
    try:
        http.server.HTTPServer(('0.0.0.0', PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
