#!/usr/bin/env bash
# lib/server.sh — Dashboard launcher wrapper.

DASHBOARD_PORT="${CHINNA_DASHBOARD_PORT:-7777}"
DASHBOARD_PID_FILE="$CHINNA_HOME/dashboard.pid"
DASHBOARD_SERVER="$CHINNA_HOME/dashboard_server.py"
DASHBOARD_LOG_FILE="$CHINNA_HOME/dashboard_server.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

start_dashboard() {
    local port="$DASHBOARD_PORT"
    stop_dashboard 2>/dev/null

    mkdir -p "$CHINNA_HOME/dashboard"

    if [ -f "$SCRIPT_DIR/server.py" ]; then
        cp "$SCRIPT_DIR/server.py" "$DASHBOARD_SERVER"
    elif [ ! -f "$DASHBOARD_SERVER" ]; then
        echo "Dashboard server source missing: $DASHBOARD_SERVER" >&2
        return 1
    fi

    # Ensure the dashboard HTML exists where the server expects it.
    if [ -f "$SCRIPT_DIR/../dashboard/index.html" ]; then
        cp "$SCRIPT_DIR/../dashboard/index.html" "$CHINNA_HOME/dashboard/index.html" 2>/dev/null || true
    fi

    if [ -d "$SCRIPT_DIR/../dashboard/assets" ]; then
        mkdir -p "$CHINNA_HOME/dashboard/assets"
        cp "$SCRIPT_DIR/../dashboard/assets/"*.svg "$CHINNA_HOME/dashboard/assets/" 2>/dev/null || true
    fi

    if [ -d "$SCRIPT_DIR/../whatsapp_bridge" ]; then
        mkdir -p "$CHINNA_HOME/whatsapp_bridge"
        cp "$SCRIPT_DIR/../whatsapp_bridge/package.json" "$SCRIPT_DIR/../whatsapp_bridge/server.js" "$CHINNA_HOME/whatsapp_bridge/" 2>/dev/null || true
        [ -f "$SCRIPT_DIR/../whatsapp_bridge/package-lock.json" ] && cp "$SCRIPT_DIR/../whatsapp_bridge/package-lock.json" "$CHINNA_HOME/whatsapp_bridge/" 2>/dev/null || true
    fi

    if command -v setsid >/dev/null 2>&1; then
        setsid python3 "$DASHBOARD_SERVER" "$port" >>"$DASHBOARD_LOG_FILE" 2>&1 < /dev/null &
    else
        nohup python3 "$DASHBOARD_SERVER" "$port" >>"$DASHBOARD_LOG_FILE" 2>&1 < /dev/null &
    fi
    local pid=$!
    echo "$pid" > "$DASHBOARD_PID_FILE"
    sleep 1
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "Dashboard failed to start. Check: $DASHBOARD_LOG_FILE" >&2
        rm -f "$DASHBOARD_PID_FILE"
        return 1
    fi
    sleep 1
    open "http://localhost:$port" 2>/dev/null || true
    echo "$pid"
}

stop_dashboard() {
    if [ -f "$DASHBOARD_PID_FILE" ]; then
        kill "$(cat "$DASHBOARD_PID_FILE")" 2>/dev/null || true
        rm -f "$DASHBOARD_PID_FILE"
    fi
    pkill -f "dashboard_server.py" 2>/dev/null || true
}

is_dashboard_running() {
    [ -f "$DASHBOARD_PID_FILE" ] && kill -0 "$(cat "$DASHBOARD_PID_FILE")" 2>/dev/null
}
