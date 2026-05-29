#!/usr/bin/env bash
# lib/notify.sh — macOS toast notifications (liquid glass, top-left)

# Send a macOS notification with optional action buttons
# Usage: chinna_notify "Title" "Message" [sound]
chinna_notify() {
    local title="${1:-Chinna}"
    local msg="${2:-Done}"
    local sound="${3:-Ping}"
    osascript 2>/dev/null <<APPLESCRIPT
display notification "${msg}" with title "🟠 ${title}" sound name "${sound}"
APPLESCRIPT
}

# Banner toast with action — uses AppleScript dialog for actionable toasts
# Usage: chinna_toast_action "Title" "Message" "Btn1|Btn2|Btn3"
# Returns: selected button text
chinna_toast_action() {
    local title="${1:-Chinna}"
    local msg="${2:-}"
    local buttons="${3:-OK|Cancel}"
    local default_btn=$(echo "$buttons" | cut -d'|' -f1)
    local btn2=$(echo "$buttons" | cut -d'|' -f2)
    local btn3=$(echo "$buttons" | cut -d'|' -f3)

    local script=""
    if [ -n "$btn3" ]; then
        script='button returned of (display alert "'"$title"'" message "'"$msg"'" buttons {"'"$btn3"'", "'"$btn2"'", "'"$default_btn"'"} default button "'"$default_btn"'" giving up after 10)'
    elif [ -n "$btn2" ]; then
        script='button returned of (display alert "'"$title"'" message "'"$msg"'" buttons {"'"$btn2"'", "'"$default_btn"'"} default button "'"$default_btn"'" giving up after 10)'
    else
        script='button returned of (display alert "'"$title"'" message "'"$msg"'" buttons {"'"$default_btn"'"} default button "'"$default_btn"'" giving up after 10)'
    fi

    osascript -e "$script" 2>/dev/null
}

# Disk warning toast with Clean Now / Later / Ignore
chinna_disk_toast() {
    local pct="${1:-85}"
    local result
    result=$(chinna_toast_action \
        "💾 Disk at ${pct}% — Chinna Alert" \
        "Your Mac is running low on disk space.\nChinna can clean it up right now." \
        "Clean Now|Remind in 2h|Ignore")
    echo "$result"
}

# Quick info toast (no buttons, auto-dismiss via notification)
chinna_info_toast()  { chinna_notify "$1" "$2" "Ping"; }
chinna_ok_toast()    { chinna_notify "✅ $1" "$2" "Glass"; }
chinna_warn_toast()  { chinna_notify "⚠️ $1" "$2" "Basso"; }
chinna_error_toast() { chinna_notify "❌ $1" "$2" "Sosumi"; }
chinna_ai_toast()    { chinna_notify "🤖 $1" "$2" "Ping"; }
chinna_tg_toast()    { chinna_notify "📡 Telegram" "$1" "Ping"; }

# ── Prompt 11 additions ──────────────────────────────────────
mac_sound() {
    local sound="${APPNOTIFYSOUND:-/System/Library/Sounds/Glass.aiff}"
    [ -f "$sound" ] && afplay "$sound" 2>/dev/null &
}

mac_speak() {
    local msg="$1"
    [ "${APPNOTIFYSPEAK:-off}" = "on" ] && say "$msg" 2>/dev/null &
}

done_task() {
    local msg="$1"
    echo "  ✓ $msg"
    chinna_notify "Chinna" "$msg"
    mac_sound
    mac_speak "$msg"
}

notify_test() {
    local msg="${1:-Chinna notification test}"
    echo "  Testing notifications..."
    chinna_notify "Chinna Test" "$msg"
    mac_sound
    mac_speak "$msg"
    echo "  ✓ notification + sound + speak triggered"
}

automation_on()  { chinna_setenv "$CHINNA_ENV_FILE" "APPAUTOMATIONMODE" "on";  echo "  ✓ Automation ON";  }
automation_off() { chinna_setenv "$CHINNA_ENV_FILE" "APPAUTOMATIONMODE" "off"; echo "  ✓ Automation OFF"; }
