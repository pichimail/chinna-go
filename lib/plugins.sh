#!/usr/bin/env bash
# lib/plugins.sh — Chinna Plugin Loader System (Godspeed-inspired)

CHINNA_PLUGINS_DIR="$CHINNA_HOME/plugins"

# Ensure plugins directory exists
mkdir -p "$CHINNA_PLUGINS_DIR"

_plugin_file() {
    local name="$1"
    local user_file="$CHINNA_PLUGINS_DIR/${name}.sh"
    local builtin_file="$CHINNA_LIB/plugins/${name}.sh"
    if [ -f "$user_file" ]; then
        printf '%s\n' "$user_file"
    elif [ -f "$builtin_file" ]; then
        printf '%s\n' "$builtin_file"
    else
        return 1
    fi
}

load_plugin() {
    local name="$1"
    local plugin_file
    if ! plugin_file="$(_plugin_file "$name")"; then
        fail "Plugin '$name' not found in $CHINNA_PLUGINS_DIR or $CHINNA_LIB/plugins"
        return 1
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

plugin_meta() {
    local name="$1" plugin_file
    plugin_file="$(_plugin_file "$name")" || return 1
    (
        # shellcheck disable=SC1090
        source "$plugin_file"
        if declare -f gs_plugin_meta >/dev/null; then
            gs_plugin_meta
        else
            printf '{"id":"%s","name":"%s","icon":"◇","description":"Chinna plugin","category":"General"}\n' "$name" "$name"
        fi
    )
}

plugin_actions() {
    local name="$1" plugin_file
    plugin_file="$(_plugin_file "$name")" || return 1
    (
        # shellcheck disable=SC1090
        source "$plugin_file"
        if declare -f gs_plugin_actions >/dev/null; then
            gs_plugin_actions
        else
            printf '[]\n'
        fi
    )
}

plugin_run_action() {
    local name="$1" action="$2" payload="${3:-{}}" plugin_file
    plugin_file="$(_plugin_file "$name")" || return 1
    (
        export GS_PLUGIN_PAYLOAD="$payload"
        # shellcheck disable=SC1090
        source "$plugin_file"
        if declare -f gs_plugin_run_action >/dev/null; then
            gs_plugin_run_action "$action" "$payload"
        else
            printf '{"error":"plugin has no action handler"}\n'
            return 1
        fi
    )
}

plugins_list() {
    echo "Installed plugins in $CHINNA_PLUGINS_DIR:"
    if [ -d "$CHINNA_PLUGINS_DIR" ]; then
        find "$CHINNA_PLUGINS_DIR" -name "*.sh" ! -name '_*.sh' -exec basename {} .sh \; | sort | sed 's/^/  • /'
    else
        echo "  (no plugins directory)"
    fi

    echo ""
    echo "Built-in plugins (from lib):"
    if [ -d "$CHINNA_LIB/plugins" ]; then
        find "$CHINNA_LIB/plugins" -name "*.sh" ! -name '_*.sh' -exec basename {} .sh \; 2>/dev/null | sort | sed 's/^/  • /'
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
