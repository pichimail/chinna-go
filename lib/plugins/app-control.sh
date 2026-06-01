#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"app-control","name":"App Control","icon":"🍎","description":"Open apps, Finder, and the app uninstaller dashboard.","category":"macOS"}'; }
gs_plugin_actions(){ echo '[{"id":"finder","name":"Open Finder","kind":"button"},{"id":"open-app","name":"Open App","kind":"form","fields":[{"name":"app","label":"App name","type":"text","placeholder":"Safari","required":true}]},{"id":"uninstaller","name":"Open Uninstaller","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in finder) open -a Finder >/dev/null 2>&1; gs_ok "Opened Finder";; open-app) app="$(gs_payload_value app)"; [ -n "$app" ] || { gs_fail "app required"; exit 1; }; open -a "$app" >/dev/null 2>&1 && gs_ok "Opened $app" || gs_fail "Could not open $app";; uninstaller) gs_open_dashboard "/#apps";; *) gs_fail "unknown action";; esac; }
