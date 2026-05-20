#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Chinna v2 Installer                                         ║
# ║  curl -fsSL https://raw.githubusercontent.com/              ║
# ║    pichimail/chinna-go/main/install/install.sh | bash        ║
# ╚══════════════════════════════════════════════════════════════╝
set -e

REPO="pichimail/chinna-go"
BRANCH="main"
RAW="https://raw.githubusercontent.com/$REPO/$BRANCH"
CHINNA_HOME="$HOME/.chinna"
BIN_DIR="/usr/local/bin"

# Colors
if [ -t 1 ]; then
    R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' C='\033[0;36m'
    ORANGE='\033[38;5;208m' BOLD='\033[1m' D='\033[2m' RESET='\033[0m'
else
    R='' G='' Y='' C='' ORANGE='' BOLD='' D='' RESET=''
fi

ok()   { echo -e "  ${G}✓${RESET} $*"; }
warn() { echo -e "  ${Y}!${RESET} $*"; }
fail() { echo -e "  ${R}✗${RESET} $*"; }
info() { echo -e "  ${C}ℹ${RESET} $*"; }

echo ""
echo -e "${ORANGE}   ╔═══════════════════════════════════════╗${RESET}"
echo -e "${ORANGE}   ║${RESET}  ${BOLD}C H I N N A  v2${RESET}  ${D}installer${RESET}            ${ORANGE}║${RESET}"
echo -e "${ORANGE}   ║${RESET}  ${D}telugu · hindi · english · tinglish${RESET}  ${ORANGE}║${RESET}"
echo -e "${ORANGE}   ╚═══════════════════════════════════════╝${RESET}"
echo ""

# ─── OS check ─────────────────────────────────────────────────
OS=$(uname -s)
ARCH=$(uname -m)
case "$OS" in
    Darwin) ok "macOS $ARCH detected" ;;
    Linux)  warn "Linux detected — partial support (no macOS notifications/daemon)" ;;
    *)      fail "Unsupported OS: $OS"; exit 1 ;;
esac

# ─── Sudo ─────────────────────────────────────────────────────
info "May ask for password to install to $BIN_DIR"
sudo -v 2>/dev/null || true

# ─── Xcode CLT ────────────────────────────────────────────────
if [ "$OS" = "Darwin" ] && ! xcode-select -p >/dev/null 2>&1; then
    warn "Installing Xcode Command Line Tools..."
    xcode-select --install 2>/dev/null || true
    echo ""
    warn "Complete the GUI installer, then re-run:"
    echo "    curl -fsSL $RAW/install/install.sh | bash"
    exit 0
fi

# ─── Homebrew ─────────────────────────────────────────────────
if ! command -v brew >/dev/null 2>&1; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null
    if [ -d /opt/homebrew/bin ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zshrc"
    elif [ -d /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi
ok "Homebrew ready"

# ─── Dependencies ─────────────────────────────────────────────
info "Installing dependencies (jq, fdupes, sox, bc, curl)..."
for pkg in jq fdupes sox bc curl; do
    brew list "$pkg" >/dev/null 2>&1 || brew install "$pkg" >/dev/null 2>&1 || true
done
ok "Dependencies installed"

# ─── Create directories ───────────────────────────────────────
mkdir -p "$CHINNA_HOME/bin" "$CHINNA_HOME/lib"

# ─── Download files ───────────────────────────────────────────
_download() {
    local src="$1" dst="$2"
    if curl -fsSL "$src" -o "$dst" 2>/dev/null; then
        ok "Downloaded $(basename "$dst")"
    else
        fail "Failed to download $src"
        exit 1
    fi
}

info "Downloading Chinna v2..."
_download "$RAW/bin/chinna"          "$CHINNA_HOME/bin/chinna"
_download "$RAW/lib/notify.sh"       "$CHINNA_HOME/lib/notify.sh"
_download "$RAW/lib/lang.sh"         "$CHINNA_HOME/lib/lang.sh"
_download "$RAW/lib/stack.sh"        "$CHINNA_HOME/lib/stack.sh"
_download "$RAW/lib/voice.sh"        "$CHINNA_HOME/lib/voice.sh"
_download "$RAW/lib/daemon.sh"       "$CHINNA_HOME/lib/daemon.sh"
_download "$RAW/lib/server.sh"       "$CHINNA_HOME/lib/server.sh"
mkdir -p "$CHINNA_HOME/dashboard"
_download "$RAW/dashboard/index.html" "$CHINNA_HOME/dashboard/index.html"
_download "$RAW/VERSION"             "$CHINNA_HOME/VERSION" 2>/dev/null || echo "2.0.0" > "$CHINNA_HOME/VERSION"

chmod +x "$CHINNA_HOME/bin/chinna"
chmod +x "$CHINNA_HOME/lib/"*.sh

# ─── Symlink ──────────────────────────────────────────────────
sudo ln -sf "$CHINNA_HOME/bin/chinna" "$BIN_DIR/chinna" 2>/dev/null \
    || ln -sf "$CHINNA_HOME/bin/chinna" "$HOME/.local/bin/chinna" 2>/dev/null \
    || true
ok "Installed to $BIN_DIR/chinna"

# ─── Config skeleton ──────────────────────────────────────────
if [ ! -f "$CHINNA_HOME/config" ]; then
    cat > "$CHINNA_HOME/config" <<'CFG'
# Chinna v2 config — edit or run: chinna config
# export OPENROUTER_API_KEY=''
# export OPENAI_API_KEY=''
# export TELEGRAM_BOT_TOKEN=''
# export TELEGRAM_CHAT_ID=''
# export GITHUB_TOKEN=''
# export CHINNA_FREE_MODEL='meta-llama/llama-3.3-70b-instruct:free'
# export CHINNA_PRO_MODEL='anthropic/claude-sonnet-4-5'
# export CHINNA_REPO='pichimail/chinna-go'
CFG
fi

# ─── Shell aliases ────────────────────────────────────────────
RC_FILE=""
[ "$(basename "$SHELL")" = "zsh" ]  && RC_FILE="$HOME/.zshrc"
[ "$(basename "$SHELL")" = "bash" ] && RC_FILE="$HOME/.bashrc"

if [ -n "$RC_FILE" ] && ! grep -q "# CHINNA_V2" "$RC_FILE" 2>/dev/null; then
    cat >> "$RC_FILE" <<'ALIASES'

# CHINNA_V2 — do not edit manually
[ -f "$HOME/.chinna/config" ] && source "$HOME/.chinna/config"
export PATH="$HOME/.chinna/bin:$PATH"
alias chinna-cleanmymac='chinna clean'
alias chinna-purgeram='chinna purge'
alias chinna-free='chinna free'
alias chinna-pro='chinna pro'
alias chinna-dupes='chinna dupes'
alias chinna-scan='chinna scan'
alias chinna-brew='chinna brew'
alias chinna-bot='chinna bot'
alias chinna-doctor='chinna doctor'
alias chinna-preview='chinna preview'
alias chinna-listen='chinna listen'
alias chinna-status='chinna status'
alias chinna-publish='chinna publish'
alias chinna-start='chinna start'
alias chinna-stop='chinna stop'
# END CHINNA_V2
ALIASES
    ok "Aliases added to $RC_FILE"
fi

# ─── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${ORANGE}   ════════════════════════════════════${RESET}"
echo -e "${G}   ✓ Chinna v2 installed successfully!${RESET}"
echo -e "${ORANGE}   ════════════════════════════════════${RESET}"
echo ""
echo -e "   ${BOLD}Next steps:${RESET}"
echo -e "     ${C}1.${RESET}  ${ORANGE}source $RC_FILE${RESET}   (or restart terminal)"
echo -e "     ${C}2.${RESET}  ${ORANGE}chinna config${RESET}     (add OpenRouter key)"
echo -e "     ${C}3.${RESET}  ${ORANGE}chinna start${RESET}      (start background daemon)"
echo -e "     ${C}4.${RESET}  ${ORANGE}chinna${RESET}            (open menu)"
echo ""
echo -e "   ${D}Try: chinna clean  ·  chinna \"na mac slow\"  ·  chinna doctor${RESET}"
echo ""
