#!/usr/bin/env bash
# Chinna installer / updater
# Keeps user data and API keys intact while refreshing code files.

set -euo pipefail

CHINNA_REPO="${CHINNA_REPO:-pichimail/chinna-go}"
CHINNA_HOME="${CHINNA_HOME:-$HOME/.chinna}"
INSTALL_MODE="${1:-install}"
REMOTE_VERSION="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

fetch_remote_tree() {
    local tmp root archive_url repo_name
    if [ -f "$REPO_ROOT/bin/chinna" ] && [ -f "$REPO_ROOT/lib/server.py" ]; then
        printf '%s\n' "$REPO_ROOT"
        return 0
    fi

    repo_name="${CHINNA_REPO##*/}"
    tmp="$(mktemp -d)"
    archive_url="https://codeload.github.com/${CHINNA_REPO}/tar.gz/refs/heads/main"

    curl -fsSL "$archive_url" | tar -xz -C "$tmp" || fail "Could not fetch ${CHINNA_REPO}"
    root="$tmp/${repo_name}-main"
    [ -d "$root" ] || fail "Unexpected archive layout"
    printf '%s\n' "$root"
}

copy_file() {
    local src="$1" dst="$2"
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
}

install_command_binary() {
    local src="$1" target="$2"
    local target_dir
    target_dir="$(dirname "$target")"

    mkdir -p "$target_dir" 2>/dev/null || true

    if [ -L "$target" ] && [ "$(readlink "$target" 2>/dev/null)" = "$src" ]; then
        return 0
    fi

    if [ -w "$target_dir" ]; then
        ln -sfn "$src" "$target"
    else
        if ! sudo ln -sfn "$src" "$target" 2>/dev/null; then
            return 1
        fi
    fi
}

refresh_installed_code() {
    local root="$1"
    local src_bin="$root/bin/chinna"
    local src_lib="$root/lib"
    local src_dashboard="$root/dashboard/index.html"
    local src_install="$root/install/install.sh"

    [ -f "$src_bin" ] || fail "Missing bin/chinna in source tree"
    [ -d "$src_lib" ] || fail "Missing lib directory in source tree"
    [ -f "$src_dashboard" ] || fail "Missing dashboard/index.html in source tree"

    mkdir -p "$CHINNA_HOME"

    # Remove stale code so old files do not linger between upgrades.
    rm -rf "$CHINNA_HOME/bin" "$CHINNA_HOME/lib" "$CHINNA_HOME/dashboard" "$CHINNA_HOME/install"
    rm -f "$CHINNA_HOME/dashboard_server.py"

    mkdir -p "$CHINNA_HOME/bin" "$CHINNA_HOME/lib" "$CHINNA_HOME/dashboard"

    copy_file "$src_bin" "$CHINNA_HOME/bin/chinna"
    chmod +x "$CHINNA_HOME/bin/chinna"

    for lib in "$src_lib"/*.sh; do
        [ -f "$lib" ] || continue
        copy_file "$lib" "$CHINNA_HOME/lib/$(basename "$lib")"
        chmod +x "$CHINNA_HOME/lib/$(basename "$lib")" 2>/dev/null || true
    done

    copy_file "$root/lib/server.py" "$CHINNA_HOME/lib/server.py"
    copy_file "$src_dashboard" "$CHINNA_HOME/dashboard/index.html"
    copy_file "$root/VERSION" "$CHINNA_HOME/VERSION"

    if [ -f "$src_install" ]; then
        mkdir -p "$CHINNA_HOME/install"
        copy_file "$src_install" "$CHINNA_HOME/install/install.sh"
        chmod +x "$CHINNA_HOME/install/install.sh" 2>/dev/null || true
    fi

    # Refresh the public command location(s).
    local installed=0
    if install_command_binary "$CHINNA_HOME/bin/chinna" /opt/homebrew/bin/chinna; then
        installed=1
    fi
    if install_command_binary "$CHINNA_HOME/bin/chinna" /usr/local/bin/chinna; then
        installed=1
    fi

    if [ "$installed" -eq 0 ]; then
        warn "Could not place chinna on your PATH. Add $CHINNA_HOME/bin to PATH or rerun the installer."
    fi
}

main() {
    local root
    root="$(fetch_remote_tree)"

    log "Installing Chinna ${REMOTE_VERSION:-latest}..."
    refresh_installed_code "$root"
    log "Chinna is installed at $CHINNA_HOME"
    log "User data and API keys were preserved."
}

main "$@"
