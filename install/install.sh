#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CHINNA V6 — One-line installer (Resumable)             ║
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

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   C H I N N A   V 6   —  Mac Sidekick           ║"
echo "  ║   Resumable · Models · Music · WhatsApp · More   ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

mkdir -p "${CHINNA}" "${CHINNA}/lib" "${CHINNA}/dashboard" "${CHINNA}/logs"

# ── Resumable step system (Prompt 14) ──────────────────────
is_done()   { grep -qxF "$1" "$STATE_FILE" 2>/dev/null; }
mark_done() { echo "$1" >> "$STATE_FILE"; }
run_step()  {
    local name="$1"; shift
    if is_done "$name"; then
        echo "  ↷ Skipping (already done): $name"
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
    local tools=(pnpm yarn bun)
    echo "    Installing node tools: ${tools[*]}"
    brew install "${tools[@]}" 2>/dev/null | grep -E "✓|already|Pouring" | head -4 || true
}

step_write_server() {
    echo "    Downloading server (1891 lines)..."
    curl -fsSL "${RAW}/lib/server.py" -o "${CHINNA}/dashboard_server.py"
    echo "    ✓ server.py written"
}

step_write_dashboard() {
    echo "    Downloading dashboard (115KB)..."
    curl -fsSL "${RAW}/dashboard/index.html" -o "${CHINNA}/dashboard/index.html"
    echo "    ✓ index.html written"
}

step_write_libs() {
    echo "    Downloading lib files..."
    for lib in config clean stack registry notify daemon server plugins voice lang; do
        curl -fsSL "${RAW}/lib/${lib}.sh" -o "${CHINNA}/lib/${lib}.sh" 2>/dev/null && \
            echo "      ✓ lib/${lib}.sh" || \
            echo "      ⚠ lib/${lib}.sh (skipped)"
    done
}

step_write_bin() {
    echo "    Installing chinna CLI..."
    mkdir -p "$HOME/.local/bin"
    curl -fsSL "${RAW}/bin/chinna" -o "$HOME/.local/bin/chinna"
    chmod +x "$HOME/.local/bin/chinna"
    echo "    ✓ chinna installed to ~/.local/bin/chinna"
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

# ── Run all steps (resumable) ──────────────────────────────
run_step "backup_zshrc"       step_backup_zshrc
run_step "check_python"       step_check_python
run_step "install_homebrew"   step_install_homebrew
run_step "brew_shellenv"      step_brew_shellenv
run_step "install_clis"       step_install_clis
run_step "install_node_tools" step_install_node_tools
run_step "write_server"       step_write_server
run_step "write_dashboard"    step_write_dashboard
run_step "write_libs"         step_write_libs
run_step "write_bin"          step_write_bin
run_step "write_defaults"     step_write_defaults
run_step "zshrc_block"        step_zshrc_block
run_step "start_server"       step_start_server

# ── macOS notification ─────────────────────────────────────
osascript -e 'display notification "Models, Music, WhatsApp & 15 Godspeed features ready!" with title "🟢 Chinna V6 installed"' 2>/dev/null || true

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
echo "  Re-run installer anytime — completed steps are skipped."
echo ""

open "http://localhost:${PORT}" 2>/dev/null || true
