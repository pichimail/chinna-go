#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"project-audit","name":"Project Audit","icon":"📋","description":"Open project registry and run Chinna project audits.","category":"Developer"}'; }
gs_plugin_actions(){ echo '[{"id":"projects","name":"Open Projects","kind":"button"},{"id":"audit","name":"Audit Path","kind":"form","fields":[{"name":"path","label":"Project path","type":"text","placeholder":"~/myapp","required":true}]},{"id":"bootstrap","name":"Bootstrap Here","kind":"form","fields":[{"name":"path","label":"Project path","type":"text","placeholder":".","required":true}]}]'; }
gs_plugin_run_action(){ case "$1" in projects) gs_open_dashboard "/#projects";; audit) path="$(gs_payload_value path "$PWD")"; gs_run_chinna audit "$path";; bootstrap) path="$(gs_payload_value path ".")"; gs_run_chinna plugins bootstrap "$path";; *) gs_fail "unknown action";; esac; }
