#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"automation","name":"Automation","icon":"⚙","description":"Manage automation mode, daemon, auto-start, and quit actions.","category":"System"}'; }
gs_plugin_actions(){ echo '[{"id":"start","name":"Start Auto-Start","kind":"button"},{"id":"stop","name":"Stop Auto-Start","kind":"button"},{"id":"toggle","name":"Toggle Automation","kind":"button"},{"id":"quit","name":"Quit Chinna","kind":"button","confirm":"Stop the Chinna daemon/dashboard?"}]'; }
gs_plugin_run_action(){ case "$1" in start) gs_run_chinna start;; stop) gs_run_chinna stop;; toggle) curl -fsS -X POST -H 'Content-Type: application/json' -d '{}' "http://localhost:${CHINNA_DASHBOARD_PORT:-7777}/api/automation" >/dev/null && gs_ok "Automation toggled" || gs_fail "Dashboard unavailable";; quit) gs_run_chinna stop;; *) gs_fail "unknown action";; esac; }
