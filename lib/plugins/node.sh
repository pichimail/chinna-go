#!/usr/bin/env bash
# Example Chinna Plugin: node
# Implements gs_plugin_prepare() and gs_plugin_run()

gs_plugin_prepare() {
    local dir="${1:-.}"
    echo "  [node plugin] Preparing Node.js project in $dir"

    local pm
    pm=$(detect_pm "$dir")

    echo "  → Using package manager: $pm"

    if [ -f "$dir/package.json" ]; then
        echo "  → Installing dependencies..."
        (cd "$dir" && $pm install --silent 2>/dev/null) &
        spinner $! "Installing dependencies with $pm"
        ok "Dependencies installed"
    fi

    # Prisma support
    if [ -f "$dir/prisma/schema.prisma" ]; then
        echo "  → Running Prisma generate + migrate..."
        (cd "$dir" && npx prisma generate --silent && npx prisma migrate deploy 2>/dev/null || true) &
        spinner $! "Prisma setup"
    fi

    # Next.js / Vite / SvelteKit specific
    if [ -f "$dir/next.config.js" ] || [ -f "$dir/next.config.mjs" ]; then
        echo "  → Detected Next.js project"
    fi
}

gs_plugin_run() {
    local dir="${1:-.}"
    local port="${2:-3000}"

    local pm
    pm=$(detect_pm "$dir")

    local cmd=""
    if [ -f "$dir/package.json" ]; then
        # Try to detect the right dev command
        if command -v jq >/dev/null 2>&1; then
            if jq -e '.scripts.dev' package.json >/dev/null 2>&1; then
                cmd="$pm run dev -- --port $port"
            fi
        fi
    fi

    if [ -z "$cmd" ]; then
        cmd="$pm run dev -- --port $port"
    fi

    echo "  [node plugin] Starting dev server: $cmd"
    (cd "$dir" && eval "$cmd" > /tmp/chinna-plugin-node-$$.log 2>&1) &
    local pid=$!

    echo "  Server started (PID: $pid). Log: /tmp/chinna-plugin-node-$$.log"
    echo "$pid" > /tmp/chinna-current-plugin.pid
}

# Optional: tell the runner what port this plugin prefers
gs_plugin_port() {
    echo "3000"
}