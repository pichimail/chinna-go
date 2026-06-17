#!/usr/bin/env bash
# lib/cli-hub.sh — Chinna interactive command hub (Grok-style)

CHINNA_HUB_CAT=0
CHINNA_HUB_CATS=(home system dev settings)

# id|icon|title|desc|handler
CHINNA_HUB_HOME=(
    'dashboard|🌐|Dashboard|Premium web UI in browser|cmd_dashboard'
    'ai|🤖|AI Chat|Free model — ask anything|hub_ai_free'
    'pro|💎|AI Pro|Claude / GPT via OpenRouter|hub_ai_pro'
    'run|🚀|Run Project|Auto-detect stack and start|hub_run'
    'doctor|🩺|Doctor|Full system health check|cmd_doctor'
    'audit|📋|Project Audit|Git, npm, disk scan report|cmd_audit'
)

CHINNA_HUB_SYSTEM=(
    'clean|🧹|Deep Clean|Heavy Mac cleanup|cmd_clean'
    'cleanmac|🧼|Clean Mac|Godspeed full system clean|cmd_clean_mac'
    'purge|🧠|Purge RAM|Free inactive memory|cmd_purge'
    'scan|🔬|Disk Scan|What is eating your disk|cmd_scan'
    'status|📊|Live Status|Disk, RAM, CPU dashboard|cmd_status'
    'dupes|🔍|Duplicates|Find and remove duplicate files|hub_dupes'
    'kill|💀|Kill Hogs|Stop RAM-heavy processes|cmd_kill'
    'ports|🔌|Ports|Active network listeners|cmd_ports'
    'wifi|📶|WiFi|Diagnostics and speed test|cmd_wifi'
)

CHINNA_HUB_DEV=(
    'forge|⚡|Forge|Detect, fix, build, security scan|hub_forge'
    'git|🌿|Git Commit|AI-generated commit and push|cmd_git'
    'deploy|☁️|Deploy|Vercel, Netlify, Railway|hub_deploy'
    'projects|📁|Projects|Registry, history, export|hub_projects'
    'plugins|🧩|Plugins|Load and run Godspeed plugins|hub_plugins'
    'brew|🍺|Dev Setup|Homebrew, node, python, tools|cmd_brew'
)

CHINNA_HUB_SETTINGS=(
    'config|⚙️|Config|API keys and model presets|cmd_config'
    'upgrade|⬆️|Upgrade|Terminal upgrade panel|hub_upgrade'
    'dashboard2|🖥|Open Dashboard|Same as browser UI|cmd_dashboard'
    'help|❓|Help|All direct commands|hub_help'
    'quit|👋|Quit|Exit Chinna CLI|hub_quit'
)

hub_cat_name() {
    case "${CHINNA_HUB_CATS[$CHINNA_HUB_CAT]:-home}" in
        home)     echo "Home" ;;
        system)   echo "System" ;;
        dev)      echo "Developer" ;;
        settings) echo "Settings" ;;
        *)        echo "Home" ;;
    esac
}

hub_items_ref() {
    case "${CHINNA_HUB_CATS[$CHINNA_HUB_CAT]:-home}" in
        home)     printf '%s\n' "${CHINNA_HUB_HOME[@]}" ;;
        system)   printf '%s\n' "${CHINNA_HUB_SYSTEM[@]}" ;;
        dev)      printf '%s\n' "${CHINNA_HUB_DEV[@]}" ;;
        settings) printf '%s\n' "${CHINNA_HUB_SETTINGS[@]}" ;;
    esac
}

hub_filtered_items() {
    local line id icon title desc handler
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        id="${line%%|*}"; line="${line#*|}"
        icon="${line%%|*}"; line="${line#*|}"
        title="${line%%|*}"; line="${line#*|}"
        desc="${line%%|*}"; handler="${line#*|}"
        if [ -z "$CLI_UI_FILTER" ]; then
            printf '%s|%s|%s|%s|%s\n' "$id" "$icon" "$title" "$desc" "$handler"
        elif printf '%s %s %s' "$title" "$desc" "$id" | grep -qi "$CLI_UI_FILTER"; then
            printf '%s|%s|%s|%s|%s\n' "$id" "$icon" "$title" "$desc" "$handler"
        fi
    done < <(hub_items_ref)
}

hub_item_count() {
    hub_filtered_items | wc -l | tr -d ' '
}

hub_item_at() {
    local idx="$1" n=0 line
    while IFS= read -r line; do
        [ "$n" -eq "$idx" ] && { printf '%s' "$line"; return 0; }
        n=$((n + 1))
    done < <(hub_filtered_items)
    return 1
}

hub_render() {
    cli_ui_banner_grok
    local disk ram model cat
    disk=$(cli_ui_disk_pct)
    ram=$(cli_ui_ram_pct)
    model=$(cli_ui_active_model)
    cli_ui_stat_row "$disk" "$ram" "$model"

    cat=$(hub_cat_name)
    cli_ui_panel "$cat" "click or arrow keys — natural language works at the prompt"

    local count idx=0 icon title desc
    count=$(hub_item_count)
    [ "$count" -eq 0 ] && echo -e "  ${WARN}No matches for filter${RESET}"

    while IFS='|' read -r _id icon title desc _handler; do
        if [ "$idx" -eq "$CLI_UI_SELECTED" ]; then
            cli_ui_pulse_sel "$icon" "$title" "$desc" "$((idx + 1))"
        else
            cli_ui_item "$icon" "$title" "$desc" "$((idx + 1))"
        fi
        echo ""
        idx=$((idx + 1))
    done < <(hub_filtered_items)

    # Category tabs
    echo -e "  ${DARK}$(printf '─%.0s' $(seq 1 $((CLI_UI_COLS > 10 ? CLI_UI_COLS - 6 : 40))))${RESET}"
    local ci=0 label active
    for label in Home System Developer Settings; do
        if [ "$ci" -eq "$CHINNA_HUB_CAT" ]; then
            echo -ne "  ${BOLD}${CHINNA} ${label} ${RESET}"
        else
            echo -ne "  ${GRAY}${label}${RESET}"
        fi
        ci=$((ci + 1))
    done
    echo ""

    cli_ui_footer
}

# Map mouse row to list index (items start ~line 10)
hub_mouse_to_index() {
    local row="$1"
    local start=11
    local idx=$(( (row - start) / 3 ))
    local count
    count=$(hub_item_count)
    [ "$idx" -lt 0 ] && idx=0
    [ "$idx" -ge "$count" ] && idx=$((count - 1))
    [ "$count" -eq 0 ] && idx=0
    printf '%d' "$idx"
}

hub_run_handler() {
    local handler="$1"
    cli_ui_cleanup
    if [[ "$handler" == cmd_* ]] && declare -f "$handler" >/dev/null 2>&1; then
        "$handler"
        return
    fi
    case "$handler" in
        hub_ai_free)    echo -ne "  ${PROMPT}prompt ❯ ${RESET}"; local p; read -r p; cmd_free "$p" ;;
        hub_ai_pro)     echo -ne "  ${PROMPT}prompt ❯ ${RESET}"; local p; read -r p; cmd_pro "$p" ;;
        hub_run)        run_project . ;;
        hub_dupes)      cmd_dupes ;;
        hub_forge)      cmd_forge menu ;;
        hub_deploy)     deploy_project . ;;
        hub_projects)   cmd_projects list ;;
        hub_plugins)    cmd_plugins list ;;
        hub_upgrade)    cmd_upgrade ;;
        hub_help)       show_help ;;
        hub_quit)       echo -e "  ${GRAY}Later 👋${RESET}"; exit 0 ;;
        *)              warn "Unknown action: $handler" ;;
    esac
}

hub_exec_selected() {
    local line handler
    line=$(hub_item_at "$CLI_UI_SELECTED") || return 1
    handler="${line##*|}"
    hub_run_handler "$handler"
}

hub_prompt_natural() {
    cli_ui_cleanup
    local input="$1"
    if [ -z "$input" ]; then
        echo -ne "  ${PROMPT}say anything ❯ ${RESET}"
        read -r input || return 0
    fi
    [ -z "$input" ] && return 0
    local intent
    intent=$(resolve_intent "$input" 2>/dev/null || echo "unknown")
    if [ "$intent" != "unknown" ]; then
        dispatch_intent "$intent" "$input"
    else
        warn "Couldn't map: \"$input\""
        info "Try a menu item or: chinna help"
    fi
}

chinna_hub() {
    [ -t 0 ] && [ -t 1 ] || { show_help; return 0; }

    CLI_UI_SELECTED=0
    CLI_UI_FILTER=""
    CHINNA_HUB_CAT=0

    cli_ui_init

    while true; do
        hub_render
        local ev char
        ev=$(cli_ui_read_event)

        case "$ev" in
            up)
                CLI_UI_SELECTED=$(( CLI_UI_SELECTED > 0 ? CLI_UI_SELECTED - 1 : 0 ))
                ;;
            down)
                local max=$(( $(hub_item_count) - 1 ))
                [ "$max" -lt 0 ] && max=0
                CLI_UI_SELECTED=$(( CLI_UI_SELECTED < max ? CLI_UI_SELECTED + 1 : max ))
                ;;
            left)
                CHINNA_HUB_CAT=$(( CHINNA_HUB_CAT > 0 ? CHINNA_HUB_CAT - 1 : 0 ))
                CLI_UI_SELECTED=0
                CLI_UI_FILTER=""
                ;;
            right|tab)
                CHINNA_HUB_CAT=$(( CHINNA_HUB_CAT < 3 ? CHINNA_HUB_CAT + 1 : 3 ))
                CLI_UI_SELECTED=0
                CLI_UI_FILTER=""
                ;;
            enter)
                hub_exec_selected
                cli_ui_init
                ;;
            mouse:*)
                local mrow mcol mid
                mrow="${ev#mouse:}"; mcol="${mrow#*:}"; mrow="${ev#mouse:}"; mrow="${mrow%%:*}"
                mid=$(hub_mouse_to_index "$mrow")
                CLI_UI_SELECTED="$mid"
                hub_exec_selected
                cli_ui_init
                ;;
            filter)
                cli_ui_cleanup
                echo -ne "  ${PROMPT}filter ❯ ${RESET}"
                read -r CLI_UI_FILTER || CLI_UI_FILTER=""
                cli_ui_init
                CLI_UI_SELECTED=0
                ;;
            backspace)
                CLI_UI_FILTER="${CLI_UI_FILTER%?}"
                CLI_UI_SELECTED=0
                ;;
            char:*)
                char="${ev#char:}"
                case "$char" in
                    [1-9])
                        CLI_UI_SELECTED=$(( char - 1 ))
                        local max=$(( $(hub_item_count) - 1 ))
                        [ "$CLI_UI_SELECTED" -le "$max" ] && hub_exec_selected && cli_ui_init
                        ;;
                    *)
                        hub_prompt_natural "$char"
                        cli_ui_init
                        ;;
                esac
                ;;
            quit|esc)
                cli_ui_cleanup
                echo -e "  ${GRAY}Later 👋${RESET}"
                return 0
                ;;
        esac
    done
}