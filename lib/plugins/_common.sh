#!/usr/bin/env bash
# Shared helpers for built-in Chinna plugins.

gs_chinna_bin() {
    if command -v chinna >/dev/null 2>&1; then
        command -v chinna
    elif [ -x "$HOME/.local/bin/chinna" ]; then
        printf '%s\n' "$HOME/.local/bin/chinna"
    else
        printf '%s\n' "${CHINNA_HOME:-$HOME/.chinna}/bin/chinna"
    fi
}

gs_json() {
    local ok="$1" result="$2"
    python3 - "$ok" "$result" <<'PY'
import json, sys
print(json.dumps({"ok": sys.argv[1] == "1", "result": sys.argv[2]}))
PY
}

gs_ok() { gs_json 1 "${1:-done}"; }
gs_fail() {
    python3 - "${1:-failed}" <<'PY'
import json, sys
print(json.dumps({"error": sys.argv[1]}))
PY
}

gs_payload_value() {
    local key="$1" default="${2:-}"
    python3 - "$key" "$default" <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ.get("GS_PLUGIN_PAYLOAD") or "{}")
except Exception:
    data = {}
value = data.get(sys.argv[1], sys.argv[2])
if value is None:
    value = ""
print(str(value))
PY
}

gs_run_chinna() {
    local bin out code
    bin="$(gs_chinna_bin)"
    if [ ! -x "$bin" ] && ! command -v "$bin" >/dev/null 2>&1; then
        gs_fail "chinna command not found"
        return 1
    fi
    out="$("$bin" "$@" 2>&1)"
    code=$?
    if [ "$code" -eq 0 ]; then
        gs_ok "${out:-done}"
    else
        gs_fail "${out:-command failed}"
        return "$code"
    fi
}

gs_open_dashboard() {
    local path="${1:-}"
    open "http://localhost:${CHINNA_DASHBOARD_PORT:-7777}${path}" >/dev/null 2>&1
    gs_ok "Opened Chinna dashboard"
}
