#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CHINNA V7.0 — Always-Fresh installer                   ║
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
echo "  ║   C H I N N A   V7.0    —  Mac Sidekick         ║"
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
    local tools=(git go jq gh ripgrep fd fzf tmux watchman tree htop)
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
    for lib in config clean stack registry notify daemon server plugins swiftbar voice lang upgrade cli-ui cli-hub; do
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

step_write_go_tui() {
    echo "    ↻ Force-refreshing Go TUI files..."
    mkdir -p "${CHINNA}/cmd/chinna-tui" "${CHINNA}/cmd/chinna-escape" "${CHINNA}/tui"
    copy_or_fetch "go.mod" "${CHINNA}/go.mod"
    copy_or_fetch "go.sum" "${CHINNA}/go.sum"
    copy_or_fetch "cmd/chinna-tui/main.go" "${CHINNA}/cmd/chinna-tui/main.go"
    copy_or_fetch "cmd/chinna-escape/main.go" "${CHINNA}/cmd/chinna-escape/main.go"
    for f in anim.go api.go escape.go model.go status.go types.go; do
        copy_or_fetch "tui/${f}" "${CHINNA}/tui/${f}"
    done
    echo "    ✓ Go TUI updated → ~/.chinna"
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
    mkdir -p "$HOME/.local/bin" "${CHINNA}/bin"
    copy_or_fetch "bin/chinna" "$HOME/.local/bin/chinna"
    chmod +x "$HOME/.local/bin/chinna"
    if ! bash -n "$HOME/.local/bin/chinna"; then
        echo "    ✗ chinna CLI failed syntax check — refusing to leave a broken install" >&2
        exit 1
    fi
    ln -sf "$HOME/.local/bin/chinna" "${CHINNA}/bin/chinna"
    echo "    ✓ chinna CLI updated → ~/.local/bin/chinna"
}

step_link_chinna_path() {
    local canonical="$HOME/.local/bin/chinna"
    local linked=0
    for dir in /usr/local/bin /opt/homebrew/bin; do
        [ -d "$dir" ] || continue
        if ln -sf "$canonical" "$dir/chinna" 2>/dev/null; then
            linked=1
            echo "    ✓ linked $dir/chinna → ~/.local/bin/chinna"
            continue
        fi
        if command -v sudo >/dev/null 2>&1 && sudo -n ln -sf "$canonical" "$dir/chinna" 2>/dev/null; then
            linked=1
            echo "    ✓ linked $dir/chinna → ~/.local/bin/chinna (sudo)"
        fi
    done
    if [ "$linked" -eq 0 ]; then
        echo "    ✓ PATH uses ~/.local/bin/chinna"
    fi
}

step_write_defaults() {
    echo "7.0.0" > "${CHINNA}/VERSION"
    copy_or_fetch "version-log.json" "${CHINNA}/version-log.json" 2>/dev/null || true
    if [ ! -f "${CHINNA}/env" ]; then
        cat > "${CHINNA}/env" << 'ENV'
# Chinna V6.9 Environment (chmod 600 — never share this file)
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
ACTIVE_MODEL="openrouter/free"
MODEL_coder="anthropic/claude-3.5-sonnet"
MODEL_reasoning="anthropic/claude-3.5-sonnet"
MODEL_small="google/gemini-2.5-flash"
MODEL_gemma="google/gemini-2.5-flash"
MODEL_llama70="openrouter/free"
MODEL_free="openrouter/free"
MODEL_sonnet="anthropic/claude-3.5-sonnet"
MODEL_gemini_pro="google/gemini-2.5-pro"
MODEL_gemini_flash="google/gemini-2.5-flash"
MODEL_auto="openrouter/auto"
MODELS
        chmod 600 "${CHINNA}/models"
        echo "    ✓ models file created (default: chinna/free)"
    else
        # Migrate legacy defaults to openrouter/free for free-tier chatting
        if grep -q 'ACTIVE_MODEL="openrouter/auto"' "${CHINNA}/models" 2>/dev/null \
           || grep -q 'ACTIVE_MODEL="meta-llama/llama-3.3-70b-instruct:free"' "${CHINNA}/models" 2>/dev/null \
           || grep -q 'ACTIVE_MODEL="openai/gpt-4o-mini"' "${CHINNA}/models" 2>/dev/null; then
            sed -i '' 's/^ACTIVE_MODEL=.*/ACTIVE_MODEL="openrouter\/free"/' "${CHINNA}/models" 2>/dev/null \
                || sed -i 's/^ACTIVE_MODEL=.*/ACTIVE_MODEL="openrouter\/free"/' "${CHINNA}/models"
            echo "    ✓ default model migrated to chinna/free (openrouter/free)"
        fi
        if ! grep -q '^MODEL_free=' "${CHINNA}/models" 2>/dev/null; then
            echo 'MODEL_free="openrouter/free"' >> "${CHINNA}/models"
        fi
    fi
}

step_zshrc_block() {
    local zshrc="$HOME/.zshrc"
    local begin='# ── Chinna CLI (managed by install.sh — do not edit) ──'
    local end='# ── /Chinna CLI ──'
    touch "$zshrc"

    python3 - "$zshrc" "$begin" "$end" <<'PY'
import pathlib, re, sys

zshrc = pathlib.Path(sys.argv[1])
begin, end = sys.argv[2], sys.argv[3]
text = zshrc.read_text() if zshrc.exists() else ""

managed = re.compile(
    re.escape(begin) + r".*?" + re.escape(end) + r"\n?",
    re.S,
)
text = managed.sub("", text)

legacy = re.compile(
    r"# ── Chinna V\d.*?(?=\n# ──|\n\nexport |\Z)",
    re.S,
)
text = legacy.sub("", text)
text = re.sub(r"\nalias chinna=.*\n", "\n", text)

block = f"""
{begin}
export PATH="$HOME/.local/bin:$PATH"
export CHINNA_HOME="$HOME/.chinna"
[ -f "$CHINNA_HOME/env" ]    && source "$CHINNA_HOME/env"
[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"
# Shell function always hits the latest CLI (no hash -r needed).
unalias chinna 2>/dev/null || true
chinna() {{
  "$HOME/.local/bin/chinna" "$@"
}}
{end}
"""

if not text.endswith("\n"):
    text += "\n"
zshrc.write_text(text + block)
PY

    echo "    ✓ ~/.zshrc Chinna CLI block refreshed (chinna opens TUI directly)"
}

step_start_server() {
    pkill -9 -f dashboard_server 2>/dev/null || true
    sleep 2
    nohup python3 "${CHINNA}/dashboard_server.py" "${PORT}" \
        > "${CHINNA}/dashboard.log" 2>&1 &
    sleep 3
    if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
        VER=$(curl -sf "http://localhost:${PORT}/api/version" | \
              python3 -c "import json,sys;print(json.load(sys.stdin).get('name','Chinna V6.9'))" 2>/dev/null || echo "Chinna V6.9")
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

# ──────────────────────────────────────────────────────────────
# ALWAYS FORCE-REFRESHED  (new + existing users get latest code)
# ──────────────────────────────────────────────────────────────
echo ""
echo "  ↻ Pulling latest V7.0 app files..."
step_write_server
step_write_dashboard
step_write_whatsapp_bridge
step_write_libs
step_write_go_tui
step_write_bin
step_link_chinna_path
step_zshrc_block
step_write_defaults

# ──────────────────────────────────────────────────────────────
# RESTART SERVER
# ──────────────────────────────────────────────────────────────
step_write_extension
step_start_server

# ── macOS notification ─────────────────────────────────────
osascript -e 'display notification "Chinna v7 ready — run chinna for the escape intro!" with title "🟢 Chinna V7.0 installed"' 2>/dev/null || true

echo ""
echo "  ══════════════════════════════════════════════════════"
echo "  ✅  CHINNA V7.0 READY!"
echo "  ══════════════════════════════════════════════════════"
echo ""
echo "  🌐  Dashboard   →  http://localhost:${PORT}"
echo "  📦  Install URL  →  curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash"
echo ""
echo "  Quick commands:"
echo "    chinna                  → ~30s containment escape intro + TUI (s to skip)"
echo "    source ~/.zshrc         → activate chinna in this terminal (once)"
echo "    chinna escape           → standalone escape animation in Terminal"
echo "    chinna doctor           → full system health check"
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
