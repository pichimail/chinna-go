#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"dev-runner","name":"Dev Runner","icon":"▶","description":"Bootstrap or open developer projects managed by Chinna.","category":"Developer"}'; }
gs_plugin_actions(){ echo '[{"id":"projects","name":"Open Projects","kind":"button"},{"id":"bootstrap","name":"Bootstrap Path","kind":"form","fields":[{"name":"path","label":"Project path","type":"text","placeholder":".","required":true}]},{"id":"dashboard","name":"Open Dashboard","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in projects) gs_open_dashboard "/#projects";; bootstrap) path="$(gs_payload_value path ".")"; gs_run_chinna plugins bootstrap "$path";; dashboard) gs_open_dashboard "/";; *) gs_fail "unknown action";; esac; }
