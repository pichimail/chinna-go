#!/usr/bin/env bash
# Shared SwiftBar quick action installer for Chinna.

install_chinna_swiftbar_actions() {
    local plugin_dir="$HOME/Library/Application Support/SwiftBar/Plugins"
    local plugin_path="$plugin_dir/chinna.1m.sh"
    local chinna_bin dash_url
    chinna_bin="$(command -v chinna 2>/dev/null || true)"
    [ -n "$chinna_bin" ] || chinna_bin="$HOME/.local/bin/chinna"
    [ -x "$chinna_bin" ] || chinna_bin="${CHINNA_HOME:-$HOME/.chinna}/bin/chinna"
    dash_url="http://localhost:${CHINNA_DASHBOARD_PORT:-7777}"

    mkdir -p "$plugin_dir"
    cat > "$plugin_path" <<PLUGIN
#!/usr/bin/env bash
CHINNA_BIN="${chinna_bin}"
DASH_URL="${dash_url}"
echo "CH"
echo "---"
echo "🏠 Open Dashboard | bash='open' param1="\$DASH_URL" terminal=false refresh=false"
echo "🧩 Plugins | bash='open' param1="\$DASH_URL/#plugins" terminal=false refresh=false"
echo "💬 WhatsApp QR / Chat | bash='open' param1="\$DASH_URL/#whatsapp" terminal=false refresh=false"
echo "🛡 Secure Chat | bash='open' param1="\$DASH_URL/#chatx" terminal=false refresh=false"
echo "🍎 macOS Tools | bash='open' param1="\$DASH_URL/#macos" terminal=false refresh=false"
echo "---"
echo "🧩 Plugin Actions"
echo "--🩺 System Doctor | bash="\$CHINNA_BIN" param1='doctor' terminal=false refresh=false"
echo "--🧹 Deep Clean | bash="\$CHINNA_BIN" param1='clean' terminal=false refresh=true"
echo "--⚡ Purge RAM | bash="\$CHINNA_BIN" param1='purge' terminal=false refresh=true"
echo "--▦ Storage Explorer | bash='open' param1="\$DASH_URL/#storage" terminal=false refresh=false"
echo "--🌐 Network Ports | bash='open' param1="\$DASH_URL/#network" terminal=false refresh=false"
echo "--📋 Projects | bash='open' param1="\$DASH_URL/#projects" terminal=false refresh=false"
echo "---"
echo "♫ Music"
echo "--▶ Play | bash='osascript' param1='-e' param2='tell application \"Music\" to play' terminal=false refresh=false"
echo "--⏸ Pause | bash='osascript' param1='-e' param2='tell application \"Music\" to pause' terminal=false refresh=false"
echo "--⏭ Next | bash='osascript' param1='-e' param2='tell application \"Music\" to next track' terminal=false refresh=false"
echo "--⏮ Previous | bash='osascript' param1='-e' param2='tell application \"Music\" to previous track' terminal=false refresh=false"
echo "---"
echo "⚙ Control"
echo "--🚀 Start Auto-Start | bash="\$CHINNA_BIN" param1='start' terminal=false refresh=true"
echo "--⏹ Stop Auto-Start | bash="\$CHINNA_BIN" param1='stop' terminal=false refresh=true"
echo "--📱 Install / Refresh Chinna.app | bash="\$CHINNA_BIN" param1='app-install' terminal=false refresh=false"
echo "--📍 Refresh SwiftBar Actions | bash="\$CHINNA_BIN" param1='notch' terminal=false refresh=true"
echo "--⬆️ Update Chinna | bash="\$CHINNA_BIN" param1='update' param2='--apply' terminal=false refresh=true"
echo "--⛔ Quit Chinna | bash="\$CHINNA_BIN" param1='stop' terminal=false refresh=true"
PLUGIN
    chmod +x "$plugin_path"
    printf '%s\n' "$plugin_path"
}

install_notch_quick_actions() {
    if ! command -v swiftbar >/dev/null 2>&1 && [ ! -d "/Applications/SwiftBar.app" ]; then
        log "SwiftBar not installed; notch/menu quick actions unavailable"
        return 1
    fi
    install_chinna_swiftbar_actions >/dev/null || return 1
    log "SwiftBar quick actions installed"
    return 0
}
