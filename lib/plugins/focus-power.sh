#!/usr/bin/env bash
# Focus & Power — keep-awake, restart Finder/Dock, toggle hidden files
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"

gs_plugin_meta(){ echo '{"id":"focus-power","name":"Focus & Power","icon":"⚡","description":"Keep the Mac awake, restart Finder/Dock and toggle hidden files.","category":"System"}'; }

gs_plugin_actions(){ cat <<'JSON'
[
 {"id":"caffeinate","name":"Keep Awake","kind":"form","style":"solid","fields":[{"name":"minutes","label":"Minutes","placeholder":"60","type":"number","required":true}]},
 {"id":"stopcaffeinate","name":"Allow Sleep","kind":"button"},
 {"id":"restartfinder","name":"Restart Finder","kind":"button"},
 {"id":"restartdock","name":"Restart Dock","kind":"button"},
 {"id":"showhidden","name":"Show Hidden Files","kind":"button"},
 {"id":"hidehidden","name":"Hide Hidden Files","kind":"button"}
]
JSON
}

gs_plugin_run_action(){
  case "$1" in
    caffeinate)
      local m; m="$(gs_payload_value minutes 60)"
      [[ "$m" =~ ^[0-9]+$ ]] || { gs_fail "Enter minutes as a number"; return 1; }
      killall caffeinate 2>/dev/null
      ( nohup caffeinate -dimsu -t $(( m * 60 )) >/dev/null 2>&1 & ) >/dev/null 2>&1
      gs_ok "Keeping this Mac awake for ${m} minutes";;
    stopcaffeinate)
      killall caffeinate 2>/dev/null && gs_ok "Sleep re-enabled" || gs_ok "No keep-awake was active";;
    restartfinder)
      killall Finder 2>/dev/null; gs_ok "Finder restarted";;
    restartdock)
      killall Dock 2>/dev/null; gs_ok "Dock restarted";;
    showhidden)
      defaults write com.apple.finder AppleShowAllFiles -bool true && killall Finder 2>/dev/null; gs_ok "Hidden files are now visible";;
    hidehidden)
      defaults write com.apple.finder AppleShowAllFiles -bool false && killall Finder 2>/dev/null; gs_ok "Hidden files are now hidden";;
    *) gs_fail "unknown action";;
  esac
}
