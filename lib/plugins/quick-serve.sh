#!/usr/bin/env bash
# Quick Local Server — serve any folder over HTTP for fast preview/sharing
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"

PIDFILE="${CHINNA_HOME:-$HOME/.chinna}/quickserve.pid"
PORTFILE="${CHINNA_HOME:-$HOME/.chinna}/quickserve.port"

gs_plugin_meta(){ echo '{"id":"quick-serve","name":"Quick Local Server","icon":"🌐","description":"Serve any folder over HTTP for instant local preview or LAN sharing.","category":"Dev"}'; }

gs_plugin_actions(){ cat <<'JSON'
[
 {"id":"serve","name":"Start Server","kind":"form","style":"solid","fields":[{"name":"path","label":"Folder to serve","placeholder":"~/dev/site","type":"text","required":true},{"name":"port","label":"Port","placeholder":"8080","type":"text","required":false}]},
 {"id":"open","name":"Open in Browser","kind":"button"},
 {"id":"stop","name":"Stop Server","kind":"button","confirm":"Stop the running local server?"}
]
JSON
}

_expand(){ eval echo "$1"; }

gs_plugin_run_action(){
  case "$1" in
    serve)
      local p port; p="$(_expand "$(gs_payload_value path "")")"; port="$(gs_payload_value port 8080)"
      [[ "$port" =~ ^[0-9]+$ ]] || port=8080
      [ -d "$p" ] || { gs_fail "Folder not found: $p"; return 1; }
      if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
        gs_fail "A server is already running on port $(cat "$PORTFILE" 2>/dev/null). Stop it first."; return 1
      fi
      ( cd "$p" && nohup python3 -m http.server "$port" >/dev/null 2>&1 & echo $! > "$PIDFILE" ) >/dev/null 2>&1
      echo "$port" > "$PORTFILE"
      sleep 1
      gs_ok "Serving $p at http://localhost:${port}";;
    open)
      local port; port="$(cat "$PORTFILE" 2>/dev/null)"
      [ -n "$port" ] || { gs_fail "No server running"; return 1; }
      open "http://localhost:${port}" >/dev/null 2>&1; gs_ok "Opened http://localhost:${port}";;
    stop)
      if [ -f "$PIDFILE" ]; then
        local pid; pid="$(cat "$PIDFILE")"; kill "$pid" 2>/dev/null
        rm -f "$PIDFILE" "$PORTFILE"; gs_ok "Local server stopped"
      else gs_ok "No server was running"; fi;;
    *) gs_fail "unknown action";;
  esac
}
