#!/usr/bin/env bash
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"
gs_plugin_meta(){ echo '{"id":"system-health","name":"System Health","icon":"🩺","description":"Run doctor checks and create desktop system reports.","category":"System"}'; }
gs_plugin_actions(){ echo '[{"id":"doctor","name":"Run Doctor","kind":"button"},{"id":"report","name":"Save Report","kind":"button"},{"id":"dashboard","name":"Open Overview","kind":"button"}]'; }
gs_plugin_run_action(){ case "$1" in doctor) gs_run_chinna doctor;; report) curl -fsS "http://localhost:${CHINNA_DASHBOARD_PORT:-7777}/api/sysreport" >/dev/null && gs_ok "System report generated on Desktop" || gs_fail "Dashboard unavailable";; dashboard) gs_open_dashboard "/#overview";; *) gs_fail "unknown action";; esac; }
