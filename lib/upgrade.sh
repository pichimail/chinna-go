#!/usr/bin/env bash
# Chinna V6.9 upgrade panel
# Direct terminal entrypoint for upgrade flow - no extra npx/dev commands.

upgrade_version_log_file() {
    if [ -f "$CHINNA_HOME/version-log.json" ]; then
        printf '%s\n' "$CHINNA_HOME/version-log.json"
        return 0
    fi
    if [ -f "$REPO_ROOT/version-log.json" ]; then
        printf '%s\n' "$REPO_ROOT/version-log.json"
        return 0
    fi
    return 1
}

upgrade_current_entry() {
    local file
    file="$(upgrade_version_log_file 2>/dev/null)" || return 0
    python3 - "$file" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {}
versions = data.get("versions") or []
if not versions:
    raise SystemExit(0)
item = versions[0]
print(item.get("version", ""))
print(item.get("date", ""))
print(item.get("title", ""))
for line in (item.get("improved") or [])[:4]:
    print(f"+ {line}")
for line in (item.get("resolved") or [])[:3]:
    print(f"- {line}")
PY
}

upgrade_pause() {
    echo ""
    echo -ne "  ${Y}Press ENTER to return to the upgrade panel...${RESET} "
    read -r _
}

upgrade_render_panel() {
    local remote_ver="${1:-}"
    local local_ver="${2:-$CHINNA_VERSION}"
    local entry
    entry="$(upgrade_current_entry 2>/dev/null || true)"

    clear
    echo ""
    echo -e "  ${BOLD}${WHITE}chinna${RESET}  ${DIM}v${local_ver}${RESET}"
    echo -e "  ${ACCENT}chinna v6.9 upgrade${RESET} ${DARK}·${RESET} ${GRAY}direct terminal panel${RESET}"
    echo -e "  ${DARK}────────────────────────────────────────────────${RESET}"
    echo -e "  ${GRAY}local${RESET}  ${WHITE}v${local_ver}${RESET}"
    if [ -n "$remote_ver" ]; then
        echo -e "  ${GRAY}latest${RESET} ${WHITE}v${remote_ver}${RESET}"
    else
        echo -e "  ${GRAY}latest${RESET} ${DARK}unavailable${RESET}"
    fi
    echo ""
    echo -e "  ${BOLD}Actions${RESET}"
    echo -e "  ${C}1${RESET}  Apply upgrade now"
    echo -e "  ${C}2${RESET}  Open dashboard"
    echo -e "  ${C}3${RESET}  Show release notes"
    echo -e "  ${C}4${RESET}  Show help"
    echo -e "  ${C}q${RESET}  Quit"
    echo ""
    echo -e "  ${BOLD}Current release${RESET}"
    if [ -n "$entry" ]; then
        local line_no=0
        while IFS= read -r line; do
            line_no=$((line_no + 1))
            case "$line_no" in
                1) echo -e "  ${WHITE}${line}${RESET}  ${DIM}latest bundle${RESET}" ;;
                2) echo -e "  ${GRAY}Date:${RESET} ${line}" ;;
                3) echo -e "  ${WHITE}${line}${RESET}" ;;
                *)
                    case "$line" in
                        +\ *) echo -e "  ${ACCENT}•${RESET} ${line#+ }" ;;
                        -\ *) echo -e "  ${WARN}-${RESET} ${line#- }" ;;
                        *) echo -e "  ${GRAY}${line}${RESET}" ;;
                    esac
                    ;;
            esac
        done <<< "$entry"
    else
        echo -e "  ${DARK}No version log found.${RESET}"
    fi
    echo ""
    echo -ne "  ${PROMPT}chinna upgrade ❯ ${RESET}"
}

upgrade_show_release_notes() {
    local file
    file="$(upgrade_version_log_file 2>/dev/null)" || {
        warn "No version log found"
        return 0
    }

    clear
    echo ""
    echo -e "  ${BOLD}${WHITE}Release Notes${RESET}"
    echo -e "  ${DARK}────────────────────────────────────────────────${RESET}"
    python3 - "$file" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    data = {"versions": []}
for item in (data.get("versions") or [])[:3]:
    print(f"\n  {item.get('version','?')}  {item.get('title','')}")
    date = item.get("date", "")
    if date:
        print(f"  Date: {date}")
    for label in ("improved", "resolved"):
        values = item.get(label) or []
        if not values:
            continue
        prefix = "+" if label == "improved" else "-"
        for line in values[:4]:
            print(f"  {prefix} {line}")
PY
    upgrade_pause
}

cmd_upgrade() {
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        cmd_update --apply
        return $?
    fi

    local local_ver remote_ver choice
    local_ver="${CHINNA_VERSION:-unknown}"
    remote_ver="$(remote_version)"

    while :; do
        upgrade_render_panel "$remote_ver" "$local_ver"
        if ! read -r choice; then
            echo ""
            return 0
        fi

        case "$choice" in
            1|u|U|update)
                echo ""
                cmd_update --apply
                return $?
                ;;
            2|d|D|dashboard)
                echo ""
                cmd_dashboard
                return $?
                ;;
            3|r|R|notes)
                upgrade_show_release_notes
                ;;
            4|h|H|help)
                echo ""
                show_help
                upgrade_pause
                ;;
            q|Q|quit|exit)
                echo ""
                info "Upgrade panel closed"
                return 0
                ;;
            "")
                ;;
            *)
                warn "Choose 1, 2, 3, 4, or q"
                sleep 1
                ;;
        esac
    done
}
