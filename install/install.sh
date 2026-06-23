#!/usr/bin/env bash
# Chinna V7.0 — pipe-safe always-fresh installer
# Fresh reinstall:
#   curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | CHINNA_FRESH=1 bash
set -Ee -o pipefail

REPO="pichimail/chinna-go"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
CHINNA="${CHINNA_HOME:-$HOME/.chinna}"
PORT="${CHINNA_DASHBOARD_PORT:-7777}"
STATE_FILE="${CHINNA}/.installstate"
STAMP="$(date +%Y%m%d%H%M%S)"

printf '\n  ╔══════════════════════════════════════════════════╗\n'
printf '  ║   C H I N N A   V7.0    —  Mac Sidekick         ║\n'
printf '  ║   Fresh · Models · Media · WhatsApp · More      ║\n'
printf '  ╚══════════════════════════════════════════════════╝\n\n'
printf '  Source: GitHub raw (%s/%s)\n' "$REPO" "$BRANCH"
printf '  Fresh mode: %s\n\n' "${CHINNA_FRESH:-0}"

if [ "${CHINNA_FRESH:-0}" = "1" ]; then
  echo "  → Fresh reinstall requested"
  pkill -9 -f dashboard_server 2>/dev/null || true
  pkill -9 -f "localhost:${PORT}" 2>/dev/null || true
  if [ -d "$CHINNA" ]; then
    BACKUP="$HOME/.chinna.backup.$STAMP"
    echo "    ✓ Backing up old ~/.chinna → $BACKUP"
    mv "$CHINNA" "$BACKUP"
  fi
fi

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

prompt_ai_keys_and_model() {
  if [ "${CHINNA_SKIP_KEY_PROMPT:-}" = "1" ]; then
    echo "    ↷ AI key + model setup skipped by CHINNA_SKIP_KEY_PROMPT=1"
    return 0
  fi
  if [ ! -r /dev/tty ]; then
    echo "    ⚠ No interactive terminal for AI key/model setup. Add keys in Dashboard → Settings."
    return 0
  fi
  CHINNA_HOME="$CHINNA" python3 - <<'PY'
import json, os, pathlib, re, urllib.request

home = pathlib.Path(os.environ.get("CHINNA_HOME", str(pathlib.Path.home()/".chinna")))
env = home / "env"
models_file = home / "models"
keys_file = home / "api_keys.json"

try:
    tty = open("/dev/tty", "r+", encoding="utf-8", buffering=1)
except Exception:
    print("    ⚠ /dev/tty unavailable; skipping AI setup")
    raise SystemExit(0)

def say(msg=""):
    print(msg, file=tty)

def ask(prompt, default=""):
    tty.write(prompt)
    tty.flush()
    value = tty.readline().strip()
    return value if value else default

def ask_secret(prompt):
    tty.write(prompt)
    tty.flush()
    try:
        import termios
        fd = tty.fileno()
        old = termios.tcgetattr(fd)
        new = old[:]
        new[3] = new[3] & ~termios.ECHO
        termios.tcsetattr(fd, termios.TCSADRAIN, new)
        value = tty.readline().strip()
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        tty.write("\n")
        tty.flush()
        return value
    except Exception:
        return tty.readline().strip()

def mask(key):
    if not key:
        return "empty"
    if len(key) <= 10:
        return "too-short:%s chars" % len(key)
    return "%s…%s (%s chars)" % (key[:6], key[-4:], len(key))

def shell_quote(value):
    return "'" + str(value).replace("'", "'\\''") + "'"

def double_quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

def upsert(path, name, value, quote="single"):
    if value is None or value == "":
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = path.read_text(errors="replace").splitlines() if path.exists() else []
    rendered = "%s=%s" % (name, shell_quote(value) if quote == "single" else double_quote(value))
    prefixes = (name+"=", "export "+name+"=", "# "+name+"=")
    out = []
    done = False
    for line in lines:
        if line.startswith(prefixes):
            if not done:
                out.append(rendered)
                done = True
        else:
            out.append(line)
    if not done:
        out.append(rendered)
    path.write_text("\n".join(out).rstrip()+"\n")
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass

def read_env(name):
    if not env.exists():
        return ""
    pat = re.compile(r"^(?:export\s+)?"+re.escape(name)+r"=(.*)$")
    for line in env.read_text(errors="replace").splitlines():
        m = pat.match(line.strip())
        if not m:
            continue
        raw = m.group(1).strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
            raw = raw[1:-1]
        return raw
    return ""

def load_keys():
    if not keys_file.exists():
        return {}
    try:
        data = json.loads(keys_file.read_text())
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def save_keys(data):
    keys_file.parent.mkdir(parents=True, exist_ok=True)
    keys_file.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(keys_file, 0o600)
    except Exception:
        pass

def request_json(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.loads(response.read().decode("utf-8", "replace"))

def fetch_openrouter(key):
    headers = {
        "User-Agent": "chinna-installer",
        "HTTP-Referer": "http://localhost:7777",
        "X-Title": "Chinna"
    }
    if key:
        headers["Authorization"] = "Bearer " + key
    data = request_json("https://openrouter.ai/api/v1/models", headers)
    rows = []
    for item in data.get("data", []):
        model_id = item.get("id")
        if model_id:
            rows.append({
                "id": model_id,
                "name": item.get("name") or model_id,
                "created": item.get("created") or 0
            })
    return rows

def fetch_openai(key):
    data = request_json("https://api.openai.com/v1/models", {
        "Authorization": "Bearer " + key,
        "User-Agent": "chinna-installer"
    })
    rows = []
    for item in data.get("data", []):
        model_id = item.get("id")
        if not model_id:
            continue
        low = model_id.lower()
        if low.startswith(("ft:", "babbage", "davinci")):
            continue
        rows.append({"id": model_id, "name": model_id, "created": item.get("created") or 0})
    return rows

def score_model(provider, item, query=""):
    hay = (item.get("id","") + " " + item.get("name","")).lower()
    score = float(item.get("created") or 0) / 10000000000.0
    preferred = ["gpt-5", "gpt-4.1", "gpt-4o", "o4", "o3", "claude-3.7", "claude-3.5", "gemini-2.5", "gemini-2.0", "llama-3.3", "free"]
    for i, token in enumerate(preferred):
        if token in hay:
            score += 100 - i
    if provider == "openrouter" and ":free" in hay:
        score += 25
    if query:
        for token in query.split():
            if token in hay:
                score += 200
    return score

def pick_model(provider, rows):
    say("")
    say("  Live %s model list loaded: %s models" % (provider, len(rows)))
    query = ask("  Search/filter models (Enter = recommended latest): ", "").lower().strip()
    if query:
        visible = [x for x in rows if all(tok in ((x.get("id","")+" "+x.get("name","")).lower()) for tok in query.split())]
    else:
        visible = list(rows)
    visible.sort(key=lambda x: score_model(provider, x, query), reverse=True)
    visible = visible[:40]
    if not visible:
        say("  No matching model. Use manual model id.")
        return ask("  Manual model id: ", "")
    for idx, item in enumerate(visible, 1):
        label = item["id"]
        if item.get("name") and item["name"] != item["id"]:
            label += " — " + item["name"]
        say("  %2d) %s" % (idx, label))
    say("   m) Manual model id")
    choice = ask("  Select model [1]: ", "1")
    if choice.lower() == "m":
        return ask("  Manual model id: ", "")
    try:
        index = int(choice) - 1
        if 0 <= index < len(visible):
            return visible[index]["id"]
    except Exception:
        pass
    return visible[0]["id"]

store = load_keys()
or_key = store.get("OPENROUTER_API_KEY") or read_env("OPENROUTER_API_KEY")
oa_key = store.get("OPENAI_API_KEY") or read_env("OPENAI_API_KEY")

say("")
say("  AI setup — choose provider keys to save")
say("    1) OpenRouter only")
say("    2) OpenAI only")
say("    3) Both OpenRouter + OpenAI")
say("    4) Keep existing keys / skip")
choice = ask("  Select [1/2/3/4, default 4]: ", "4")

if choice in ("1", "3"):
    say("  Paste OpenRouter key. Input is hidden; confirmation appears after Enter.")
    value = ask_secret("  OpenRouter API key: ")
    if value:
        or_key = value
        store["OPENROUTER_API_KEY"] = value
        upsert(env, "OPENROUTER_API_KEY", value, "single")
        say("    ✓ OpenRouter key captured: " + mask(value))
    else:
        say("    ↷ OpenRouter key empty; skipped.")

if choice in ("2", "3"):
    say("  Paste OpenAI key. Input is hidden; confirmation appears after Enter.")
    value = ask_secret("  OpenAI API key: ")
    if value:
        oa_key = value
        store["OPENAI_API_KEY"] = value
        upsert(env, "OPENAI_API_KEY", value, "single")
        say("    ✓ OpenAI key captured: " + mask(value))
    else:
        say("    ↷ OpenAI key empty; skipped.")

save_keys(store)
say("    ✓ OPENROUTER_API_KEY saved: " + ("yes" if or_key else "no"))
say("    ✓ OPENAI_API_KEY saved: " + ("yes" if oa_key else "no"))

providers = []
if or_key:
    try:
        providers.append(("openrouter", fetch_openrouter(or_key)))
        say("    ✓ OpenRouter API accepted enough to fetch model list")
    except Exception as exc:
        say("    ⚠ OpenRouter model fetch failed: " + str(exc))
if oa_key:
    try:
        providers.append(("openai", fetch_openai(oa_key)))
        say("    ✓ OpenAI API accepted enough to fetch model list")
    except Exception as exc:
        say("    ⚠ OpenAI model fetch failed: " + str(exc))

active = ""
if providers:
    say("")
    say("  Choose ACTIVE_MODEL from live available models")
    if len(providers) == 1:
        provider, rows = providers[0]
    else:
        for idx, pair in enumerate(providers, 1):
            say("  %d) %s (%s models)" % (idx, pair[0], len(pair[1])))
        pc = ask("  Select provider [1]: ", "1")
        try:
            provider, rows = providers[max(0, min(len(providers)-1, int(pc)-1))]
        except Exception:
            provider, rows = providers[0]
    active = pick_model(provider, rows)
else:
    if choice in ("1", "2", "3"):
        active = ask("  Model list unavailable. Enter ACTIVE_MODEL manually [openrouter/auto]: ", "openrouter/auto")
    else:
        active = read_env("ACTIVE_MODEL") or store.get("ACTIVE_MODEL") or "openrouter/free"

if active:
    upsert(env, "ACTIVE_MODEL", active, "single")
    upsert(models_file, "ACTIVE_MODEL", active, "double")
    store["ACTIVE_MODEL"] = active
    save_keys(store)
    say("    ✓ ACTIVE_MODEL saved: " + active)
else:
    say("    ⚠ ACTIVE_MODEL not changed")

say("    ✓ AI setup finished")
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
block = (
    "\n" + begin + "\n"
    'export PATH="$HOME/.local/bin:$PATH"\n'
    'export CHINNA_HOME="$HOME/.chinna"\n'
    '[ -f "$CHINNA_HOME/env" ] && source "$CHINNA_HOME/env"\n'
    '[ -f "$CHINNA_HOME/models" ] && source "$CHINNA_HOME/models"\n'
    'unalias chinna 2>/dev/null || true\n'
    'chinna() { "$HOME/.local/bin/chinna" "$@"; }\n'
    'chinna-code() { CHINNA_CODE_MODE=1 "$HOME/.local/bin/chinna" code "$@"; }\n'
    + end + "\n"
)
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
prompt_ai_keys_and_model
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
printf '  🌐  Dashboard   →  http://localhost:%s/#overview\n' "$PORT"
printf '  📦  Fresh install →  curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | CHINNA_FRESH=1 bash\n\n'
printf '  Quick commands:\n'
printf '    chinna                  → Terminal sidekick\n'
printf '    chinna code             → global Mac agent\n'
printf '    source ~/.zshrc         → activate chinna in this terminal\n'
printf '    chinna doctor           → full system health check\n'
printf '    chinna dashboard        → open dashboard\n\n'

open "http://localhost:$PORT/#overview" 2>/dev/null || true
