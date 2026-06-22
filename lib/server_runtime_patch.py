#!/usr/bin/env python3
"""Runtime patch applied by install.sh.
Adds missing dashboard backend routes and optional AI-key setup without changing existing app data.
"""
import getpass, json, os, pathlib

HOME = os.path.expanduser('~')
CHINNA_HOME = os.environ.get('CHINNA_HOME', os.path.join(HOME, '.chinna'))
API_KEYS_FILE = os.path.join(CHINNA_HOME, 'api_keys.json')
ENV_FILE = os.path.join(CHINNA_HOME, 'env')
TARGETS = [os.path.join(CHINNA_HOME, 'dashboard_server.py'), os.path.join(CHINNA_HOME, 'lib', 'server.py')]

IMPORT_OLD = "import base64, hashlib, http.server, json, os, plistlib, re, secrets, shutil, subprocess, sys, tempfile, threading, time, traceback, unicodedata, urllib.error, urllib.parse, urllib.request"
IMPORT_NEW = IMPORT_OLD + ", mimetypes"
STATE_OLD = "UI_LAYOUT_FILE = os.path.join(CHINNA_HOME, 'state/ui_layout.json')"
STATE_NEW = STATE_OLD + "\nACTION_TRACE_FILE = os.path.join(CHINNA_HOME, 'state/action_trace.json')\nCHECKPOINTS_FILE = os.path.join(CHINNA_HOME, 'state/checkpoints.json')"
GET_ANCHOR = "        elif p == '/api/custom-views':\n            self._json({'views': load_custom_views()})"
GET_PATCH = """        elif p == '/api/media':
            qp = urllib.parse.urlencode({'path': q.get('path', '')})
            self.send_response(302); self.send_header('Location', '/api/fs/serve?' + qp); self.end_headers(); return
        elif p == '/api/action/trace':
            self._json({'items': read_json(ACTION_TRACE_FILE, [])})
        elif p == '/api/checkpoints':
            self._json({'items': read_json(CHECKPOINTS_FILE, [])})
        elif p == '/api/media/metadata':
            mp = os.path.expanduser(q.get('path', ''))
            if not mp or not os.path.isfile(mp): self._json({'error': 'file not found'}, 404)
            else:
                st = os.stat(mp)
                self._json({'name': os.path.basename(mp), 'path': mp, 'size_bytes': st.st_size, 'size': fsize(st.st_size), 'mtime': int(st.st_mtime), 'mime': mimetypes.guess_type(mp)[0] or 'application/octet-stream', 'stream_url': '/api/fs/serve?' + urllib.parse.urlencode({'path': mp})})
        elif p == '/api/custom-views':
            self._json({'views': load_custom_views()})"""
POST_ANCHOR = "        elif p == '/api/custom-views':\n            views = b.get('views') if isinstance(b, dict) else []"
POST_PATCH = """        elif p == '/api/action/trace':
            items = read_json(ACTION_TRACE_FILE, [])
            if not isinstance(items, list): items = []
            item = {'at': datetime.now(timezone.utc).isoformat(), 'action': safe_text(b.get('action', 'action'))[:160], 'payload': b.get('payload') if isinstance(b.get('payload'), dict) else {}, 'result': b.get('result')}
            items.insert(0, item); write_json(ACTION_TRACE_FILE, items[:300]); self._json({'ok': True, 'count': len(items[:300]), 'item': item})
        elif p == '/api/checkpoints':
            items = read_json(CHECKPOINTS_FILE, [])
            if not isinstance(items, list): items = []
            cp = b.get('checkpoint') if isinstance(b.get('checkpoint'), dict) else b
            cp.setdefault('id', 'cp_' + secrets.token_hex(6)); cp.setdefault('at', datetime.now(timezone.utc).isoformat()); cp.setdefault('label', 'Checkpoint')
            items.insert(0, cp); write_json(CHECKPOINTS_FILE, items[:160]); self._json({'ok': True, 'count': len(items[:160]), 'checkpoint': cp})
        elif p == '/api/restore-plan':
            self._json({'ok': True, 'mode': 'plan-only', 'message': 'Restore planning is ready. Destructive restore execution is approval-gated.', 'checkpoint_id': safe_text(b.get('checkpoint_id', ''))})
        elif p == '/api/media/operation':
            mp = os.path.expanduser(b.get('path', '')); op = safe_text(b.get('operation', 'metadata'))
            if not mp or not os.path.exists(mp): self._json({'error': 'file not found'}, 404)
            elif op == 'reveal': sh(f"open -R {shq(mp)}", 10); self._json({'ok': True, 'result': 'Revealed in Finder', 'path': mp})
            elif op == 'open': sh(f"open {shq(mp)}", 10); self._json({'ok': True, 'result': 'Opened with default app', 'path': mp})
            else:
                st = os.stat(mp); self._json({'ok': True, 'operation': 'metadata', 'name': os.path.basename(mp), 'path': mp, 'size_bytes': st.st_size, 'size': fsize(st.st_size), 'mime': mimetypes.guess_type(mp)[0] or 'application/octet-stream'})
        elif p == '/api/custom-views':
            views = b.get('views') if isinstance(b, dict) else []"""
FS_OLD = """                mime = mimetypes.guess_type(p)[0] or 'application/octet-stream'
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(os.path.getsize(p)))
                self.send_header('Accept-Ranges', 'bytes')
                self.end_headers()
                with open(p, 'rb') as f:
                    while True:
                        chunk = f.read(8192)
                        if not chunk: break
                        self.wfile.write(chunk)
                return"""
FS_NEW = """                mime = mimetypes.guess_type(p)[0] or 'application/octet-stream'
                size = os.path.getsize(p); start, end, status = 0, size - 1, 200
                rng = self.headers.get('Range', '')
                if rng.startswith('bytes='):
                    try:
                        a, _, b2 = rng.split('=', 1)[1].partition('-')
                        if a.strip(): start = max(0, int(a))
                        if b2.strip(): end = min(size - 1, int(b2))
                        status = 206
                    except Exception: start, end, status = 0, size - 1, 200
                if start > end: self.send_error(416); return
                length = end - start + 1
                self.send_response(status); self.send_header('Content-Type', mime); self.send_header('Content-Length', str(length)); self.send_header('Accept-Ranges', 'bytes')
                if status == 206: self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.end_headers()
                with open(p, 'rb') as f:
                    f.seek(start); remaining = length
                    while remaining > 0:
                        chunk = f.read(min(131072, remaining))
                        if not chunk: break
                        remaining -= len(chunk); self.wfile.write(chunk)
                return"""

def rjson(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else default
    except Exception:
        return default

def wjson(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f: json.dump(data, f, indent=2, ensure_ascii=True)
    try: os.chmod(path, 0o600)
    except Exception: pass

def patch_one(path):
    p = pathlib.Path(path)
    if not p.exists(): return f'missing {path}'
    s = p.read_text(encoding='utf-8', errors='replace'); old = s
    if 'import mimetypes' not in s: s = s.replace(IMPORT_OLD, IMPORT_NEW)
    if 'ACTION_TRACE_FILE' not in s: s = s.replace(STATE_OLD, STATE_NEW)
    if '/api/action/trace' not in s:
        s = s.replace(GET_ANCHOR, GET_PATCH).replace(POST_ANCHOR, POST_PATCH)
    if FS_OLD in s: s = s.replace(FS_OLD, FS_NEW)
    if s != old: p.write_text(s, encoding='utf-8'); return f'patched {path}'
    return f'already patched {path}'

def ask(prompt, secret=False):
    try:
        with open('/dev/tty', 'r+', encoding='utf-8', buffering=1) as tty:
            if secret: return getpass.getpass(prompt, stream=tty).strip()
            tty.write(prompt); return tty.readline().strip()
    except Exception:
        return ''

def set_env(name, value):
    if not value: return
    lines = []
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r', encoding='utf-8', errors='replace') as f: lines = f.read().splitlines()
    safe = str(value).replace("'", "'\\''")
    new = f"{name}='{safe}'"
    prefixes = (f'{name}=', f'export {name}=', f'# {name}=')
    out, done = [], False
    for line in lines:
        if line.startswith(prefixes):
            if not done: out.append(new); done = True
        else: out.append(line)
    if not done: out.append(new)
    os.makedirs(os.path.dirname(ENV_FILE), exist_ok=True)
    with open(ENV_FILE, 'w', encoding='utf-8') as f: f.write('\n'.join(out).rstrip() + '\n')
    try: os.chmod(ENV_FILE, 0o600)
    except Exception: pass

def prompt_ai_keys():
    if os.environ.get('CHINNA_SKIP_KEY_PROMPT') == '1': print('AI key setup skipped by env'); return
    cur = rjson(API_KEYS_FILE, {})
    if cur.get('OPENROUTER_API_KEY') or cur.get('OPENAI_API_KEY'):
        print('AI key setup: existing API key found'); return
    ans = ask('\n  AI setup: add OpenRouter/OpenAI keys now? [y/N/skip] ')
    if ans.lower() not in ('y','yes'):
        print('AI key setup skipped. Add keys later in Dashboard → Settings.'); return
    openrouter = ask('  OpenRouter API key (Enter to skip): ', True)
    openai = ask('  OpenAI API key (Enter to skip): ', True)
    active = ask('  Active model [openrouter/free]: ') or 'openrouter/free'
    if openrouter: cur['OPENROUTER_API_KEY'] = openrouter; set_env('OPENROUTER_API_KEY', openrouter)
    if openai: cur['OPENAI_API_KEY'] = openai; set_env('OPENAI_API_KEY', openai)
    cur['ACTIVE_MODEL'] = active; set_env('ACTIVE_MODEL', active); wjson(API_KEYS_FILE, cur)
    print('AI key setup complete.' if (openrouter or openai) else 'No AI key entered. Free/local fallback remains active.')

def main():
    for t in TARGETS: print(patch_one(t))
    prompt_ai_keys()

if __name__ == '__main__': main()
