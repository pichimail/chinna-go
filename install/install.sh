#!/usr/bin/env bash
# Chinna V5 installer — curl -fsSL .../install/install.sh | bash
set -e
REPO="pichimail/chinna-go"; BRANCH="main"
RAW="https://raw.githubusercontent.com/$REPO/$BRANCH"
CHINNA="$HOME/.chinna"; PORT=7777
echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║   C H I N N A   V 5              ║"
echo "  ╚══════════════════════════════════╝"
echo ""
echo "  → stopping old server"
pkill -9 -f dashboard_server 2>/dev/null || true
sleep 2
mkdir -p "$CHINNA/dashboard"
echo "  → downloading server"
curl -fsSL "$RAW/lib/server.py" -o "$CHINNA/dashboard_server.py"
echo "  → downloading dashboard"
curl -fsSL "$RAW/dashboard/index.html" -o "$CHINNA/dashboard/index.html"
echo "  → starting"
nohup python3 "$CHINNA/dashboard_server.py" $PORT > "$CHINNA/dashboard.log" 2>&1 &
sleep 3
echo ""
echo "  ✅ Chinna V5 ready → http://localhost:$PORT"
echo "     stop:    pkill -f dashboard_server"
echo "     restart: python3 ~/.chinna/dashboard_server.py 7777 &"
echo ""
open "http://localhost:$PORT" 2>/dev/null || true
