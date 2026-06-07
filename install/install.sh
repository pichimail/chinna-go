#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CHINNA V6 — Always-Fresh installer                     ║
# ║  curl -fsSL https://raw.githubusercontent.com/          ║
# ║    pichimail/chinna-go/main/install/install.sh | bash   ║
# ╚══════════════════════════════════════════════════════════╝
set -e
REPO="pichimail/chinna-go"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
CHINNA="${CHINNA_HOME:-$HOME/.chinna}"
PORT="${CHINNA_DASHBOARD_PORT:-7777}"
STATE_FILE="${CHINNA}/.installstate"
CACHE_BUST="$(date +%s)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_SOURCE="off"
if [ -f "${REPO_ROOT}/lib/server.py" ] && [ -f "${REPO_ROOT}/dashboard/index.html" ] && [ -f "${REPO_ROOT}/bin/chinna" ]; then
    LOCAL_SOURCE="on"
fi

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   C H I N N A   V 6   —  Mac Sidekick           ║"
echo "  ║   Always-Fresh · Models · Music · WhatsApp · More║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
if [ "${LOCAL_SOURCE}" = "on" ]; then
    echo "  Source: local repo checkout (${REPO_ROOT})"
else
    echo "  Source: GitHub raw (${REPO}/${BRANCH})"
fi
echo ""

mkdir -p "${CHINNA}" "${CHINNA}/lib" "${CHINNA}/dashboard" "${CHINNA}/logs"

copy_or_fetch() {
    local rel="$1"
    local dest="$2"
    local local_path="${REPO_ROOT}/${rel}"

    mkdir -p "$(dirname "${dest}")"

    if [ "${LOCAL_SOURCE}" = "on" ] && [ -f "${local_path}" ]; then
        cp "${local_path}" "${dest}"
        return 0
    fi

    curl -fsSL \
        -H "Cache-Control: no-cache, no-store, must-revalidate" \
        -H "Pragma: no-cache" \
        -H "Expires: 0" \
        "${RAW}/${rel}?v=${CACHE_BUST}" -o "${dest}"
}

# ── One-time-setup resumable step system ─────────────────────
# Core app files (server, dashboard, CLI) are ALWAYS force-refreshed.
# Only one-time setup steps (Homebrew, CLI tools, .zshrc block) are skipped
# once they are confirmed done on this machine.
is_done()   { grep -qxF "$1" "$STATE_FILE" 2>/dev/null; }
mark_done() { echo "$1" >> "$STATE_FILE"; }
run_step()  {
    local name="$1"; shift
    if is_done "$name"; then
        echo "  ↷ Skipping (already set up): $name"
    else
        echo "  → Running: $name"
        "$@" && mark_done "$name"
    fi
}
run_refresh_step() {
    local name="$1"; shift
    echo "  → Refreshing: $name"
    "$@" && mark_done "refresh:${name}:$(date +%Y%m%d%H%M%S)"
}

# ── Step implementations ───────────────────────────────────
step_backup_zshrc() {
    if [ -f "$HOME/.zshrc" ]; then
        cp "$HOME/.zshrc" "$HOME/.zshrc.backup.$(date +%Y%m%d%H%M%S)"
        echo "    ✓ ~/.zshrc backed up"
    fi
}

step_check_python() {
    if ! command -v python3 >/dev/null 2>&1; then
        echo "  ✗ python3 is required."
        echo "    Install via: xcode-select --install  (or brew install python)"
        exit 1
    fi
    echo "    ✓ python3 $(python3 --version 2>&1 | cut -d' ' -f2)"
}

step_install_homebrew() {
    if command -v brew >/dev/null 2>&1; then
        echo "    ✓ Homebrew already installed"
        return 0
    fi
    echo "    Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>&1 | tail -3
}

step_brew_shellenv() {
    local brew_path=""
    [ -f "/opt/homebrew/bin/brew" ] && brew_path="/opt/homebrew/bin/brew"
    [ -f "/usr/local/bin/brew"    ] && brew_path="/usr/local/bin/brew"
    if [ -n "$brew_path" ]; then
        eval "$("$brew_path" shellenv)"
        if ! grep -q 'brew shellenv' "$HOME/.zshrc" 2>/dev/null; then
            echo "eval \"\$(${brew_path} shellenv)\"" >> "$HOME/.zshrc"
            echo "    ✓ brew shellenv added to .zshrc"
        fi
    fi
}

step_install_clis() {
    command -v brew >/dev/null 2>&1 || { echo "    ⚠ brew not found, skipping CLI installs"; return 0; }
    local tools=(git jq gh ripgrep fd fzf tmux watchman tree htop)
    echo "    Installing CLI tools: ${tools[*]}"
    brew install "${tools[@]}" 2>/dev/null | grep -E "✓|already|Pouring" | head -6 || true
}

step_install_node_tools() {
    command -v brew >/dev/null 2>&1 || return 0
    local tools=(node pnpm yarn bun)
    echo "    Installing node tools: ${tools[*]}"
    brew install "${tools[@]}" 2>/dev/null | grep -E "✓|already|Pouring" | head -4 || true
}

step_strict_cleanup() {
    echo "    Stopping old Chinna services..."
    pkill -9 -f dashboard_server 2>/dev/null || true
    pkill -9 -f 'dashboard_server.py' 2>/dev/null || true
    pkill -9 -f 'server.py 7777' 2>/dev/null || true
    pkill -9 -f 'whatsapp_bridge/server.js' 2>/dev/null || true

    echo "    Clearing stale app code and caches..."
    rm -f "${CHINNA}/dashboard_server.py" "${CHINNA}/lib/server.py"
    rm -rf "${CHINNA}/dashboard"
    rm -rf "${CHINNA}/extension"
    rm -rf "${CHINNA}/__pycache__" "${CHINNA}/lib/__pycache__"
    rm -f "${CHINNA}/install/chinna_v5.py" "${CHINNA}/server_v4.py"
    find "${CHINNA}" -name '*.pyc' -delete 2>/dev/null || true
    rm -rf "${HOME}/Library/Caches/com.chinna.Chinna" 2>/dev/null || true
    rm -rf "${HOME}/Library/Saved Application State/com.chinna.Chinna.savedState" 2>/dev/null || true
    mkdir -p "${CHINNA}/dashboard" "${CHINNA}/lib" "${CHINNA}/logs"
    echo "    ✓ old app code and caches cleared"
}

step_write_server() {
    echo "    ↻ Force-refreshing server (dashboard_server.py)..."
    copy_or_fetch "lib/server.py" "${CHINNA}/dashboard_server.py"
    copy_or_fetch "lib/server.py" "${CHINNA}/lib/server.py"
    echo "    ✓ server.py updated"
}

step_write_dashboard() {
    echo "    ↻ Force-refreshing dashboard (index.html)..."
    copy_or_fetch "dashboard/index.html" "${CHINNA}/dashboard/index.html"
    # Also copy dashboard assets if present
    for asset in chinna-favicon.svg chinna-icon.svg chinna-logo.svg; do
        copy_or_fetch "dashboard/assets/${asset}" "${CHINNA}/dashboard/assets/${asset}" 2>/dev/null || true
    done
    echo "    ✓ dashboard updated"
}

step_write_whatsapp_bridge() {
    echo "    ↻ Force-refreshing WhatsApp bridge..."
    mkdir -p "${CHINNA}/whatsapp_bridge"
    copy_or_fetch "whatsapp_bridge/package.json" "${CHINNA}/whatsapp_bridge/package.json"
    copy_or_fetch "whatsapp_bridge/server.js" "${CHINNA}/whatsapp_bridge/server.js"
    copy_or_fetch "whatsapp_bridge/package-lock.json" "${CHINNA}/whatsapp_bridge/package-lock.json" 2>/dev/null || true
    echo "    ✓ WhatsApp bridge updated"
}

step_write_extension() {
    echo "    ↻ Force-refreshing browser extension..."
    mkdir -p "${CHINNA}/extension/dist"
    for file in manifest.json icon.svg background.js content.js shared.css popup.html popup.css sidepanel.html sidepanel.css popup.js; do
        copy_or_fetch "extension/dist/${file}" "${CHINNA}/extension/dist/${file}" 2>/dev/null && \
            echo "      ✓ extension/dist/${file}" || \
            echo "      ⚠ extension/dist/${file} (skipped)"
    done
    echo "    ✓ browser extension updated → ${CHINNA}/extension/dist"
}

step_write_libs() {
    echo "    ↻ Force-refreshing lib files..."
    for lib in config clean stack registry notify daemon server plugins swiftbar voice lang; do
        copy_or_fetch "lib/${lib}.sh" "${CHINNA}/lib/${lib}.sh" 2>/dev/null && \
            echo "      ✓ lib/${lib}.sh" || \
            echo "      ⚠ lib/${lib}.sh (skipped)"
    done
    mkdir -p "${CHINNA}/lib/plugins"
    for plugin in _common system-health deep-clean ports-network app-control project-audit git-tools secure-chat whatsapp music-control automation storage-tools dev-runner node python godspeed-runner network-toolkit focus-power quick-serve capture-clip; do
        copy_or_fetch "lib/plugins/${plugin}.sh" "${CHINNA}/lib/plugins/${plugin}.sh" 2>/dev/null && \
            echo "      ✓ lib/plugins/${plugin}.sh" || \
            echo "      ⚠ lib/plugins/${plugin}.sh (skipped)"
    done
}

step_write_bin() {
    echo "    ↻ Force-refreshing chinna CLI..."
    mkdir -p "$HOME/.local/bin"
    copy_or_fetch "bin/chinna" "$HOME/.local/bin/chinna"
    chmod +x "$HOME/.local/bin/chinna"
    echo "    ✓ chinna CLI updated → ~/.local/bin/chinna"
}

step_write_defaults() {
    echo "6.0.0" > "${CHINNA}/VERSION"
    if [ ! -f "${CHINNA}/env" ]; then
        cat > "${CHINNA}/env" << 'ENV'
# Chinna V6 Environment (chmod 600 — never share this file)
# OPENROUTER_API_KEY=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
APPAUTOMATIONMODE=off
APPNOTIFYSOUND=/System/Library/Sounds/Glass.aiff
APPNOTIFYSPEAK=off
CHINNA_DASHBOARD_PORT=7777
ENV
        chmod 600 "${CHINNA}/env"
        echo "    ✓ env file created"
    fi
    if [ ! -f "${CHINNA}/models" ]; then
        cat > "${CHINNA}/models" << 'MODELS'
ACTIVE_MODEL="meta-llama/llama-3.3-70b-instruct:free"
MODEL_coder="openai/gpt-4o"
MODEL_reasoning="anthropic/claude-3.5-sonnet"
MODEL_small="openai/gpt-4o-mini"
MODEL_gemma="google/gemma-2-9b-it:free"
MODEL_llama70="meta-llama/llama-3.3-70b-instruct:free"
MODEL_free="meta-llama/llama-3.3-70b-instruct:free"
MODEL_sonnet4="anthropic/claude-3.5-sonnet"
MODEL_opus4="anthropic/claude-3-opus"
MODEL_haiku4="anthropic/claude-3-haiku"
MODELS
        chmod 600 "${CHINNA}/models"
        echo "    ✓ models file created"
    fi
}

step_zshrc_block() {
    local BLOCK='# ── Chinna V6 ──────────────────────────────────────────
export PATH="$HOME/.local/bin:$PATH"
export CHINNA_HOME="$HOME/.chinna"
[ -f "$CHINNA_HOME/env" ]    && source "$CHINNA_HOME/env"
[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"
alias chinna="$HOME/.local/bin/chinna"'
    if ! grep -q 'Chinna V6' "$HOME/.zshrc" 2>/dev/null; then
        echo "" >> "$HOME/.zshrc"
        echo "$BLOCK" >> "$HOME/.zshrc"
        echo "    ✓ Chinna block added to ~/.zshrc"
    else
        echo "    ✓ .zshrc block already present"
    fi
}

step_start_server() {
    pkill -9 -f dashboard_server 2>/dev/null || true
    sleep 2
    nohup python3 "${CHINNA}/dashboard_server.py" "${PORT}" \
        > "${CHINNA}/dashboard.log" 2>&1 &
    sleep 3
    if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
        VER=$(curl -sf "http://localhost:${PORT}/api/version" | \
              python3 -c "import json,sys;print(json.load(sys.stdin).get('name','Chinna V6'))" 2>/dev/null || echo "Chinna V6")
        echo "    ✓ ${VER} running on port ${PORT}"
    else
        echo "    ⚠ Server warming up — check: curl http://localhost:${PORT}/api/version"
    fi
}

# ──────────────────────────────────────────────────────────────
# ONE-TIME SETUP  (skipped if already done on this machine)
# ──────────────────────────────────────────────────────────────
run_step "backup_zshrc"       step_backup_zshrc
run_step "check_python"       step_check_python
run_step "install_homebrew"   step_install_homebrew
run_step "brew_shellenv"      step_brew_shellenv
run_step "install_clis"       step_install_clis
run_step "install_node_tools" step_install_node_tools
run_step "zshrc_block"        step_zshrc_block

# ──────────────────────────────────────────────────────────────
# ALWAYS FORCE-REFRESHED  (new + existing users get latest code)
# ──────────────────────────────────────────────────────────────
echo ""
echo "  ↻ Pulling latest V6 app files from GitHub..."
run_refresh_step "strict_cleanup"        step_strict_cleanup
run_refresh_step "write_server"          step_write_server
run_refresh_step "write_dashboard"       step_write_dashboard
run_refresh_step "write_whatsapp_bridge" step_write_whatsapp_bridge
run_refresh_step "write_extension"       step_write_extension
run_refresh_step "write_libs"            step_write_libs
run_refresh_step "write_bin"             step_write_bin
run_refresh_step "write_defaults"        step_write_defaults

# ──────────────────────────────────────────────────────────────
# RESTART SERVER
# ──────────────────────────────────────────────────────────────
run_refresh_step "start_server" step_start_server

# ── macOS notification ─────────────────────────────────────
osascript -e 'display notification "Models, Music, WhatsApp & 15 Godspeed features ready!" with title "🟢 Chinna V6 installed"' 2>/dev/null || true

echo ""
echo "  ══════════════════════════════════════════════════════"
echo "  ✅  CHINNA V6 READY!"
echo "  ══════════════════════════════════════════════════════"
echo ""
echo "  🌐  Dashboard   →  http://localhost:${PORT}"
echo "  🧩  Extension   →  ${CHINNA}/extension/dist  (load unpacked)"
echo "  📦  Share URL   →  curl -fsSL -H \"Cache-Control: no-cache\" https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash"
echo ""
echo "  Quick commands (in a new terminal tab):"
echo "    chinna doctor         → full system health check"
echo "    chinna run            → smart project runner"
echo "    chinna ai <prompt>    → AI chat"
echo "    chinna dashboard      → open dashboard"
echo "    chinna extension      → open Chrome extensions + show unpacked folder"
echo "    chinna model-set free → switch AI model"
echo "    chinna clean          → deep Mac clean"
echo "    chinna audit          → project audit"
echo ""
echo "  Re-run anytime — setup is skipped, old app code/cache is cleared, and app files are refreshed from GitHub."
echo ""

open "http://localhost:${PORT}" 2>/dev/null || true
