#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"storage-tools","name":"Storage Tools","icon":"▦","description":"Open disk explorer, duplicate finder, and file manager.","category":"Storage"}'; }
gs_plugin_actions(){ echo '[{"id":"storage","name":"Disk Explorer","kind":"button"},{"id":"dupes","name":"Duplicates","kind":"button"},{"id":"files","name":"File Manager","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in storage) gs_open_dashboard "/#storage";; dupes) gs_open_dashboard "/#dupes";; files) gs_open_dashboard "/#files";; *) gs_fail "unknown action";; esac; }
