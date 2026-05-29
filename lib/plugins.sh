#!/usr/bin/env bash
# lib/plugins.sh — Chinna Plugin Loader System (Godspeed-inspired)

CHINNA_PLUGINS_DIR="$CHINNA_HOME/plugins"

# Ensure plugins directory exists
mkdir -p "$CHINNA_PLUGINS_DIR"

load_plugin() {
    local name="$1"
    local plugin_file="$CHINNA_PLUGINS_DIR/${name}.sh"

    if [ ! -f "$plugin_file" ]; then
        # Also check the installed lib/plugins if user hasn't copied yet
        if [ -f "$CHINNA_LIB/plugins/${name}.sh" ]; then
            plugin_file="$CHINNA_LIB/plugins/${name}.sh"
        else
            fail "Plugin '$name' not found in $CHINNA_PLUGINS_DIR or $CHINNA_LIB/plugins"
            return 1
        fi
    fi

    # Basic security: check for obvious dangerous patterns (can be expanded)
    if grep -qE 'rm -rf /|sudo rm|curl .*\| bash|wget .*\| sh' "$plugin_file"; then
        warn "Plugin '$name' contains potentially dangerous commands. Load anyway? (y/N)"
        read -r ans
        [[ "$ans" =~ ^[Yy]$ ]] || return 1
    fi

    echo "  → Loading plugin: $name"
    # shellcheck disable=SC1090
    source "$plugin_file"

    # Call optional hook
    if declare -f gs_plugin_prepare >/dev/null; then
        gs_plugin_prepare
    fi
}

plugins_list() {
    echo "Installed plugins in $CHINNA_PLUGINS_DIR:"
    if [ -d "$CHINNA_PLUGINS_DIR" ]; then
        find "$CHINNA_PLUGINS_DIR" -name "*.sh" -exec basename {} .sh \; | sort | sed 's/^/  • /'
    else
        echo "  (no plugins directory)"
    fi

    echo ""
    echo "Built-in plugins (from lib):"
    if [ -d "$CHINNA_LIB/plugins" ]; then
        find "$CHINNA_LIB/plugins" -name "*.sh" -exec basename {} .sh \; 2>/dev/null | sort | sed 's/^/  • /'
    else
        echo "  (none)"
    fi
}

# Hook into existing bootstrap
bootstrap_here() {
    local dir="${1:-.}"
    echo "Bootstrapping project in $dir..."

    # Run original stack setup if it exists
    if declare -f run_project_by_name >/dev/null; then
        local stack
        stack=$(detect_stack "$dir")
        echo "  Detected stack: $stack"
    fi

    # Load matching plugin if one exists
    local plugin_name
    case "$stack" in
        node-next|node-vite|sveltekit) plugin_name="node" ;;
        python*) plugin_name="python" ;;
        *) plugin_name="" ;;
    esac

    if [ -n "$plugin_name" ]; then
        load_plugin "$plugin_name" 2>/dev/null || true
        if declare -f gs_plugin_prepare >/dev/null; then
            (cd "$dir" && gs_plugin_prepare)
        fi
    fi

    echo "Bootstrap complete."
}