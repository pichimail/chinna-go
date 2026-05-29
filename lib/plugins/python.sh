#!/usr/bin/env bash
# Example Chinna Plugin: python
# Implements gs_plugin_prepare() and gs_plugin_run()

gs_plugin_prepare() {
    local dir="${1:-.}"
    echo "  [python plugin] Preparing Python project in $dir"

    if [ -f "$dir/requirements.txt" ] || [ -f "$dir/pyproject.toml" ]; then
        if [ ! -d "$dir/.venv" ]; then
            echo "  → Creating virtual environment..."
            (cd "$dir" && python3 -m venv .venv) &
            spinner $! "Creating .venv"
        fi

        echo "  → Installing Python dependencies..."
        (cd "$dir" && source .venv/bin/activate && pip install -q -r requirements.txt 2>/dev/null || pip install -q -e . 2>/dev/null || true) &
        spinner $! "Installing dependencies"
        ok "Python environment ready"
    fi
}

gs_plugin_run() {
    local dir="${1:-.}"
    local port="${2:-8000}"

    echo "  [python plugin] Starting Python dev server on port $port"

    local cmd=""

    if [ -f "$dir/main.py" ] || [ -f "$dir/app.py" ]; then
        if grep -q "fastapi" "$dir/requirements.txt" 2>/dev/null || grep -q "from fastapi" "$dir/main.py" 2>/dev/null; then
            cmd=".venv/bin/uvicorn main:app --reload --port $port --host 0.0.0.0"
        elif [ -f "$dir/manage.py" ]; then
            cmd=".venv/bin/python manage.py runserver 0.0.0.0:$port"
        else
            cmd=".venv/bin/python app.py --port $port"
        fi
    fi

    if [ -z "$cmd" ]; then
        cmd=".venv/bin/python -m http.server $port"
    fi

    echo "  Running: $cmd"
    (cd "$dir" && eval "$cmd" > /tmp/chinna-plugin-python-$$.log 2>&1) &
    local pid=$!

    echo "  Server started (PID: $pid)"
    echo "$pid" > /tmp/chinna-current-plugin.pid
}

gs_plugin_port() {
    echo "8000"
}