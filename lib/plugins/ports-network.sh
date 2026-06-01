#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"ports-network","name":"Ports & Network","icon":"🌐","description":"Inspect listening ports, kill a port, and open network tools.","category":"Network"}'; }
gs_plugin_actions(){ echo '[{"id":"ports","name":"Show Ports","kind":"button"},{"id":"kill-port","name":"Kill Port","kind":"form","fields":[{"name":"port","label":"Port","type":"number","placeholder":"3000","required":true}]},{"id":"open","name":"Open Network View","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in ports) gs_run_chinna ports;; kill-port) port="$(gs_payload_value port)"; [ -n "$port" ] || { gs_fail "port required"; exit 1; }; pids="$(lsof -ti TCP:"$port" 2>/dev/null)"; if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null; gs_ok "Killed processes on port $port: $pids"; else gs_ok "No process on port $port"; fi;; open) gs_open_dashboard "/#network";; *) gs_fail "unknown action";; esac; }
