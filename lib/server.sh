#!/usr/bin/env bash
# lib/server.sh — Dashboard web server (Python HTTP)

DASHBOARD_PORT="${CHINNA_DASHBOARD_PORT:-7777}"
DASHBOARD_PID_FILE="$CHINNA_HOME/dashboard.pid"

# ─── Start dashboard server ──────────────────────────────────
start_dashboard() {
    local port="$DASHBOARD_PORT"
    
    # Kill existing
    stop_dashboard 2>/dev/null

    # Create the API server script
    cat > "$CHINNA_HOME/dashboard_server.py" <<'PYSERVER'
import http.server
import json
import subprocess
import os
import re
import sys
import threading
import time

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7777
CHINNA_HOME = os.environ.get('CHINNA_HOME', os.path.expanduser('~/.chinna'))
DASHBOARD_DIR = os.path.join(CHINNA_HOME, 'dashboard')

# Cache for system stats (refreshed every second)
stats_cache = {}
cache_lock = threading.Lock()

def run_cmd(cmd, default=""):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, timeout=5).decode().strip()
    except:
        return default

def collect_stats():
    """Collect all system stats"""
    stats = {}
    
    # Disk
    df_out = run_cmd("df -h /System/Volumes/Data 2>/dev/null || df -h /")
    lines = df_out.split('\n')
    if len(lines) > 1:
        parts = lines[1].split()
        stats['disk'] = {
            'total': parts[1] if len(parts) > 1 else '?',
            'used': parts[2] if len(parts) > 2 else '?', 
            'free': parts[3] if len(parts) > 3 else '?',
            'pct': int(re.sub(r'%', '', parts[4])) if len(parts) > 4 else 0
        }
    
    # Memory
    vm = run_cmd("vm_stat")
    page_size = 16384
    stats['memory'] = {'free': 0, 'active': 0, 'inactive': 0, 'wired': 0, 'compressed': 0}
    for line in vm.split('\n'):
        if 'Pages free' in line:
            stats['memory']['free'] = int(re.findall(r'\d+', line.split(':')[1])[0]) * page_size // 1048576
        elif 'Pages active' in line:
            stats['memory']['active'] = int(re.findall(r'\d+', line.split(':')[1])[0]) * page_size // 1048576
        elif 'Pages inactive' in line:
            stats['memory']['inactive'] = int(re.findall(r'\d+', line.split(':')[1])[0]) * page_size // 1048576
        elif 'Pages wired' in line:
            stats['memory']['wired'] = int(re.findall(r'\d+', line.split(':')[1])[0]) * page_size // 1048576
        elif 'Pages occupied by compressor' in line:
            stats['memory']['compressed'] = int(re.findall(r'\d+', line.split(':')[1])[0]) * page_size // 1048576
    
    total_mem = stats['memory']['active'] + stats['memory']['inactive'] + stats['memory']['wired'] + stats['memory']['free'] + stats['memory']['compressed']
    used_mem = stats['memory']['active'] + stats['memory']['wired'] + stats['memory']['compressed']
    stats['memory']['total'] = total_mem
    stats['memory']['used'] = used_mem
    stats['memory']['pct'] = int(used_mem * 100 / total_mem) if total_mem > 0 else 0
    
    # CPU
    cpu_out = run_cmd("top -l 1 -s 0 | head -5")
    stats['cpu'] = {'user': 0, 'sys': 0, 'idle': 100}
    for line in cpu_out.split('\n'):
        if 'CPU usage' in line:
            nums = re.findall(r'([\d.]+)%', line)
            if len(nums) >= 3:
                stats['cpu']['user'] = float(nums[0])
                stats['cpu']['sys'] = float(nums[1])
                stats['cpu']['idle'] = float(nums[2])
    stats['cpu']['pct'] = round(stats['cpu']['user'] + stats['cpu']['sys'], 1)
    
    # Top processes by memory
    ps_out = run_cmd("ps aux | sort -k4 -rn | head -20")
    stats['processes'] = []
    for line in ps_out.split('\n')[0:]:
        parts = line.split(None, 10)
        if len(parts) >= 11 and parts[0] != 'USER':
            try:
                stats['processes'].append({
                    'pid': int(parts[1]),
                    'cpu': float(parts[2]),
                    'mem': float(parts[3]),
                    'name': parts[10][:40]
                })
            except (ValueError, IndexError):
                pass
    
    # Network
    stats['network'] = {
        'ip': run_cmd("ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null", "disconnected"),
        'ssid': run_cmd("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null | awk '/ SSID/{print $2}'", "unknown")
    }
    
    # Battery
    batt = run_cmd("pmset -g batt")
    stats['battery'] = {'pct': 100, 'charging': False, 'source': 'AC'}
    batt_match = re.findall(r'(\d+)%', batt)
    if batt_match:
        stats['battery']['pct'] = int(batt_match[0])
    stats['battery']['charging'] = 'charging' in batt.lower() or 'AC Power' in batt
    stats['battery']['source'] = 'AC' if 'AC Power' in batt else 'Battery'
    
    # Thermal
    thermal = run_cmd("pmset -g therm 2>/dev/null")
    stats['thermal'] = {'throttled': 'speed limit' in thermal.lower()}
    
    # Uptime
    stats['uptime'] = run_cmd("uptime | sed 's/.*up //' | sed 's/,.*//'")
    
    # macOS info
    stats['os'] = {
        'version': run_cmd("sw_vers -productVersion"),
        'build': run_cmd("sw_vers -buildVersion"),
        'name': run_cmd("sw_vers -productName"),
        'arch': run_cmd("uname -m"),
        'hostname': run_cmd("hostname -s")
    }
    
    # Disk breakdown (top folders)
    stats['disk_breakdown'] = []
    breakdown = run_cmd("du -sh ~/Library/Application\\ Support/* 2>/dev/null | sort -hr | head -8")
    for line in breakdown.split('\n'):
        parts = line.split('\t', 1)
        if len(parts) == 2:
            stats['disk_breakdown'].append({'size': parts[0].strip(), 'path': parts[1].strip().split('/')[-1]})
    
    return stats

def stats_collector():
    """Background thread that collects stats every second"""
    global stats_cache
    while True:
        try:
            new_stats = collect_stats()
            with cache_lock:
                stats_cache = new_stats
        except:
            pass
        time.sleep(1)

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)
    
    def do_GET(self):
        if self.path == '/api/stats':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with cache_lock:
                self.wfile.write(json.dumps(stats_cache).encode())
            return
        
        if self.path == '/api/kill':
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error":"Use POST"}')
            return
        
        if self.path == '/api/clean':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            result = run_cmd("chinna-cli clean 2>&1 | tail -5")
            self.wfile.write(json.dumps({'result': result}).encode())
            return
        
        if self.path == '/api/purge':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            run_cmd("sudo purge 2>/dev/null")
            self.wfile.write(b'{"result":"RAM purged"}')
            return
        
        # Serve index.html for root
        if self.path == '/' or self.path == '':
            self.path = '/index.html'
        
        super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/kill':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            pid = body.get('pid')
            if pid:
                result = run_cmd(f"kill -9 {pid} 2>&1")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'killed': pid, 'result': result}).encode())
            else:
                self.send_response(400)
                self.end_headers()
            return
    
    def log_message(self, format, *args):
        pass  # Silence logs

# Start stats collector thread
collector = threading.Thread(target=stats_collector, daemon=True)
collector.start()

# Wait for first collection
time.sleep(1.5)

print(f"Chinna Dashboard: http://localhost:{PORT}")
httpd = http.server.HTTPServer(('', PORT), DashboardHandler)
httpd.serve_forever()
PYSERVER

    # Start server in background
    python3 "$CHINNA_HOME/dashboard_server.py" "$port" &
    local pid=$!
    echo "$pid" > "$DASHBOARD_PID_FILE"
    sleep 2
    
    # Open browser
    open "http://localhost:$port"
    echo "$pid"
}

stop_dashboard() {
    if [ -f "$DASHBOARD_PID_FILE" ]; then
        kill $(cat "$DASHBOARD_PID_FILE") 2>/dev/null
        rm -f "$DASHBOARD_PID_FILE"
    fi
    # Also kill any orphan servers
    pkill -f "dashboard_server.py" 2>/dev/null || true
}

is_dashboard_running() {
    [ -f "$DASHBOARD_PID_FILE" ] && kill -0 $(cat "$DASHBOARD_PID_FILE") 2>/dev/null
}
