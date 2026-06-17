#!/usr/bin/env bash
# lib/cli-ui.sh — Grok/Claude-style terminal UI (mouse + keyboard + effects)

CLI_UI_COLS=${CLI_UI_COLS:-80}
CLI_UI_ROWS=${CLI_UI_ROWS:-24}
CLI_UI_SELECTED=0
CLI_UI_FILTER=""
CLI_UI_MOUSE=0
CLI_UI_STTY_SAVE=""

cli_ui_dims() {
    CLI_UI_COLS=$(tput cols 2>/dev/null || echo 80)
    CLI_UI_ROWS=$(tput lines 2>/dev/null || echo 24)
}

cli_ui_cursor_hide() { tput civis 2>/dev/null || printf '\e[?25l'; }
cli_ui_cursor_show() { tput cnorm 2>/dev/null || printf '\e[?25h'; }

cli_ui_alt_on()  { tput smcup 2>/dev/null || printf '\e[?1049h'; }
cli_ui_alt_off() { tput rmcup 2>/dev/null || printf '\e[?1049l'; }

cli_ui_raw_on() {
    CLI_UI_STTY_SAVE=$(stty -g 2>/dev/null || true)
    stty -echo -icanon min 0 time 2 2>/dev/null || true
}

cli_ui_raw_off() {
    [ -n "$CLI_UI_STTY_SAVE" ] && stty "$CLI_UI_STTY_SAVE" 2>/dev/null || stty sane 2>/dev/null || true
}

cli_ui_mouse_on() {
    CLI_UI_MOUSE=1
    printf '\e[?1000h\e[?1002h\e[?1006h'
}

cli_ui_mouse_off() {
    CLI_UI_MOUSE=0
    printf '\e[?1006l\e[?1002l\e[?1000l'
}

cli_ui_init() {
    cli_ui_dims
    cli_ui_alt_on
    cli_ui_cursor_hide
    cli_ui_raw_on
    cli_ui_mouse_on
}

cli_ui_cleanup() {
    cli_ui_mouse_off
    cli_ui_raw_off
    cli_ui_cursor_show
    cli_ui_alt_off
}

cli_ui_goto() {
    printf '\e[%d;%dH' "${1:-1}" "${2:-1}"
}

cli_ui_clear() {
    printf '\e[2J\e[H'
}

cli_ui_line() {
    local w="${1:-$CLI_UI_COLS}"
    local ch="${2:-─}"
    printf '%*s\n' "$w" '' | tr ' ' "$ch"
}

cli_ui_glow_rule() {
    local w=$(( CLI_UI_COLS > 4 ? CLI_UI_COLS - 4 : CLI_UI_COLS ))
    echo -e "  ${DARK}$(printf '─%.0s' $(seq 1 "$w"))${RESET}"
}

cli_ui_panel() {
    local title="$1"
    local subtitle="${2:-}"
    echo ""
    echo -e "  ${BOLD}${WHITE}${title}${RESET}"
    [ -n "$subtitle" ] && echo -e "  ${GRAY}${subtitle}${RESET}"
    cli_ui_glow_rule
}

cli_ui_chip() {
    local label="$1"
    local value="$2"
    local color="${3:-$ACCENT}"
    printf "  ${DARK}│${RESET} ${GRAY}%s${RESET} ${color}%s${RESET} " "$label" "$value"
}

cli_ui_stat_row() {
    local disk_pct="${1:-0}"
    local ram_pct="${2:-0}"
    local model="${3:-—}"
    echo ""
    cli_ui_chip "disk" "${disk_pct}%" "$([ "$disk_pct" -gt 85 ] && echo "$ERR" || echo "$CHINNA")"
    cli_ui_chip "ram" "${ram_pct}%" "$([ "$ram_pct" -gt 85 ] && echo "$WARN" || echo "$ACCENT")"
    cli_ui_chip "model" "$model" "$ACCENT2"
    echo ""
}

cli_ui_gradient_word() {
    local word="$1"
    local colors=("$ACCENT" "$ACCENT2" "$CHINNA" "$ACCENT" "$WHITE")
    local i=0 len=${#word}
    local out=""
    while [ "$i" -lt "$len" ]; do
        local c="${colors[$(( i % ${#colors[@]} ))]}"
        out+="${c}${word:$i:1}${RESET}"
        i=$((i + 1))
    done
    printf '%b' "$out"
}

cli_ui_banner_grok() {
    cli_ui_clear
    local ver="${CHINNA_VERSION:-?}"
    echo ""
    echo -ne "  "
    cli_ui_gradient_word "chinna"
    echo -e "  ${DIM}v${ver}${RESET}"
    echo -e "  ${ACCENT}terminal command center${RESET} ${DARK}·${RESET} ${GRAY}mouse + keyboard${RESET}"
    cli_ui_glow_rule
}

cli_ui_pulse_sel() {
    local icon="$1"
    local title="$2"
    local desc="$3"
    local idx="$4"
    echo -e "  ${BOLD}${CHINNA}▸${RESET} ${icon}  ${BOLD}${WHITE}${title}${RESET}  ${DIM}#${idx}${RESET}"
    echo -e "     ${ACCENT}${desc}${RESET}"
}

cli_ui_item() {
    local icon="$1"
    local title="$2"
    local desc="$3"
    local idx="$4"
    echo -e "  ${DIM}○${RESET} ${icon}  ${GRAY}${title}${RESET}  ${DARK}#${idx}${RESET}"
    echo -e "     ${DARK}${desc}${RESET}"
}

cli_ui_footer() {
    echo ""
    cli_ui_glow_rule
    echo -e "  ${GRAY}↑↓${RESET} move  ${GRAY}⏎${RESET} run  ${GRAY}🖱${RESET} click  ${GRAY}/${RESET} filter  ${GRAY}tab${RESET} category  ${GRAY}q${RESET} quit"
    if [ -n "$CLI_UI_FILTER" ]; then
        echo -e "  ${ACCENT}filter:${RESET} ${WHITE}${CLI_UI_FILTER}${RESET}"
    fi
    echo -ne "  ${PROMPT}chinna ❯ ${RESET}"
}

cli_ui_ram_pct() {
    local page_size pages_free
    page_size=$(sysctl -n hw.pagesize 2>/dev/null || echo 4096)
    pages_free=$(vm_stat 2>/dev/null | awk '/Pages free/{gsub(/\./,"",$3); print $3}' || echo 0)
    local mem_total mem_free
    mem_total=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    mem_free=$(( pages_free * page_size ))
    if [ "$mem_total" -gt 0 ]; then
        echo $(( (mem_total - mem_free) * 100 / mem_total ))
    else
        echo 0
    fi
}

cli_ui_disk_pct() {
    df /System/Volumes/Data 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' \
        || df / 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' \
        || echo 0
}

cli_ui_active_model() {
    local m="${ACTIVE_MODEL:-openrouter/auto}"
    m="${m##*/}"
    [ ${#m} -gt 18 ] && m="${m:0:15}…"
    printf '%s' "$m"
}

# Read one logical key/mouse event. Prints: up|down|left|right|enter|esc|tab|backspace|char:X|mouse:row:col|quit
cli_ui_read_event() {
    local k rest seq btn col row
    IFS= read -rsn1 k 2>/dev/null || { echo "quit"; return; }

    case "$k" in
        $'\e')
            if ! IFS= read -rsn1 -t 0.02 rest 2>/dev/null; then
                echo "esc"
                return
            fi
            if [ "$rest" = '[' ]; then
                IFS= read -rsn2 -t 0.02 rest 2>/dev/null || true
                case "$rest" in
                    'A') echo "up" ;;
                    'B') echo "down" ;;
                    'C') echo "right" ;;
                    'D') echo "left" ;;
                    *) echo "esc" ;;
                esac
                return
            fi
            if [ "$rest" = '<' ]; then
                seq=""
                while IFS= read -rsn1 -t 0.02 c 2>/dev/null; do
                    [ "$c" = 'M' ] || [ "$c" = 'm' ] && break
                    seq+="$c"
                done
                local btn mcol mrow
                IFS=';' read -r btn mcol mrow <<< "$seq"
                [ "$c" = "M" ] && echo "mouse:${mrow:-1}:${mcol:-1}"
                return
            fi
            echo "esc"
            ;;
        $'\n'|$'\r') echo "enter" ;;
        $'\t') echo "tab" ;;
        $'\177'|$'\b') echo "backspace" ;;
        'q'|'Q') echo "quit" ;;
        '/') echo "filter" ;;
        *) echo "char:$k" ;;
    esac
}