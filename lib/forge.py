#!/usr/bin/env python3
"""
Chinna Forge — integrated full-stack dev shell (Python port of Godspeed v0.5).
All features run server-side and stream results back to the dashboard.
"""
import os, re, json, subprocess, shutil, time, urllib.request, urllib.parse
from pathlib import Path

HOME = Path.home()
FORGE_DIR = HOME / '.chinna' / 'forge'
FORGE_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR = FORGE_DIR / 'logs'; LOG_DIR.mkdir(exist_ok=True)


def _run(cmd, cwd=None, timeout=120):
    """Run a shell command, return (ok, output)."""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True,
                           cwd=cwd, timeout=timeout, executable='/bin/bash')
        out = (r.stdout or '') + (('\n' + r.stderr) if r.stderr else '')
        return r.returncode == 0, out.strip()
    except subprocess.TimeoutExpired:
        return False, f'⏱ Timed out after {timeout}s'
    except Exception as e:
        return False, str(e)


def _has(tool):
    return shutil.which(tool) is not None


# ── STACK DETECTION ──────────────────────────────────────────────────────────
STACK_MARKERS = {
    'node':      ['package.json'],
    'python':    ['requirements.txt', 'main.py', 'app.py', 'pyproject.toml'],
    'php':       ['composer.json'],
    'flutter':   ['pubspec.yaml'],
    'rust':      ['Cargo.toml'],
    'go':        ['go.mod'],
    'ruby':      ['Gemfile'],
    'elixir':    ['mix.exs'],
    'gradle':    ['build.gradle', 'build.gradle.kts'],
    'docker':    ['Dockerfile', 'docker-compose.yml'],
}

def detect(path='.'):
    p = Path(path).expanduser().resolve()
    stacks = []
    for stack, markers in STACK_MARKERS.items():
        if any((p / m).exists() for m in markers):
            stacks.append(stack)
    # framework hints
    frameworks = []
    pkg = p / 'package.json'
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
            for fw in ['react', 'next', 'vue', 'svelte', 'vite', 'express', 'nestjs', 'astro']:
                if any(fw in d for d in deps): frameworks.append(fw)
        except Exception: pass
    # file counts
    counts = {}
    for ext, label in [('js', 'JS/TS'), ('jsx', 'JSX'), ('ts', 'TS'), ('tsx', 'TSX'),
                       ('py', 'Python'), ('php', 'PHP'), ('dart', 'Dart'), ('rs', 'Rust'), ('go', 'Go')]:
        try:
            n = len(list(p.rglob(f'*.{ext}')))
            if n: counts[label] = n
        except Exception: pass
    issues = []
    if (p / 'package.json').exists() and not (p / 'node_modules').exists():
        issues.append('Missing node_modules — run install')
    if not (p / '.env').exists(): issues.append('No .env file')
    if not (p / '.gitignore').exists(): issues.append('No .gitignore')
    if not (p / '.git').exists(): issues.append('Not a git repo')
    return {
        'path': str(p), 'name': p.name,
        'stacks': stacks or ['unknown'],
        'frameworks': frameworks,
        'fileCounts': counts,
        'issues': issues,
    }


# ── TOOLCHAIN ────────────────────────────────────────────────────────────────
DEV_TOOLS = ['node', 'npm', 'python3', 'pip3', 'git', 'docker', 'flutter', 'go',
             'rustc', 'cargo', 'gh', 'jq', 'code', 'brew', 'pyenv', 'nvm', 'poetry',
             'composer', 'kubectl', 'terraform', 'vercel', 'netlify']

def tool_status():
    rows = []
    for t in DEV_TOOLS:
        installed = _has(t)
        ver = ''
        if installed:
            ok, out = _run(f'{t} --version 2>/dev/null | head -1', timeout=8)
            ver = out[:40] if ok else ''
        rows.append({'name': t, 'installed': installed, 'version': ver})
    return rows

def install_tool(tool):
    if _has(tool):
        return {'ok': True, 'msg': f'{tool} already installed'}
    osname = subprocess.run('uname -s', shell=True, capture_output=True, text=True).stdout.strip()
    if 'Darwin' in osname:
        special = {'docker': 'brew install --cask docker', 'flutter': 'brew install --cask flutter',
                   'code': 'brew install --cask visual-studio-code', 'rustc': 'brew install rust',
                   'cargo': 'brew install rust', 'gh': 'brew install gh'}
        cmd = special.get(tool, f'brew install {tool}')
    else:
        cmd = f'sudo apt-get install -y {tool} || sudo yum install -y {tool}'
    ok, out = _run(cmd, timeout=600)
    return {'ok': ok, 'msg': out[-500:] if out else f'{tool} install attempted'}


# ── AUTO-FIX / SCAFFOLD ──────────────────────────────────────────────────────
SCAFFOLD = {
    'react-app': ('src/App.tsx', 'import React from "react";\nexport default function App(){return <div style={{padding:32}}><h1>🚀 Chinna App Ready</h1></div>;}'),
    'react-index': ('src/index.tsx', 'import React from "react";import ReactDOM from "react-dom/client";import App from "./App";\nReactDOM.createRoot(document.getElementById("root")!).render(<App/>);'),
    'node-server': ('index.js', 'const express=require("express");const app=express();app.get("/",(_,res)=>res.json({message:"Chinna API Ready 🚀"}));app.listen(5000,()=>console.log("🚀 :5000"));'),
    'python-app': ('app.py', 'from flask import Flask,jsonify\napp=Flask(__name__)\n@app.route("/")\ndef home():return jsonify({"message":"Chinna Python API Ready 🚀"})\nif __name__=="__main__":app.run(debug=True,port=5000)'),
    'go-main': ('main.go', 'package main\nimport "fmt"\nfunc main(){fmt.Println("🚀 Chinna Go App Ready!")}'),
    'rust-main': ('src/main.rs', 'fn main(){println!("🚀 Chinna Rust App Ready!");}'),
}

ENV_TEMPLATE = """# Chinna Development Environment
NODE_ENV=development
PORT=3000
API_PORT=5000
DATABASE_URL=sqlite:./dev.db
APP_NAME=Chinna App
SECRET_KEY=dev_secret_change_me
ENABLE_AI=true
DEBUG_MODE=true
"""

GITIGNORE_TEMPLATE = """node_modules/
vendor/
venv/
.venv/
__pycache__/
*.pyc
target/
build/
dist/
.env
.env.local
*.log
.vscode/
.idea/
.DS_Store
.chinna/
"""

def autofix(path='.', create_env=True, create_gitignore=True, scaffold=True):
    p = Path(path).expanduser().resolve()
    created = []
    info = detect(str(p))
    stacks = info['stacks']
    fw = info['frameworks']
    if scaffold:
        if 'node' in stacks and any(f in fw for f in ['react', 'vite', 'next']):
            for key in ['react-app', 'react-index']:
                rel, content = SCAFFOLD[key]
                fp = p / rel
                if not fp.exists():
                    fp.parent.mkdir(parents=True, exist_ok=True)
                    fp.write_text(content); created.append(rel)
        elif 'node' in stacks and not (p / 'index.js').exists() and not (p / 'src/index.js').exists():
            rel, content = SCAFFOLD['node-server']
            (p / rel).write_text(content); created.append(rel)
        if 'python' in stacks and not (p / 'app.py').exists() and not (p / 'main.py').exists():
            rel, content = SCAFFOLD['python-app']
            (p / rel).write_text(content); created.append(rel)
        if 'go' in stacks and not (p / 'main.go').exists():
            rel, content = SCAFFOLD['go-main']
            (p / rel).write_text(content); created.append(rel)
        if 'rust' in stacks and not (p / 'src/main.rs').exists():
            rel, content = SCAFFOLD['rust-main']
            (p / 'src').mkdir(exist_ok=True)
            (p / rel).write_text(content); created.append(rel)
    if create_env and not (p / '.env').exists():
        (p / '.env').write_text(ENV_TEMPLATE); created.append('.env')
    if create_gitignore and not (p / '.gitignore').exists():
        (p / '.gitignore').write_text(GITIGNORE_TEMPLATE); created.append('.gitignore')
    return {'created': created, 'count': len(created), 'stacks': stacks}


# ── GITHUB SEARCH ────────────────────────────────────────────────────────────
def github_search(query, limit=10):
    try:
        url = 'https://api.github.com/search/repositories?' + urllib.parse.urlencode({
            'q': query, 'sort': 'stars', 'order': 'desc', 'per_page': limit})
        req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github.v3+json',
                                                   'User-Agent': 'ChinnaForge'})
        data = json.loads(urllib.request.urlopen(req, timeout=15).read())
        return [{'name': r['full_name'], 'stars': r['stargazers_count'],
                 'desc': r.get('description') or '', 'url': r['html_url'],
                 'lang': r.get('language') or ''} for r in data.get('items', [])]
    except Exception as e:
        return {'error': str(e)}

def github_clone(repo, dest=None):
    dest = dest or str(HOME / 'development' / repo.split('/')[-1])
    ok, out = _run(f'git clone --depth=1 https://github.com/{repo}.git "{dest}"', timeout=120)
    return {'ok': ok, 'dest': dest, 'msg': out[-400:]}


# ── SECURITY SCAN ────────────────────────────────────────────────────────────
def security_scan(path='.'):
    p = Path(path).expanduser().resolve()
    findings = []
    # secret patterns
    patterns = {
        'AWS Key': r'AKIA[0-9A-Z]{16}',
        'Private Key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        'API token (generic)': r'(?i)(api[_-]?key|secret|token)["\']?\s*[:=]\s*["\'][A-Za-z0-9_\-]{20,}',
        'Stripe Live Key': r'sk_live_[0-9a-zA-Z]{24,}',
    }
    scanned = 0
    for fp in p.rglob('*'):
        if scanned > 2000: break
        if fp.is_file() and fp.suffix in ('.js', '.ts', '.py', '.php', '.env', '.json', '.yml', '.yaml', '.txt', ''):
            if 'node_modules' in str(fp) or '.git' in str(fp): continue
            try:
                txt = fp.read_text(errors='ignore')[:50000]
                scanned += 1
                for label, pat in patterns.items():
                    if re.search(pat, txt):
                        findings.append({'file': str(fp.relative_to(p)), 'type': label})
            except Exception: pass
    # sensitive files
    for sf in p.rglob('*'):
        if sf.suffix in ('.key', '.pem', '.p12', '.pfx'):
            findings.append({'file': str(sf.relative_to(p)), 'type': 'Sensitive file'})
    # npm audit
    audit = ''
    if (p / 'package.json').exists() and _has('npm'):
        ok, out = _run('npm audit --json 2>/dev/null', cwd=str(p), timeout=60)
        try:
            a = json.loads(out)
            vuln = a.get('metadata', {}).get('vulnerabilities', {})
            audit = f"npm: {vuln.get('total',0)} vulns ({vuln.get('critical',0)} critical, {vuln.get('high',0)} high)"
        except Exception: audit = 'npm audit ran'
    return {'findings': findings, 'scanned': scanned, 'npmAudit': audit}


# ── BUILD ────────────────────────────────────────────────────────────────────
def smart_build(path='.'):
    p = Path(path).expanduser().resolve()
    if (p / 'turbo.json').exists(): cmd, sys = 'npx turbo build', 'Turborepo'
    elif (p / 'nx.json').exists(): cmd, sys = 'npx nx run-many --target=build', 'Nx'
    elif (p / 'Makefile').exists(): cmd, sys = 'make build', 'Make'
    elif (p / 'package.json').exists(): cmd, sys = 'npm run build', 'npm'
    elif (p / 'Cargo.toml').exists(): cmd, sys = 'cargo build --release', 'Cargo'
    elif (p / 'go.mod').exists(): cmd, sys = 'go build ./...', 'Go'
    else: return {'ok': False, 'system': 'none', 'msg': 'No recognized build system'}
    ok, out = _run(cmd, cwd=str(p), timeout=300)
    return {'ok': ok, 'system': sys, 'msg': out[-1000:]}


# ── PLUGINS ──────────────────────────────────────────────────────────────────
def plugin_list(path='.'):
    p = Path(path).expanduser().resolve() / 'plugins'
    if not p.exists(): return []
    out = []
    for d in p.iterdir():
        if d.is_dir() and (d / 'plugin.json').exists():
            try:
                meta = json.loads((d / 'plugin.json').read_text())
                out.append({'name': meta.get('displayName', meta.get('name', d.name)),
                            'version': meta.get('version', '1.0.0'),
                            'enabled': meta.get('enabled', True)})
            except Exception: pass
    return out

def plugin_new(name, path='.'):
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    d = Path(path).expanduser().resolve() / 'plugins' / slug
    if d.exists(): return {'ok': False, 'msg': 'Plugin already exists'}
    d.mkdir(parents=True)
    (d / 'plugin.json').write_text(json.dumps({
        'name': slug, 'displayName': name, 'version': '1.0.0',
        'description': 'Custom Chinna plugin', 'main': 'index.tsx', 'enabled': True,
        'author': os.environ.get('USER', 'chinna'),
    }, indent=2))
    comp = name.replace(' ', '')
    (d / 'index.tsx').write_text(
        f'import React,{{useState}} from "react";\nexport default function {comp}(){{\n'
        f'  const [n,setN]=useState(0);\n'
        f'  return <div style={{{{padding:24,borderRadius:12}}}}><h2>🔌 {name}</h2>'
        f'<button onClick={{()=>setN(n+1)}}>Clicks: {{n}}</button></div>;\n}}')
    return {'ok': True, 'slug': slug, 'path': str(d)}


# ── AI (delegates to dashboard's existing AI chain) ──────────────────────────
def ai_prompt(prompt, ai_fn=None):
    """ai_fn is injected by server (the dashboard's InvokeLLM chain)."""
    if ai_fn:
        try: return {'reply': ai_fn(prompt)}
        except Exception as e: return {'error': str(e)}
    return {'error': 'AI not configured. Set a key in Settings.'}
