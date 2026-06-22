#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║  CHINNA V7.0 — Always-Fresh installer                   ║
# ║  curl -fsSL https://raw.githubusercontent.com/          ║
# ║    pichimail/chinna-go/main/install/install.sh | bash   ║
# ╚══════════════════════════════════════════════════════════╝
set -Eeuo pipefail

REPO="pichimail/chinna-go"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
CHINNA="${CHINNA_HOME:-$HOME/.chinna}"
PORT="${CHINNA_DASHBOARD_PORT:-7777}"
STATE_FILE="${CHINNA}/.installstate"

# Safe for both: direct local execution and `curl ... | bash`.
SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
REPO_ROOT=""
if [ -n "${SCRIPT_SOURCE}" ] && [ -f "${SCRIPT_SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

LOCAL_SOURCE="off"
if [ -n "${REPO_ROOT}" ] && [ -f "${REPO_ROOT}/lib/server.py" ] && [ -f "${REPO_ROOT}/dashboard/index.html" ] && [ -f "${REPO_ROOT}/bin/chinna" ]; then
  LOCAL_SOURCE="on"
fi

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   C H I N N A   V7.0    —  Mac Sidekick         ║"
echo "  ║   Always-Fresh · Models · Media · WhatsApp · More║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
if [ "${LOCAL_SOURCE}" = "on" ]; then
  echo "  Source: local repo checkout (${REPO_ROOT})"
else
  echo "  Source: GitHub raw (${REPO}/${BRANCH})"
fi
echo ""

mkdir -p "${CHINNA}" "${CHINNA}/lib" "${CHINNA}/dashboard" "${CHINNA}/logs" "${CHINNA}/state"

copy_or_fetch() {
  local rel="$1"
  local dest="$2"
  local local_path=""
  if [ -n "${REPO_ROOT:-}" ]; then
    local_path="${REPO_ROOT}/${rel}"
  fi
  mkdir -p "$(dirname "${dest}")"
  if [ "${LOCAL_SOURCE}" = "on" ] && [ -n "${local_path}" ] && [ -f "${local_path}" ]; then
    cp "${local_path}" "${dest}"
    return 0
  fi
  curl -fsSL "${RAW}/${rel}" -o "${dest}"
}

is_done()   { grep -qxF "$1" "$STATE_FILE" 2>/dev/null; }
mark_done() { grep -qxF "$1" "$STATE_FILE" 2>/dev/null || echo "$1" >> "$STATE_FILE"; }
clear_done(){ [ -f "$STATE_FILE" ] && grep -vxF "$1" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null && mv "${STATE_FILE}.tmp" "$STATE_FILE" || true; }

run_step() {
  local name="$1"
  shift
  if is_done "$name"; then
    echo "  ↷ Skipping (already set up): $name"
  else
    echo "  → Running: $name"
    "$@" && mark_done "$name"
  fi
}

run_verified_step() {
  local name="$1"
  shift
  local verify_fn="$1"
  shift
  if is_done "$name" && "$verify_fn" >/dev/null 2>&1; then
    echo "  ↷ Skipping (already set up): $name"
    return 0
  fi
  if is_done "$name"; then
    echo "  ↻ Re-running: $name (previous setup no longer verified)"
    clear_done "$name"
  else
    echo "  → Running: $name"
  fi
  "$@" && "$verify_fn" >/dev/null 2>&1 && mark_done "$name"
}

brew_bin() {
  if command -v brew >/dev/null 2>&1; then command -v brew; return 0; fi
  [ -x "/opt/homebrew/bin/brew" ] && { echo "/opt/homebrew/bin/brew"; return 0; }
  [ -x "/usr/local/bin/brew" ] && { echo "/usr/local/bin/brew"; return 0; }
  return 1
}
verify_brew() { local b; b="$(brew_bin)" || return 1; "$b" --version >/dev/null 2>&1; }

step_backup_zshrc() {
  if [ -f "$HOME/.zshrc" ]; then
    cp "$HOME/.zshrc" "$HOME/.zshrc.backup.$(date +%Y%m%d%H%M%S)"
    echo "    ✓ ~/.zshrc backed up"
  fi
}

step_check_python() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "  ✗ python3 is required. Install via: xcode-select --install"
    exit 1
  fi
  echo "    ✓ python3 $(python3 --version 2>&1 | cut -d' ' -f2)"
}

step_install_homebrew() {
  if verify_brew; then echo "    ✓ Homebrew already installed: $(brew_bin)"; return 0; fi
  echo "    Installing Homebrew..."
  local install_cmd='/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  local log_file="${CHINNA}/logs/homebrew-install.$(date +%Y%m%d%H%M%S).log"
  if env NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" >"$log_file" 2>&1; then
    step_brew_shellenv
    verify_brew && { echo "    ✓ Homebrew installed"; return 0; }
  fi
  echo "    ⚠ Non-interactive Homebrew install did not complete."
  echo "    Homebrew needs an Administrator password on a fresh Mac."
  echo "    Run this once, then re-run Chinna installer:"
  echo "      $install_cmd"
  echo "    Continuing Chinna install without brew packages."
  return 1
}

step_brew_shellenv() {
  local brew_path=""
  brew_path="$(brew_bin 2>/dev/null || true)"
  [ -z "$brew_path" ] && [ -x "/opt/homebrew/bin/brew" ] && brew_path="/opt/homebrew/bin/brew"
  [ -z "$brew_path" ] && [ -x "/usr/local/bin/brew" ] && brew_path="/usr/local/bin/brew"
  if [ -n "$brew_path" ]; then
    eval "$("$brew_path" shellenv)"
    if ! grep -qF "${brew_path} shellenv" "$HOME/.zshrc" 2>/dev/null; then
      { echo ""; echo "# Homebrew shell environment"; echo "eval \"\$(${brew_path} shellenv)\""; } >> "$HOME/.zshrc"
      echo "    ✓ brew shellenv added to .zshrc"
    else
      echo "    ✓ brew shellenv already present"
    fi
    echo "    ✓ brew active: $($brew_path --version | head -1)"
    return 0
  fi
  echo "    ⚠ brew not found yet; shellenv skipped"
  return 1
}

step_brew_update() {
  local b
  b="$(brew_bin)" || { echo "    ⚠ brew not found, skipping brew update"; return 1; }
  echo "    Updating Homebrew..."
  "$b" update --quiet || true
  "$b" tap homebrew/cask >/dev/null 2>&1 || true
  echo "    ✓ brew ready: $($b --version | head -1)"
}

step_install_clis() {
  local b
  b="$(brew_bin)" || { echo "    ⚠ brew not found, skipping CLI installs"; return 1; }
  local tools=(git go jq gh ripgrep fd fzf tmux watchman tree htop ffmpeg imagemagick)
  echo "    Installing CLI tools: ${tools[*]}"
  "$b" install "${tools[@]}" || true
  echo "    ✓ CLI brew pass complete"
}

step_install_node_tools() {
  local b
  b="$(brew_bin)" || { echo "    ⚠ brew not found, skipping node tools"; return 1; }
  local tools=(node pnpm yarn bun)
  echo "    Installing node tools: ${tools[*]}"
  "$b" install "${tools[@]}" || true
  echo "    ✓ Node brew pass complete"
}

step_write_server() {
  echo "    ↻ Force-refreshing server (dashboard_server.py)..."
  copy_or_fetch "lib/server.py" "${CHINNA}/dashboard_server.py"
  copy_or_fetch "lib/forge.py" "${CHINNA}/forge.py"
  copy_or_fetch "lib/server.py" "${CHINNA}/lib/server.py"
  copy_or_fetch "lib/server_runtime_patch.py" "${CHINNA}/lib/server_runtime_patch.py" 2>/dev/null || true
  echo "    ✓ server.py updated"
}

step_apply_server_patch() {
  if [ -f "${CHINNA}/lib/server_runtime_patch.py" ]; then
    echo "    ↻ Applying dynamic backend route patch..."
    CHINNA_HOME="${CHINNA}" python3 "${CHINNA}/lib/server_runtime_patch.py" | sed 's/^/      /' || true
    python3 -m py_compile "${CHINNA}/dashboard_server.py" && echo "    ✓ dashboard_server.py syntax verified"
  else
    echo "    ⚠ runtime patch file missing; continuing"
  fi
}

step_write_dashboard() {
  echo "    ↻ Force-refreshing dashboard (index.html)..."
  copy_or_fetch "dashboard/index.html" "${CHINNA}/dashboard/index.html"
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
    copy_or_fetch "lib/${lib}.sh" "${CHINNA}/lib/${lib}.sh" 2>/dev/null && echo "      ✓ lib/${lib}.sh" || echo "      ⚠ lib/${lib}.sh (skipped)"
  done
  mkdir -p "${CHINNA}/lib/plugins"
  for plugin in _common system-health deep-clean ports-network app-control project-audit git-tools secure-chat whatsapp music-control automation storage-tools dev-runner node python godspeed-runner network-toolkit focus-power quick-serve capture-clip; do
    copy_or_fetch "lib/plugins/${plugin}.sh" "${CHINNA}/lib/plugins/${plugin}.sh" 2>/dev/null && echo "      ✓ lib/plugins/${plugin}.sh" || echo "      ⚠ lib/plugins/${plugin}.sh (skipped)"
  done
}

step_write_go_tui() {
  echo "    ↻ Force-refreshing Go TUI files..."
  mkdir -p "${CHINNA}/cmd/chinna-tui" "${CHINNA}/cmd/chinna-escape" "${CHINNA}/tui"
  copy_or_fetch "go.mod" "${CHINNA}/go.mod"
  copy_or_fetch "go.sum" "${CHINNA}/go.sum"
  copy_or_fetch "cmd/chinna-tui/main.go" "${CHINNA}/cmd/chinna-tui/main.go"
  copy_or_fetch "cmd/chinna-escape/main.go" "${CHINNA}/cmd/chinna-escape/main.go"
  for f in anim.go api.go chat.go escape.go layout.go model.go models.go status.go types.go; do
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
  ln -sf "$canonical" "$HOME/.local/bin/chinna-code" 2>/dev/null || true
  echo "    ✓ linked ~/.local/bin/chinna-code → chinna code"
  local linked=0
  for dir in /usr/local/bin /opt/homebrew/bin; do
    [ -d "$dir" ] || continue
    if ln -sf "$canonical" "$dir/chinna" 2>/dev/null; then
      linked=1
      ln -sf "$canonical" "$dir/chinna-code" 2>/dev/null || true
      echo "    ✓ linked $dir/chinna → ~/.local/bin/chinna"
      continue
    fi
    if command -v sudo >/dev/null 2>&1 && sudo -n ln -sf "$canonical" "$dir/chinna" 2>/dev/null; then
      linked=1
      sudo -n ln -sf "$canonical" "$dir/chinna-code" 2>/dev/null || true
      echo "    ✓ linked $dir/chinna → ~/.local/bin/chinna (sudo)"
    fi
  done
  [ "$linked" -eq 0 ] && echo "    ✓ PATH uses ~/.local/bin/chinna"
}

step_write_defaults() {
  echo "7.0.0" > "${CHINNA}/VERSION"
  copy_or_fetch "version-log.json" "${CHINNA}/version-log.json" 2>/dev/null || true
  touch "${CHINNA}/env"
  chmod 600 "${CHINNA}/env" 2>/dev/null || true
  grep -q '^APPAUTOMATIONMODE=' "${CHINNA}/env" 2>/dev/null || echo 'APPAUTOMATIONMODE=off' >> "${CHINNA}/env"
  grep -q '^APPNOTIFYSOUND=' "${CHINNA}/env" 2>/dev/null || echo 'APPNOTIFYSOUND=/System/Library/Sounds/Glass.aiff' >> "${CHINNA}/env"
  grep -q '^APPNOTIFYSPEAK=' "${CHINNA}/env" 2>/dev/null || echo 'APPNOTIFYSPEAK=off' >> "${CHINNA}/env"
  grep -q '^CHINNA_DASHBOARD_PORT=' "${CHINNA}/env" 2>/dev/null || echo 'CHINNA_DASHBOARD_PORT=7777' >> "${CHINNA}/env"
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
    grep -q '^MODEL_free=' "${CHINNA}/models" 2>/dev/null || echo 'MODEL_free="openrouter/free"' >> "${CHINNA}/models"
  fi
  echo "    ✓ env/defaults verified"
}

step_zshrc_block() {
  local zshrc="$HOME/.zshrc" begin='# ── Chinna CLI (managed by install.sh — do not edit) ──' end='# ── /Chinna CLI ──'
  touch "$zshrc"
  python3 - "$zshrc" "$begin" "$end" <<'PY'
import pathlib, re, sys
zshrc = pathlib.Path(sys.argv[1]); begin, end = sys.argv[2], sys.argv[3]
text = zshrc.read_text() if zshrc.exists() else ""
text = re.sub(re.escape(begin) + r".*?" + re.escape(end) + r"\n?", "", text, flags=re.S)
text = re.sub(r"# ── Chinna V\d.*?(?=\n# ──|\n\nexport |\Z)", "", text, flags=re.S)
text = re.sub(r"\nalias chinna=.*\n", "\n", text)
block = f"""
{begin}
export PATH="$HOME/.local/bin:$PATH"
export CHINNA_HOME="$HOME/.chinna"
[ -f "$CHINNA_HOME/env" ]    && source "$CHINNA_HOME/env"
[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"
unalias chinna 2>/dev/null || true
chinna() {{
  "$HOME/.local/bin/chinna" "$@"
}}
chinna-code() {{
  CHINNA_CODE_MODE=1 "$HOME/.local/bin/chinna" code "$@"
}}
{end}
"""
if not text.endswith("\n"): text += "\n"
zshrc.write_text(text + block)
PY
  echo "    ✓ ~/.zshrc Chinna CLI block refreshed"
}

step_start_server() {
  pkill -9 -f dashboard_server 2>/dev/null || true
  sleep 2
  nohup python3 "${CHINNA}/dashboard_server.py" "${PORT}" > "${CHINNA}/dashboard.log" 2>&1 &
  sleep 3
  if curl -sf "http://localhost:${PORT}/api/version" >/dev/null 2>&1; then
    local ver
    ver=$(curl -sf "http://localhost:${PORT}/api/version" | python3 -c "import json,sys;print(json.load(sys.stdin).get('name','Chinna V7.0'))" 2>/dev/null || echo "Chinna V7.0")
    echo "    ✓ ${ver} running on port ${PORT}"
  else
    echo "    ⚠ Server warming up — check: curl http://localhost:${PORT}/api/version"
    echo "    Log: tail -80 ${CHINNA}/dashboard.log"
  fi
}

run_step "backup_zshrc" step_backup_zshrc
run_step "check_python" step_check_python
run_verified_step "install_homebrew" verify_brew step_install_homebrew || true
run_verified_step "brew_shellenv" verify_brew step_brew_shellenv || true
run_verified_step "brew_update" verify_brew step_brew_update || true
run_verified_step "install_clis" verify_brew step_install_clis || true
run_verified_step "install_node_tools" verify_brew step_install_node_tools || true

echo ""
echo "  ↻ Pulling latest V7.0 app files..."
step_write_server
step_write_defaults
step_apply_server_patch
step_write_dashboard
step_write_whatsapp_bridge
step_write_libs
step_write_go_tui
step_write_bin
step_link_chinna_path
step_zshrc_block
step_write_extension
step_start_server

osascript -e 'display notification "Chinna v7 ready — dashboard upgraded." with title "🟢 Chinna V7.0 installed"' 2>/dev/null || true

echo ""
echo "  ══════════════════════════════════════════════════════"
echo "  ✅  CHINNA V7.0 READY!"
echo "  ══════════════════════════════════════════════════════"
echo ""
echo "  🌐  Dashboard   →  http://localhost:${PORT}"
echo "  📦  Install URL  →  curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash"
echo ""
echo "  Quick commands:"
echo "    chinna                  → Terminal sidekick"
echo "    chinna code             → global Mac agent"
echo "    source ~/.zshrc         → activate chinna in this terminal"
echo "    chinna escape           → escape animation"
echo "    chinna doctor           → full system health check"
echo "    chinna run              → smart project runner"
echo "    chinna ai <prompt>      → AI chat"
echo "    chinna dashboard        → open dashboard"
echo "    chinna model-set free   → switch AI model"
echo "    chinna clean            → deep Mac clean"
echo "    chinna audit            → project audit"
echo ""
echo "  Re-run anytime — setup steps are verified, app code is always refreshed."
echo ""

open "http://localhost:${PORT}" 2>/dev/null || true
