#!/usr/bin/env bash
# lib/server.sh — Dashboard launcher wrapper.

DASHBOARD_PORT="${CHINNA_DASHBOARD_PORT:-7777}"
DASHBOARD_PID_FILE="$CHINNA_HOME/dashboard.pid"
DASHBOARD_SERVER="$CHINNA_HOME/dashboard_server.py"
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

    python3 "$DASHBOARD_SERVER" "$port" &
    local pid=$!
    echo "$pid" > "$DASHBOARD_PID_FILE"
    sleep 2
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
