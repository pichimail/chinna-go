#!/usr/bin/env python3
"""Chinna V5 — Dashboard Server (Python stdlib only, zero deps)."""
import http.server, json, subprocess, os, re, sys, threading, time, urllib.parse, hashlib

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7777
CHINNA_HOME = os.environ.get('CHINNA_HOME', os.path.expanduser('~/.chinna'))
DASHBOARD_DIR = os.path.join(CHINNA_HOME, 'dashboard')
HOME = os.path.expanduser('~')
API_KEYS_FILE = os.path.join(CHINNA_HOME, 'api_keys.json')
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

def load_keys():
    try:
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE) as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_keys(d):
    cur = load_keys(); cur.update(d)
    with open(API_KEYS_FILE, 'w') as f:
        json.dump(cur, f, indent=2)

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
        p = self.path.split('?')[0]
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
        if p == '/api/stats':
            with cache_lock: self._json(stats_cache)
        elif p == '/api/job':
            with jobs_lock: self._json(jobs.get(q.get('id',''), {'lines':['job not found'],'done':True,'ok':False}))
        elif p == '/api/files':
            self._json(self.get_files(q.get('tab','large'), q.get('sort','size')))
        elif p == '/api/apps':
            self._json({'apps': self.list_apps()})
        elif p == '/api/loginitems':
            self._json({'result': self.login_items()})
        elif p == '/api/batteryhealth':
            self._json(self.battery_health())
        elif p == '/api/storage':
            self._json({'items': self.storage_breakdown(q.get('path', HOME)), 'path': os.path.expanduser(q.get('path', HOME))})
        elif p == '/api/ports':
            self._json({'result': sh("lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $1\"  pid:\"$2\"  \"$9}' | head -30") or 'No listening ports'})
        elif p == '/api/doctor':
            self._json({'result': self.doctor()})
        elif p == '/api/sysreport':
            self._json(self.sys_report())
        elif p == '/api/get_keys':
            k = load_keys(); self._json({'chinna_ai_set': bool(k.get('OPENROUTER_API_KEY')), 'openai_set': bool(k.get('OPENAI_API_KEY'))})
        elif p in ('/',''):
            self.path = '/index.html'; super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        p = self.path; b = self._bd()
        if p == '/api/save_keys':
            d = {}
            if b.get('chinna_ai_key'): d['OPENROUTER_API_KEY'] = b['chinna_ai_key']
            if b.get('openai_key'): d['OPENAI_API_KEY'] = b['openai_key']
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

    def storage_breakdown(self, path):
        path = os.path.expanduser(path)
        out = sh(f"du -sk '{path}'/* 2>/dev/null | sort -rn | head -25", 30)
        items = []
        for ln in out.split('\n'):
            if not ln.strip(): continue
            parts = ln.split('\t')
            if len(parts) == 2:
                try: szb = int(parts[0])*1024
                except: szb = 0
                items.append({'path': parts[1], 'name': os.path.basename(parts[1]),
                              'size': fsize(szb), 'size_bytes': szb, 'is_dir': os.path.isdir(parts[1])})
        return items

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
        msg = b.get('message',''); model = b.get('model','meta-llama/llama-3.3-70b-instruct:free')
        key = load_keys().get('OPENROUTER_API_KEY','')
        if not key: self._json({'error':'No API key. Open Settings and add your OpenRouter key.'},400); return
        try:
            import urllib.request
            data = json.dumps({'model':model,'messages':[{'role':'user','content':msg}]}).encode()
            req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=data,
                headers={'Content-Type':'application/json','Authorization':f'Bearer {key}'})
            r = urllib.request.urlopen(req, timeout=40)
            d = json.loads(r.read())
            self._json({'reply': d.get('choices',[{}])[0].get('message',{}).get('content','(no response)')})
        except Exception as e:
            self._json({'error': str(e)}, 500)

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
