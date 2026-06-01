#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"secure-chat","name":"Secure Chat","icon":"🛡","description":"Open Secure Chat, settings, and TURN diagnostics.","category":"Communication"}'; }
gs_plugin_actions(){ echo '[{"id":"open","name":"Open Secure Chat","kind":"button"},{"id":"settings","name":"Open Relay Settings","kind":"button"},{"id":"turn","name":"Open TURN Test","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in open) gs_open_dashboard "/#chatx";; settings|turn) gs_open_dashboard "/#settings";; *) gs_fail "unknown action";; esac; }
