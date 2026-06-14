#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CHINNA V6.7 — Always-Fresh installer                   ║
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_SOURCE="off"
if [ -f "${REPO_ROOT}/lib/server.py" ] && [ -f "${REPO_ROOT}/dashboard/index.html" ] && [ -f "${REPO_ROOT}/bin/chinna" ]; then
    LOCAL_SOURCE="on"
fi

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   C H I N N A   V6.7    —  Mac Sidekick         ║"
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

    curl -fsSL "${RAW}/${rel}" -o "${dest}"
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

step_write_server() {
    echo "    ↻ Force-refreshing server (dashboard_server.py)..."
    copy_or_fetch "lib/server.py" "${CHINNA}/dashboard_server.py"
    copy_or_fetch "lib/forge.py" "${CHINNA}/forge.py"
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

step_write_extension() {
    echo "    ↻ Installing browser extension files..."
    mkdir -p "${CHINNA}/extension/icons"
    for f in manifest.json background.js sidepanel.html sidepanel.js sidepanel.css INSTALL.md install-extension.sh; do
        copy_or_fetch "extension/$f" "${CHINNA}/extension/$f" 2>/dev/null || true
    done
    for i in 16 48 128; do
        copy_or_fetch "extension/icons/icon${i}.png" "${CHINNA}/extension/icons/icon${i}.png" 2>/dev/null || true
    done
    echo "    ✓ Extension at ~/.chinna/extension (load unpacked in chrome://extensions)"
}

step_write_bin() {
    echo "    ↻ Force-refreshing chinna CLI..."
    mkdir -p "$HOME/.local/bin"
    copy_or_fetch "bin/chinna" "$HOME/.local/bin/chinna"
    chmod +x "$HOME/.local/bin/chinna"
    echo "    ✓ chinna CLI updated → ~/.local/bin/chinna"
}

step_write_defaults() {
    echo "6.7.0" > "${CHINNA}/VERSION"
    if [ ! -f "${CHINNA}/env" ]; then
        cat > "${CHINNA}/env" << 'ENV'
# Chinna V6.7 Environment (chmod 600 — never share this file)
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
    local BLOCK='# ── Chinna V6.7 ────────────────────────────────────────
export PATH="$HOME/.local/bin:$PATH"
export CHINNA_HOME="$HOME/.chinna"
[ -f "$CHINNA_HOME/env" ]    && source "$CHINNA_HOME/env"
[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"
alias chinna="$HOME/.local/bin/chinna"'
    if ! grep -q 'Chinna V6.7' "$HOME/.zshrc" 2>/dev/null; then
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
              python3 -c "import json,sys;print(json.load(sys.stdin).get('name','Chinna V6.7'))" 2>/dev/null || echo "Chinna V6.7")
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
step_write_server
step_write_dashboard
step_write_whatsapp_bridge
step_write_libs
step_write_bin
step_write_defaults

# ──────────────────────────────────────────────────────────────
# RESTART SERVER
# ──────────────────────────────────────────────────────────────
step_write_extension
step_start_server

# ── macOS notification ─────────────────────────────────────
osascript -e 'display notification "Models, Music, WhatsApp & 15 Godspeed features ready!" with title "🟢 Chinna V6.7 installed"' 2>/dev/null || true

echo ""
echo "  ══════════════════════════════════════════════════════"
echo "  ✅  CHINNA V6 READY!"
echo "  ══════════════════════════════════════════════════════"
echo ""
echo "  🌐  Dashboard   →  http://localhost:${PORT}"
echo "  📦  Share URL   →  curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash"
echo ""
echo "  Quick commands (in a new terminal tab):"
echo "    chinna doctor         → full system health check"
echo "    chinna run            → smart project runner"
echo "    chinna ai <prompt>    → AI chat"
echo "    chinna dashboard      → open dashboard"
echo "    chinna model-set free → switch AI model"
echo "    chinna clean          → deep Mac clean"
echo "    chinna audit          → project audit"
echo ""
echo "  Re-run anytime — one-time setup is skipped, app code is always refreshed."
echo ""

open "http://localhost:${PORT}" 2>/dev/null || true
