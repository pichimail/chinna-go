#!/usr/bin/env bash
# lib/daemon.sh — LaunchAgent background daemon

CHINNA_HOME="${CHINNA_HOME:-$HOME/.chinna}"
CHINNA_LOG="$CHINNA_HOME/chinna.log"
CHINNA_PID="$CHINNA_HOME/chinna.pid"
PLIST_PATH="$HOME/Library/LaunchAgents/com.chinna.daemon.plist"
UPDATE_PROMPT_FILE="$CHINNA_HOME/update_prompted_version"
UPDATE_SNOOZE_FILE="$CHINNA_HOME/update_snooze_until"
UPDATE_REMINDER_INTERVAL="${CHINNA_UPDATE_REMINDER_INTERVAL:-10800}"

source "$CHINNA_HOME/config" 2>/dev/null || true
source "$CHINNA_HOME/lib/notify.sh" 2>/dev/null || true

load_api_json_keys() {
    [ -f "$CHINNA_HOME/api_keys.json" ] || return 0
    command -v python3 >/dev/null 2>&1 || return 0
    eval "$(python3 - "$CHINNA_HOME/api_keys.json" <<'PY'
import json, os, sys
path = sys.argv[1]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
for key in ('OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'):
    value = str(data.get(key, '') or '').replace("'", "'\"'\"'")
    print(f"export {key}='{value}'")
PY
)"
}

save_api_json_key() {
    local key="$1" value="$2"
    command -v python3 >/dev/null 2>&1 || return 1
    python3 - "$CHINNA_HOME/api_keys.json" "$key" "$value" <<'PY'
import json, os, sys
path, key, value = sys.argv[1:4]
data = {}
try:
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
except Exception:
    data = {}
data[key] = value
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=True)
PY
}

load_api_json_keys

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$CHINNA_LOG"; }

current_chinna_version() {
    if [ -f "$CHINNA_HOME/VERSION" ]; then
        tr -d '[:space:]' < "$CHINNA_HOME/VERSION"
        return 0
    fi
    printf '%s\n' "${CHINNA_VERSION:-1.0.0}"
}

update_snooze_until() {
    [ -f "$UPDATE_SNOOZE_FILE" ] || { echo 0; return 0; }
    cat "$UPDATE_SNOOZE_FILE" 2>/dev/null | tr -cd '[:digit:]'
}

set_update_snooze() {
    local secs="$1"
    local now
    now=$(date +%s)
    echo $((now + secs)) > "$UPDATE_SNOOZE_FILE"
}

clear_update_snooze() {
    rm -f "$UPDATE_SNOOZE_FILE" 2>/dev/null || true
}

run_quick_action() {
    local action="$1"
    local chinna_bin
    chinna_bin="$(command -v chinna 2>/dev/null || echo "$CHINNA_HOME/bin/chinna")"
    case "$action" in
        purge)
            nohup "$chinna_bin" purge >> "$CHINNA_LOG" 2>&1 &
            chinna_info_toast "Quick Action" "⚡ Purge RAM started" 2>/dev/null || true
            ;;
        clean)
            nohup "$chinna_bin" clean >> "$CHINNA_LOG" 2>&1 &
            chinna_info_toast "Quick Action" "🧹 Deep Clean started" 2>/dev/null || true
            ;;
        update)
            nohup "$chinna_bin" update --apply >> "$CHINNA_LOG" 2>&1 &
            chinna_info_toast "Quick Action" "⬆️ Update started" 2>/dev/null || true
            ;;
    esac
}

show_quick_actions_overlay() {
    local choice
    choice=$(osascript 2>/dev/null <<'APPLESCRIPT'
set picked to choose from list {"⚡ Purge RAM", "🧹 Deep Clean", "⬆️ Update", "Later"} with prompt "🟠 Chinna Quick Actions" default items {"Later"}
if picked is false then
    return "Later"
else
    return item 1 of picked
end if
APPLESCRIPT
)
    case "$choice" in
        "⚡ Purge RAM") run_quick_action purge ;;
        "🧹 Deep Clean") run_quick_action clean ;;
        "⬆️ Update") run_quick_action update ;;
        *) ;;
    esac
}

install_notch_quick_actions() {
    if command -v install_chinna_swiftbar_actions >/dev/null 2>&1; then
        install_chinna_swiftbar_actions >/dev/null || return 1
        log "SwiftBar quick actions installed"
        return 0
    fi
    if ! command -v swiftbar >/dev/null 2>&1 && [ ! -d "/Applications/SwiftBar.app" ]; then
        log "SwiftBar not installed; notch/menu quick actions unavailable"
        return 1
    fi
    local plugin_dir="$HOME/Library/Application Support/SwiftBar/Plugins"
    local plugin_path="$plugin_dir/chinna.1m.sh"
    local chinna_bin dash_url
    chinna_bin="$(command -v chinna 2>/dev/null || echo "$CHINNA_HOME/bin/chinna")"
    dash_url="http://localhost:${CHINNA_DASHBOARD_PORT:-7777}"
    mkdir -p "$plugin_dir"
    cat > "$plugin_path" <<PLUGIN
#!/usr/bin/env bash
echo "CH"
echo "---"
echo "Open Dashboard | bash='open' param1='${dash_url}' terminal=false refresh=false"
echo "Install / Refresh Mac App | bash='${chinna_bin}' param1='app-install' terminal=false refresh=false"
echo "🧩 Plugins | bash='open' param1='${dash_url}/#plugins' terminal=false refresh=false"
echo "💬 WhatsApp | bash='open' param1='${dash_url}/#whatsapp' terminal=false refresh=false"
echo "🛡 Secure Chat | bash='open' param1='${dash_url}/#chatx' terminal=false refresh=false"
echo "⚡ Purge RAM | bash='${chinna_bin}' param1='purge' terminal=false refresh=true"
echo "🧹 Deep Clean | bash='${chinna_bin}' param1='clean' terminal=false refresh=true"
echo "⬆️ Update Now | bash='${chinna_bin}' param1='update' param2='--apply' terminal=false refresh=true"
echo "⛔ Quit Chinna | bash='${chinna_bin}' param1='stop' terminal=false refresh=true"
PLUGIN
    chmod +x "$plugin_path"
    log "SwiftBar quick actions installed at $plugin_path"
    return 0
}

version_gt() {
    [ "$1" != "$2" ] || return 1
    [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

# ─── Install LaunchAgent plist ─────────────────────────────────
install_launchagent() {
    local chinna_bin
    chinna_bin=$(command -v chinna || echo "/usr/local/bin/chinna")

    mkdir -p "$HOME/Library/LaunchAgents"

    cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.chinna.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>$chinna_bin</string>
        <string>_daemon_loop</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$CHINNA_LOG</string>
    <key>StandardErrorPath</key>
    <string>$CHINNA_LOG</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CHINNA_HOME</key>
        <string>$CHINNA_HOME</string>
        <key>HOME</key>
        <string>$HOME</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST

    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH" 2>/dev/null
    echo "  ✓ LaunchAgent installed — Chinna starts on every login"
}

# ─── Remove LaunchAgent ────────────────────────────────────────
remove_launchagent() {
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "  ✓ LaunchAgent removed"
}

# ─── Daemon status ─────────────────────────────────────────────
daemon_status() {
    if launchctl list 2>/dev/null | grep -q "com.chinna.daemon"; then
        echo "  ✓ Chinna daemon: RUNNING"
    else
        echo "  ✗ Chinna daemon: STOPPED"
    fi
    if [ -f "$CHINNA_LOG" ]; then
        echo "  Last 5 log lines:"
        tail -5 "$CHINNA_LOG" | sed 's/^/    /'
    fi
}

# ─── Disk monitor ─────────────────────────────────────────────
check_disk() {
    local pct
    pct=$(df /System/Volumes/Data 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || \
          df / | awk 'NR==2{gsub(/%/,"",$5); print $5}')

    log "Disk check: ${pct}% used"

    if [ "${pct:-0}" -ge 85 ]; then
        log "Disk warning triggered at ${pct}%"
        # Send notification with action
        local result
        result=$(osascript 2>/dev/null <<APPLESCRIPT
button returned of (display alert "💾 Disk at ${pct}% — Chinna Alert" message "Your Mac is running low on storage.\nChinna can clean it up right now." buttons {"Ignore", "Remind in 2h", "Clean Now"} default button "Clean Now" giving up after 30)
APPLESCRIPT
)
        case "$result" in
            "Clean Now")
                log "User chose Clean Now"
                chinna clean >> "$CHINNA_LOG" 2>&1
                osascript -e 'display notification "Cleanup complete! Reboot to see full effect." with title "🟠 Chinna Done" sound name "Glass"' 2>/dev/null
                ;;
            "Remind in 2h")
                log "User chose Remind in 2h"
                sleep 7200
                check_disk
                ;;
            *)
                log "User ignored disk warning"
                ;;
        esac
    fi
}

# ─── Auto-update check ────────────────────────────────────────
check_update() {
    local repo="${CHINNA_REPO:-pichimail/chinna-go}"
    local branch="${CHINNA_BRANCH:-main}"
    local current_ver
    current_ver="$(current_chinna_version)"
    local now
    now=$(date +%s)

    log "Checking for updates..."
    local remote_ver
    remote_ver=$(curl -fsSL "https://raw.githubusercontent.com/${repo}/${branch}/VERSION" 2>/dev/null | tr -d '[:space:]')

    if [ -z "$remote_ver" ]; then
        log "Could not fetch remote version"
        return 0
    fi

    if version_gt "$remote_ver" "$current_ver"; then
        local snooze_until
        snooze_until=$(update_snooze_until)
        if [ -n "$snooze_until" ] && [ "$snooze_until" -gt "$now" ] 2>/dev/null; then
            log "Update reminder snoozed until $(date -r "$snooze_until" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$snooze_until")"
            return 0
        fi

        log "Update available: $current_ver → $remote_ver"
        printf '%s\n' "$remote_ver" > "$UPDATE_PROMPT_FILE" 2>/dev/null || true

        local choice
        choice=$(chinna_toast_action \
            "Chinna Update Available" \
            "v${remote_ver} is ready.\nUpdate now, schedule, or remind later?" \
            "Update Now|Later|Schedule" 2>/dev/null)
        [ -n "$choice" ] || choice="Later"

        case "$choice" in
            "Update Now")
                log "User approved update to v${remote_ver}"
                clear_update_snooze
                run_quick_action update
                ;;
            "Schedule")
                local schedule
                schedule=$(osascript 2>/dev/null <<'APPLESCRIPT'
set picked to choose from list {"In 1 hour", "In 3 hours", "In 6 hours", "Tomorrow"} with prompt "Schedule Chinna update reminder" default items {"In 3 hours"}
if picked is false then
    return "Later"
else
    return item 1 of picked
end if
APPLESCRIPT
)
                case "$schedule" in
                    "In 1 hour") set_update_snooze 3600 ;;
                    "In 6 hours") set_update_snooze 21600 ;;
                    "Tomorrow") set_update_snooze 86400 ;;
                    *) set_update_snooze 10800 ;;
                esac
                chinna_info_toast "Update scheduled" "Reminder set: ${schedule:-In 3 hours}" 2>/dev/null || true
                log "User scheduled update reminder: ${schedule:-In 3 hours}"
                ;;
            *)
                set_update_snooze "$UPDATE_REMINDER_INTERVAL"
                chinna_info_toast "Update postponed" "I will remind you again in 3 hours." 2>/dev/null || true
                log "User postponed update to v${remote_ver}; snoozed ${UPDATE_REMINDER_INTERVAL}s"
                ;;
        esac
    else
        log "Already on latest version $current_ver"
        rm -f "$UPDATE_PROMPT_FILE" 2>/dev/null || true
        clear_update_snooze
    fi
}

# ─── Telegram polling (runs in daemon) ────────────────────────
telegram_poll() {
    local token="${TELEGRAM_BOT_TOKEN:-}"
    [ -z "$token" ] && return 0
    local chat_id="${TELEGRAM_CHAT_ID:-}"
    local pair_code=""
    [ -f "$CHINNA_HOME/telegram_pair.json" ] && pair_code=$(python3 - "$CHINNA_HOME/telegram_pair.json" <<'PY'
import json, os, sys
path = sys.argv[1]
try:
    with open(path) as f:
        data = json.load(f)
    print(data.get('code', '') or '')
except Exception:
    pass
PY
)

    local offset_file="$CHINNA_HOME/tg_offset"
    local offset=0
    [ -f "$offset_file" ] && offset=$(cat "$offset_file")

    local resp
    resp=$(curl -s "https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=5" 2>/dev/null)
    local count
    count=$(echo "$resp" | jq '.result | length' 2>/dev/null || echo 0)

    for i in $(seq 0 $((count-1))); do
        local update_id from_id text
        update_id=$(echo "$resp" | jq ".result[$i].update_id" 2>/dev/null)
        from_id=$(echo "$resp" | jq ".result[$i].message.from.id" 2>/dev/null)
        text=$(echo "$resp" | jq -r ".result[$i].message.text // \"\"" 2>/dev/null)
        offset=$((update_id+1))
        echo "$offset" > "$offset_file"

        [ -z "$text" ] && continue

        local lower
        lower=$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')
        if [ -n "$pair_code" ] && [ "$chat_id" != "$from_id" ]; then
            case "$lower" in
                "/start pair_${pair_code}"|"/pair ${pair_code}"|"pair ${pair_code}"|"/start ${pair_code}")
                    chat_id="$from_id"
                    save_api_json_key "TELEGRAM_CHAT_ID" "$chat_id"
                    export TELEGRAM_CHAT_ID="$chat_id"
                    log "Telegram paired with chat id ${chat_id}"
                    curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
                        --data-urlencode "chat_id=${chat_id}" \
                        --data-urlencode "text=✅ Chinna paired. You can now send /status, /scan, /clean, /purge, free <text>, pro <text>, or shell <cmd>." \
                        >/dev/null 2>&1
                    continue
                    ;;
            esac
        fi

        [ -n "$chat_id" ] && [ "$from_id" != "$chat_id" ] && continue

        log "Telegram: $text"

        # Toast notification on Mac
        osascript -e "display notification \"$text\" with title \"📡 Telegram → Chinna\" sound name \"Ping\"" 2>/dev/null

        # Handle command
        local reply=""
        case "${text,,}" in
            /clean|clean)   reply=$(chinna clean 2>&1 | tail -5) ;;
            /purge|purge)   chinna purge >/dev/null 2>&1; reply="RAM purged ✓" ;;
            /scan|scan)     reply=$(chinna scan 2>&1 | grep -E "GB|MB|used|free" | head -15) ;;
            /status|status) reply="💾 Disk: $(df -h /System/Volumes/Data 2>/dev/null | awk 'NR==2{print $3" used · "$4" free · "$5" full"}')
🧠 RAM: $(vm_stat 2>/dev/null | awk '/Pages free/{printf "%.0f MB free\n", $3*16384/1048576}')
⚙️  CPU: $(top -l 1 -s 0 2>/dev/null | awk '/CPU usage/{print $3" user"}')" ;;
            free\ *)        reply=$(chinna free "${text#free }" 2>&1) ;;
            pro\ *)         reply=$(chinna pro "${text#pro }" 2>&1) ;;
            shell\ *)       reply=$(eval "${text#shell }" 2>&1 | head -30) ;;
            /help|help|/start) reply="🟠 Chinna Commands:
clean — deep clean disk
purge — free RAM
scan — disk diagnostics
status — disk/RAM/CPU
free <text> — free AI chat
pro <text> — paid AI chat
shell <cmd> — run command" ;;
            *)
                # Try intent engine
                source "$CHINNA_HOME/lib/lang.sh" 2>/dev/null
                local intent
                intent=$(resolve_intent "$text" 2>/dev/null || echo "unknown")
                case "$intent" in
                    clean)   chinna clean >/dev/null 2>&1; reply="Cleaning done ✓" ;;
                    purge)   chinna purge >/dev/null 2>&1; reply="RAM purged ✓" ;;
                    scan)    reply=$(chinna scan 2>&1 | head -20) ;;
                    status)  reply="Disk: $(df -h / | awk 'NR==2{print $4" free"}')" ;;
                    *)       reply="Understood. Try: clean, purge, scan, status, free <text>" ;;
                esac
                ;;
        esac

        # Send reply (Telegram 4096 char limit)
        local truncated="${reply:0:3900}"
        curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" \
            --data-urlencode "chat_id=${chat_id}" \
            --data-urlencode "text=${truncated}" \
            >/dev/null 2>&1
        log "Telegram reply sent (${#truncated} chars)"
    done
}

# ─── Main daemon loop ─────────────────────────────────────────
daemon_loop() {
    log "Chinna daemon started (PID $$)"
    echo $$ > "$CHINNA_PID"

    local disk_check_interval=3600   # 1 hour
    local update_check_interval="$UPDATE_REMINDER_INTERVAL" # default 3 hours
    local tg_poll_interval=5          # 5 seconds

    local last_disk_check=0
    local last_update_check=0

    while true; do
        local now
        now=$(date +%s)

        # Telegram polling (every 5s)
        telegram_poll

        # Disk check (every hour)
        if (( now - last_disk_check >= disk_check_interval )); then
            check_disk
            last_disk_check=$now
        fi

        # Auto-update reminder (every 3h)
        if (( now - last_update_check >= update_check_interval )); then
            check_update
            last_update_check=$now
        fi

        sleep "$tg_poll_interval"
    done
}
