#!/usr/bin/env bash
# Chinna V7.0 — pipe-safe always-fresh installer
# curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
set -Ee -o pipefail

REPO="pichimail/chinna-go"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
CHINNA="${CHINNA_HOME:-$HOME/.chinna}"
PORT="${CHINNA_DASHBOARD_PORT:-7777}"
STATE_FILE="${CHINNA}/.installstate"

printf '\n  ╔══════════════════════════════════════════════════╗\n'
printf '  ║   C H I N N A   V7.0    —  Mac Sidekick         ║\n'
printf '  ║   Always-Fresh · Models · Media · WhatsApp · More║\n'
printf '  ╚══════════════════════════════════════════════════╝\n\n'
printf '  Source: GitHub raw (%s/%s)\n\n' "$REPO" "$BRANCH"

mkdir -p "$CHINNA" "$CHINNA/lib" "$CHINNA/dashboard" "$CHINNA/logs" "$CHINNA/state"

download() {
  rel="$1"
  dest="$2"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "${RAW}/${rel}?cb=$(date +%s)" -o "$dest"
}

is_done() { grep -qxF "$1" "$STATE_FILE" 2>/dev/null; }
mark_done() { grep -qxF "$1" "$STATE_FILE" 2>/dev/null || echo "$1" >> "$STATE_FILE"; }
clear_done() { [ -f "$STATE_FILE" ] && grep -vxF "$1" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null && mv "${STATE_FILE}.tmp" "$STATE_FILE" || true; }

run_once() {
  name="$1"; shift
  if is_done "$name"; then
    echo "  ↷ Skipping (already set up): $name"
  else
    echo "  → Running: $name"
    "$@" && mark_done "$name"
  fi
}

brew_bin() {
  command -v brew >/dev/null 2>&1 && { command -v brew; return 0; }
  [ -x /opt/homebrew/bin/brew ] && { echo /opt/homebrew/bin/brew; return 0; }
  [ -x /usr/local/bin/brew ] && { echo /usr/local/bin/brew; return 0; }
  return 1
}

verify_brew() { b="$(brew_bin 2>/dev/null)" || return 1; "$b" --version >/dev/null 2>&1; }

run_verified() {
  name="$1"; shift
  verifier="$1"; shift
  if is_done "$name" && "$verifier" >/dev/null 2>&1; then
    echo "  ↷ Skipping (already set up): $name"
    return 0
  fi
  if is_done "$name"; then
    clear_done "$name"
    echo "  ↻ Re-running: $name"
  else
    echo "  → Running: $name"
  fi
  "$@" && "$verifier" >/dev/null 2>&1 && mark_done "$name"
}

backup_zshrc() {
  [ -f "$HOME/.zshrc" ] && cp "$HOME/.zshrc" "$HOME/.zshrc.backup.$(date +%Y%m%d%H%M%S)" || true
  echo "    ✓ ~/.zshrc backup checked"
}

check_python() {
  command -v python3 >/dev/null 2>&1 || { echo "  ✗ python3 required. Run: xcode-select --install"; exit 1; }
  echo "    ✓ $(python3 --version 2>&1)"
}

install_homebrew() {
  verify_brew && { echo "    ✓ Homebrew already installed: $(brew_bin)"; return 0; }
  log="$CHINNA/logs/homebrew-install.$(date +%Y%m%d%H%M%S).log"
  if env NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" >"$log" 2>&1; then
    brew_shellenv || true
    verify_brew && { echo "    ✓ Homebrew installed"; return 0; }
  fi
  echo "    ⚠ Homebrew install not completed. Continuing without brew packages."
  echo "      Manual: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  return 1
}

brew_shellenv() {
  b="$(brew_bin 2>/dev/null)" || { echo "    ⚠ brew not found, shellenv skipped"; return 1; }
  eval "$($b shellenv)"
  if ! grep -qF "$b shellenv" "$HOME/.zshrc" 2>/dev/null; then
    { echo ""; echo "# Homebrew shell environment"; echo "eval \"\$($b shellenv)\""; } >> "$HOME/.zshrc"
  fi
  echo "    ✓ brew active: $($b --version | head -1)"
}

brew_update() {
  b="$(brew_bin 2>/dev/null)" || { echo "    ⚠ brew not found, update skipped"; return 1; }
  "$b" update --quiet || true
  "$b" tap homebrew/cask >/dev/null 2>&1 || true
  echo "    ✓ brew updated"
}

install_clis() {
  b="$(brew_bin 2>/dev/null)" || { echo "    ⚠ brew not found, CLI install skipped"; return 1; }
  tools="git go jq gh ripgrep fd fzf tmux watchman tree htop ffmpeg imagemagick"
  echo "    Installing CLI tools: $tools"
  "$b" install $tools || true
  echo "    ✓ CLI brew pass complete"
}

install_node_tools() {
  b="$(brew_bin 2>/dev/null)" || { echo "    ⚠ brew not found, node tools skipped"; return 1; }
  tools="node pnpm yarn bun"
  echo "    Installing node tools: $tools"
  "$b" install $tools || true
  echo "    ✓ Node brew pass complete"
}

write_server() {
  echo "    ↻ Force-refreshing server files..."
  download lib/server.py "$CHINNA/dashboard_server.py"
  download lib/server.py "$CHINNA/lib/server.py"
  download lib/forge.py "$CHINNA/forge.py" || true
  download lib/server_runtime_patch.py "$CHINNA/lib/server_runtime_patch.py" || true
  echo "    ✓ server files updated"
}

write_defaults() {
  echo "7.0.0" > "$CHINNA/VERSION"
  download version-log.json "$CHINNA/version-log.json" || true
  touch "$CHINNA/env"
  chmod 600 "$CHINNA/env" 2>/dev/null || true
  grep -q '^APPAUTOMATIONMODE=' "$CHINNA/env" 2>/dev/null || echo 'APPAUTOMATIONMODE=off' >> "$CHINNA/env"
  grep -q '^APPNOTIFYSOUND=' "$CHINNA/env" 2>/dev/null || echo 'APPNOTIFYSOUND=/System/Library/Sounds/Glass.aiff' >> "$CHINNA/env"
  grep -q '^APPNOTIFYSPEAK=' "$CHINNA/env" 2>/dev/null || echo 'APPNOTIFYSPEAK=off' >> "$CHINNA/env"
  grep -q '^CHINNA_DASHBOARD_PORT=' "$CHINNA/env" 2>/dev/null || echo 'CHINNA_DASHBOARD_PORT=7777' >> "$CHINNA/env"
  if [ ! -f "$CHINNA/models" ]; then
    cat > "$CHINNA/models" <<'MODELS'
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
    chmod 600 "$CHINNA/models" 2>/dev/null || true
  fi
  grep -q '^MODEL_free=' "$CHINNA/models" 2>/dev/null || echo 'MODEL_free="openrouter/free"' >> "$CHINNA/models"
  echo "    ✓ env/defaults verified"
}

mask_key() {
  k="$1"
  n=${#k}
  if [ "$n" -le 8 ]; then
    printf 'too-short:%s chars' "$n"
  else
    first=$(printf '%s' "$k" | cut -c1-6)
    last=$(printf '%s' "$k" | awk '{print substr($0,length($0)-3,4)}')
    printf '%s…%s (%s chars)' "$first" "$last" "$n"
  fi
}

read_secret_line() {
  prompt="$1"
  printf '%s' "$prompt" >/dev/tty
  stty -echo </dev/tty 2>/dev/null || true
  IFS= read -r value </dev/tty || value=""
  stty echo </dev/tty 2>/dev/null || true
  printf '\n' >/dev/tty
  printf '%s' "$value"
}

prompt_ai_keys() {
  if [ "${CHINNA_SKIP_KEY_PROMPT:-}" = "1" ]; then
    echo "    ↷ AI key prompt skipped by CHINNA_SKIP_KEY_PROMPT=1"
    return 0
  fi
  if [ ! -r /dev/tty ]; then
    echo "    ⚠ No interactive terminal for AI key prompt. Add keys in Dashboard → Settings."
    return 0
  fi

  has_or="no"; has_oa="no"
  grep -q '^OPENROUTER_API_KEY=' "$CHINNA/env" 2>/dev/null && has_or="yes"
  grep -q '^OPENAI_API_KEY=' "$CHINNA/env" 2>/dev/null && has_oa="yes"

  echo "" >/dev/tty
  echo "  AI setup — choose provider keys to save" >/dev/tty
  echo "    1) OpenRouter only" >/dev/tty
  echo "    2) OpenAI only" >/dev/tty
  echo "    3) Both OpenRouter + OpenAI" >/dev/tty
  echo "    4) Keep existing / skip" >/dev/tty
  printf '  Select [1/2/3/4, default 4]: ' >/dev/tty
  IFS= read -r choice </dev/tty || choice="4"
  [ -n "$choice" ] || choice="4"

  case "$choice" in
    1|2|3) ;;
    *) echo "    ↷ AI key setup skipped. Existing keys preserved."; return 0 ;;
  esac

  OR_KEY=""
  OA_KEY=""
  if [ "$choice" = "1" ] || [ "$choice" = "3" ]; then
    echo "  Paste OpenRouter key. Input is hidden; confirmation appears after Enter." >/dev/tty
    OR_KEY=$(read_secret_line '  OpenRouter API key: ')
    if [ -n "$OR_KEY" ]; then
      echo "    ✓ OpenRouter key captured: $(mask_key "$OR_KEY")" >/dev/tty
    else
      echo "    ↷ OpenRouter key empty, skipped." >/dev/tty
    fi
  fi
  if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo "  Paste OpenAI key. Input is hidden; confirmation appears after Enter." >/dev/tty
    OA_KEY=$(read_secret_line '  OpenAI API key: ')
    if [ -n "$OA_KEY" ]; then
      echo "    ✓ OpenAI key captured: $(mask_key "$OA_KEY")" >/dev/tty
    else
      echo "    ↷ OpenAI key empty, skipped." >/dev/tty
    fi
  fi

  if [ -z "$OR_KEY" ] && [ -z "$OA_KEY" ]; then
    echo "    ⚠ No new key captured. Existing keys preserved." >/dev/tty
    return 0
  fi

  if [ -n "$OR_KEY" ]; then default_model="openrouter/auto"; else default_model="gpt-4o-mini"; fi
  printf '  Active model [%s]: ' "$default_model" >/dev/tty
  IFS= read -r ACTIVE_MODEL_IN </dev/tty || ACTIVE_MODEL_IN=""
  [ -n "$ACTIVE_MODEL_IN" ] || ACTIVE_MODEL_IN="$default_model"

  CHINNA_HOME="$CHINNA" OPENROUTER_API_KEY_INPUT="$OR_KEY" OPENAI_API_KEY_INPUT="$OA_KEY" ACTIVE_MODEL_INPUT="$ACTIVE_MODEL_IN" python3 - <<'PY'
import json, os, pathlib
home = pathlib.Path(os.environ['CHINNA_HOME'])
env = home / 'env'
keys = home / 'api_keys.json'
values = {
    'OPENROUTER_API_KEY': os.environ.get('OPENROUTER_API_KEY_INPUT',''),
    'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY_INPUT',''),
    'ACTIVE_MODEL': os.environ.get('ACTIVE_MODEL_INPUT','openrouter/auto'),
}
lines = env.read_text().splitlines() if env.exists() else []
def set_line(name, value):
    global lines
    if not value: return False
    new = f"{name}='{value.replace(chr(39), chr(39)+'\\''+chr(39))}'"
    prefixes = (name+'=', 'export '+name+'=', '# '+name+'=')
    out=[]; done=False
    for line in lines:
        if line.startswith(prefixes):
            if not done:
                out.append(new); done=True
        else:
            out.append(line)
    if not done: out.append(new)
    lines = out
    return True
saved = {}
for k,v in values.items():
    if set_line(k,v): saved[k]=bool(v)
env.write_text('\n'.join(lines).rstrip()+'\n')
os.chmod(env, 0o600)
data = {}
if keys.exists():
    try: data = json.loads(keys.read_text())
    except Exception: data = {}
for k,v in values.items():
    if v: data[k]=v
keys.write_text(json.dumps(data, indent=2))
os.chmod(keys, 0o600)
print('    ✓ AI key configuration saved')
print(f"    ✓ OPENROUTER_API_KEY saved: {'yes' if data.get('OPENROUTER_API_KEY') else 'no'}")
print(f"    ✓ OPENAI_API_KEY saved: {'yes' if data.get('OPENAI_API_KEY') else 'no'}")
print(f"    ✓ ACTIVE_MODEL: {data.get('ACTIVE_MODEL','')}")
print(f"    ✓ env file: {env}")
print(f"    ✓ key store: {keys}")
PY
}

apply_server_patch() {
  if [ -f "$CHINNA/lib/server_runtime_patch.py" ]; then
    echo "    ↻ Applying dynamic backend route patch..."
    CHINNA_SKIP_KEY_PROMPT=1 CHINNA_HOME="$CHINNA" python3 "$CHINNA/lib/server_runtime_patch.py" | sed 's/^/      /' || true
  fi
  python3 -m py_compile "$CHINNA/dashboard_server.py" && echo "    ✓ dashboard_server.py syntax verified"
}

write_dashboard() {
  echo "    ↻ Force-refreshing dashboard..."
  download dashboard/index.html "$CHINNA/dashboard/index.html"
  mkdir -p "$CHINNA/dashboard/assets"
  for asset in chinna-favicon.svg chinna-icon.svg chinna-logo.svg; do
    download "dashboard/assets/$asset" "$CHINNA/dashboard/assets/$asset" || true
  done
  echo "    ✓ dashboard updated"
}

write_whatsapp_bridge() {
  echo "    ↻ Force-refreshing WhatsApp bridge..."
  mkdir -p "$CHINNA/whatsapp_bridge"
  download whatsapp_bridge/package.json "$CHINNA/whatsapp_bridge/package.json" || true
  download whatsapp_bridge/server.js "$CHINNA/whatsapp_bridge/server.js" || true
  download whatsapp_bridge/package-lock.json "$CHINNA/whatsapp_bridge/package-lock.json" || true
  echo "    ✓ WhatsApp bridge updated"
}

write_libs() {
  echo "    ↻ Force-refreshing lib files..."
  for lib in config clean stack registry notify daemon server plugins swiftbar voice lang upgrade cli-ui cli-hub; do
    download "lib/$lib.sh" "$CHINNA/lib/$lib.sh" 2>/dev/null && echo "      ✓ lib/$lib.sh" || echo "      ⚠ lib/$lib.sh skipped"
  done
  mkdir -p "$CHINNA/lib/plugins"
  for plugin in _common system-health deep-clean ports-network app-control project-audit git-tools secure-chat whatsapp music-control automation storage-tools dev-runner node python godspeed-runner network-toolkit focus-power quick-serve capture-clip; do
    download "lib/plugins/$plugin.sh" "$CHINNA/lib/plugins/$plugin.sh" 2>/dev/null && echo "      ✓ lib/plugins/$plugin.sh" || echo "      ⚠ lib/plugins/$plugin.sh skipped"
  done
}

write_go_tui() {
  echo "    ↻ Force-refreshing Go TUI files..."
  mkdir -p "$CHINNA/cmd/chinna-tui" "$CHINNA/cmd/chinna-escape" "$CHINNA/tui"
  download go.mod "$CHINNA/go.mod" || true
  download go.sum "$CHINNA/go.sum" || true
  download cmd/chinna-tui/main.go "$CHINNA/cmd/chinna-tui/main.go" || true
  download cmd/chinna-escape/main.go "$CHINNA/cmd/chinna-escape/main.go" || true
  for f in anim.go api.go chat.go escape.go layout.go model.go models.go status.go types.go; do download "tui/$f" "$CHINNA/tui/$f" || true; done
  echo "    ✓ Go TUI updated"
}

write_extension() {
  echo "    ↻ Installing browser extension files..."
  mkdir -p "$CHINNA/extension/icons"
  for f in manifest.json background.js sidepanel.html sidepanel.js sidepanel.css INSTALL.md install-extension.sh; do download "extension/$f" "$CHINNA/extension/$f" || true; done
  for i in 16 48 128; do download "extension/icons/icon$i.png" "$CHINNA/extension/icons/icon$i.png" || true; done
  echo "    ✓ Extension at ~/.chinna/extension"
}

write_bin() {
  echo "    ↻ Force-refreshing chinna CLI..."
  mkdir -p "$HOME/.local/bin" "$CHINNA/bin"
  download bin/chinna "$HOME/.local/bin/chinna"
  chmod +x "$HOME/.local/bin/chinna"
  bash -n "$HOME/.local/bin/chinna" || { echo "    ✗ chinna CLI syntax check failed"; exit 1; }
  ln -sf "$HOME/.local/bin/chinna" "$CHINNA/bin/chinna"
  ln -sf "$HOME/.local/bin/chinna" "$HOME/.local/bin/chinna-code" 2>/dev/null || true
  echo "    ✓ chinna CLI updated"
}

link_path() {
  canonical="$HOME/.local/bin/chinna"
  for dir in /usr/local/bin /opt/homebrew/bin; do
    [ -d "$dir" ] || continue
    ln -sf "$canonical" "$dir/chinna" 2>/dev/null || sudo -n ln -sf "$canonical" "$dir/chinna" 2>/dev/null || true
    ln -sf "$canonical" "$dir/chinna-code" 2>/dev/null || sudo -n ln -sf "$canonical" "$dir/chinna-code" 2>/dev/null || true
  done
  echo "    ✓ PATH/link pass complete"
}

zshrc_block() {
  zshrc="$HOME/.zshrc"
  begin='# ── Chinna CLI (managed by install.sh — do not edit) ──'
  end='# ── /Chinna CLI ──'
  touch "$zshrc"
  python3 - "$zshrc" "$begin" "$end" <<'PY'
import pathlib, re, sys
p=pathlib.Path(sys.argv[1]); begin=sys.argv[2]; end=sys.argv[3]
s=p.read_text() if p.exists() else ''
s=re.sub(re.escape(begin)+r'.*?'+re.escape(end)+r'\n?', '', s, flags=re.S)
s=re.sub(r'\nalias chinna=.*\n', '\n', s)
block=f'''
{begin}
export PATH="$HOME/.local/bin:$PATH"
export CHINNA_HOME="$HOME/.chinna"
[ -f "$CHINNA_HOME/env" ] && source "$CHINNA_HOME/env"
[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"
unalias chinna 2>/dev/null || true
chinna() {{ "$HOME/.local/bin/chinna" "$@"; }}
chinna-code() {{ CHINNA_CODE_MODE=1 "$HOME/.local/bin/chinna" code "$@"; }}
{end}
'''
if not s.endswith('\n'): s+='\n'
p.write_text(s+block)
PY
  echo "    ✓ ~/.zshrc Chinna block refreshed"
}

start_server() {
  pkill -9 -f dashboard_server 2>/dev/null || true
  sleep 2
  nohup python3 "$CHINNA/dashboard_server.py" "$PORT" > "$CHINNA/dashboard.log" 2>&1 &
  sleep 3
  if curl -sf "http://localhost:$PORT/api/version" >/dev/null 2>&1; then
    echo "    ✓ Chinna running on port $PORT"
  else
    echo "    ⚠ Server warming up. Log: tail -80 $CHINNA/dashboard.log"
  fi
}

run_once backup_zshrc backup_zshrc
run_once check_python check_python
run_verified install_homebrew verify_brew install_homebrew || true
run_verified brew_shellenv verify_brew brew_shellenv || true
run_verified brew_update verify_brew brew_update || true
run_verified install_clis verify_brew install_clis || true
run_verified install_node_tools verify_brew install_node_tools || true

echo ""
echo "  ↻ Pulling latest V7.0 app files..."
write_server
write_defaults
prompt_ai_keys
apply_server_patch
write_dashboard
write_whatsapp_bridge
write_libs
write_go_tui
write_bin
link_path
zshrc_block
write_extension
start_server

osascript -e 'display notification "Chinna v7 ready — dashboard upgraded." with title "🟢 Chinna V7.0 installed"' 2>/dev/null || true

printf '\n  ══════════════════════════════════════════════════════\n'
printf '  ✅  CHINNA V7.0 READY!\n'
printf '  ══════════════════════════════════════════════════════\n\n'
printf '  🌐  Dashboard   →  http://localhost:%s\n' "$PORT"
printf '  📦  Install URL  →  curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash\n\n'
printf '  Quick commands:\n'
printf '    chinna                  → Terminal sidekick\n'
printf '    chinna code             → global Mac agent\n'
printf '    source ~/.zshrc         → activate chinna in this terminal\n'
printf '    chinna doctor           → full system health check\n'
printf '    chinna dashboard        → open dashboard\n\n'

open "http://localhost:$PORT" 2>/dev/null || true
