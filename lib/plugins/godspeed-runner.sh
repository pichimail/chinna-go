#!/usr/bin/env bash
# Godspeed Runner — launch dev stacks, free ports, open projects (Godspeed suite)
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"

gs_plugin_meta(){ echo '{"id":"godspeed-runner","name":"Godspeed Runner","icon":"🚀","description":"Launch dev stacks, free busy ports and open projects instantly.","category":"Godspeed"}'; }

gs_plugin_actions(){ cat <<'JSON'
[
 {"id":"run","name":"Run Stack","kind":"form","style":"solid","fields":[{"name":"path","label":"Project path","placeholder":"~/dev/myapp","type":"text","required":true}]},
 {"id":"killport","name":"Free Port","kind":"form","fields":[{"name":"port","label":"Port","placeholder":"3000","type":"text","required":true}]},
 {"id":"open","name":"Open Folder","kind":"form","fields":[{"name":"path","label":"Project path","placeholder":"~/dev/myapp","type":"text","required":true}]},
 {"id":"code","name":"Open in Editor","kind":"form","fields":[{"name":"path","label":"Project path","placeholder":"~/dev/myapp","type":"text","required":true}]}
]
JSON
}

_expand(){ eval echo "$1"; }

gs_plugin_run_action(){
  local action="$1"
  case "$action" in
    run)
      local p; p="$(_expand "$(gs_payload_value path "")")"
      [ -d "$p" ] || { gs_fail "Folder not found: $p"; return 1; }
      local bin; bin="$(gs_chinna_bin)"
      ( cd "$p" && nohup "$bin" run "$p" >/dev/null 2>&1 & ) >/dev/null 2>&1
      gs_ok "Launched dev stack for $p (running in background)";;
    killport)
      local port; port="$(gs_payload_value port "")"
      [[ "$port" =~ ^[0-9]+$ ]] || { gs_fail "Enter a numeric port"; return 1; }
      local pids; pids="$(lsof -ti "tcp:${port}" 2>/dev/null)"
      if [ -z "$pids" ]; then gs_ok "Port ${port} is already free"; else
        echo "$pids" | xargs kill -9 2>/dev/null
        gs_ok "Freed port ${port} (killed: $(echo $pids | tr '\n' ' '))"
      fi;;
    open)
      local p; p="$(_expand "$(gs_payload_value path "")")"
      [ -e "$p" ] || { gs_fail "Path not found: $p"; return 1; }
      open "$p" >/dev/null 2>&1 && gs_ok "Opened $p in Finder" || gs_fail "Could not open $p";;
    code)
      local p; p="$(_expand "$(gs_payload_value path "")")"
      [ -e "$p" ] || { gs_fail "Path not found: $p"; return 1; }
      if command -v code >/dev/null 2>&1; then code "$p" >/dev/null 2>&1 && gs_ok "Opened $p in VS Code"
      else open -a "Visual Studio Code" "$p" >/dev/null 2>&1 && gs_ok "Opened $p in VS Code" || { open "$p" >/dev/null 2>&1; gs_ok "Editor not found; opened folder instead"; }
      fi;;
    *) gs_fail "unknown action";;
  esac
}
