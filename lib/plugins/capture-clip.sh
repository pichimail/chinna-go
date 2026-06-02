#!/usr/bin/env bash
# Capture & Clipboard — screenshots to Desktop and clipboard helpers
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"

gs_plugin_meta(){ echo '{"id":"capture-clip","name":"Capture & Clipboard","icon":"📸","description":"Take screenshots to the Desktop and read, set or clear the clipboard.","category":"Tools"}'; }

gs_plugin_actions(){ cat <<'JSON'
[
 {"id":"shot","name":"Screenshot Screen","kind":"button","style":"solid"},
 {"id":"shotsel","name":"Screenshot Selection","kind":"button"},
 {"id":"clipread","name":"Read Clipboard","kind":"button"},
 {"id":"clipset","name":"Set Clipboard","kind":"form","fields":[{"name":"text","label":"Text","placeholder":"Copy this…","type":"text","required":true}]},
 {"id":"clipclear","name":"Clear Clipboard","kind":"button"}
]
JSON
}

gs_plugin_run_action(){
  local ts; ts="$(date +%Y%m%d-%H%M%S)"
  local out="$HOME/Desktop/Chinna-${ts}.png"
  case "$1" in
    shot)
      screencapture -x "$out" 2>/dev/null && gs_ok "Saved screenshot to ${out}" || gs_fail "Screenshot failed (check Screen Recording permission)";;
    shotsel)
      screencapture -i "$out" 2>/dev/null && [ -f "$out" ] && gs_ok "Saved selection to ${out}" || gs_fail "Selection cancelled or failed";;
    clipread)
      local c; c="$(pbpaste 2>/dev/null | head -c 600)"
      [ -n "$c" ] && gs_ok "Clipboard: $c" || gs_ok "Clipboard is empty or non-text";;
    clipset)
      local t; t="$(gs_payload_value text "")"
      [ -n "$t" ] || { gs_fail "Enter text to copy"; return 1; }
      printf '%s' "$t" | pbcopy && gs_ok "Copied to clipboard";;
    clipclear)
      printf '' | pbcopy && gs_ok "Clipboard cleared";;
    *) gs_fail "unknown action";;
  esac
}
