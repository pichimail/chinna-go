#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"deep-clean","name":"Deep Clean","icon":"🧹","description":"Open cleanup controls or start Chinna clean tasks.","category":"Storage"}'; }
gs_plugin_actions(){ echo '[{"id":"open","name":"Open Cleaner","kind":"button"},{"id":"clean","name":"Run Deep Clean","kind":"button","confirm":"Start Chinna deep clean?"},{"id":"purge","name":"Purge RAM","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in open) gs_open_dashboard "/#files";; clean) gs_run_chinna clean;; purge) gs_run_chinna purge;; *) gs_fail "unknown action";; esac; }
