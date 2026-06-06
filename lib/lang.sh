#!/usr/bin/env bash
# lib/lang.sh — Multilingual intent detection
# Supports: English, Telugu, Hindi, Tinglish (Telugu+English mix)

# ─── Intent keyword bank ──────────────────────────────────────
# Bash 3.2-compatible table (macOS default bash has no associative arrays).
INTENT_TABLE=$(cat <<'EOF'
clean:clean clen klean cleann cln cleanup claan saaf clean_cheyyi clean_cheyyandi saaf_cheyyi disk_clean mac_clean junk_remove cache_saaf clean_up delete_junk remove_junk disk_saaf saaf_karo صاف
purge:purge purg ram memory mem memry slow_ram free_ram ram_free ram_purge memory_free memdory ram_saaf memory_saaf ram_free_cheyyi memory_release release_memory purge_ram
slow:slow lagging lag heat heating throttl throttling performance hang hanging freeze frozen stuck annoy annoying chala_slow slow_ga_undi laptop_slow mac_slow anni_slow slow_aindi heat_avutundi chala_hot hot_aindi speed_up fast_cheyyi speed
scan:scan skan scna check_disk disk_check storage check space what_eating disk_usage storage_check disk_skan chek_disk ento_undi em_undi space_chudandi check_cheyyi chudandi storage_chudandi
dupes:dupes dups duplicates dublicates same_files duplicate_files find_dupes same_files_unnaya duplicate_unnaya same_unnaya copies find_copies repeated_files
brew:brew homebrew install_tools dev_setup tools install_dev dev_tools setup_dev brew_install
run_project:run start serve launch project_run start_project run_this run_app start_app project_start localhost dev_server start_server serve_project idi_ela_run_cheyali run_cheyyi start_cheyyi ela_run_cheyali stack build_chei stack_build project_ki_run ela_cheyali deploy_locally run_locally
fix:fix debug repair resolve issue bug bugs error errors broken not_working project_fix fix_project code_fix code_resolve bug_fix issue_fix fix_this_project solve_problem problem_solve
extension:extension browser_extension chrome_extension ext scanner live_scan site_scan scan_browser unpacked load_unpacked browser_scanner chrome_scanner
stack_setup:stack setup_stack install_deps install_packages dependencies deps_install kavalisna_stack stack_kavali required_stack setup_cheyyi install_cheyyi packages_kavali em_install_cheyyali what_to_install stack_em_kavali
deploy:deploy deployment push_live go_live vercel netlify railway deploy_cheyyi live_cheyyi production_lo_pettu prod_deploy ship_it release
git:git commit push pull git_push commit_cheyyi push_cheyyi git_lo_pettu code_push save_code git_commit git_message commit_message
free_ai:free ai ask question chat free_chat ask_ai free_model llama deepseek free_llm tell_me
pro_ai:pro claude gpt paid_ai pro_chat pro_model ask_pro claude_chat gpt_chat premium_ai
voice:voice mic talk speak voice_mode listen speech voice_on mic_on
bot:bot telegram tele start_bot tg_bot remote remote_control phone_control
preview:preview html_preview serve_html html_chudandi open_browser preview_cheyyi local_preview
status:status stats dashboard how_much disk_stats system_status mac_status current_status chudandi
ports:ports port_check whats_running running_ports active_ports em_run_avutundi port_scan
wifi:wifi internet network speed_test net_check connection slow_internet wifi_problem net_slow wifi_slow internet_check
kill_apps:kill kill_apps ram_eater memory_hog stop_apps close_apps force_quit kill_cheyyi close_cheyyi apps_ni_kill force_close
remind:remind reminder set_reminder alert_me remnd remind_me notify_me time_alert
update:update upgrade new_version latest chinna_update update_cheyyi upgrade_cheyyi latest_version
doctor:doctor health check_health healthcheck diagnose diagnosis mac_health chinna_health
config:config setup configure api_key set_key openrouter_key telegram_setup configure_cheyyi
env_setup:env env_setup api_keys mock_keys env_file create_env dotenv env_ledu keys_ledu api_ledu setup_env
publish:publish push_update release_update update_friends share_update chinna_publish
help:help hlp halp ? usage commands what_can list_commands em_cheyagalav em_cheyagaladu help_cheyyi
EOF
)

list_intents() {
    printf '%s\n' "$INTENT_TABLE" | cut -d':' -f1
}

keywords_for_intent() {
    local intent="$1"
    printf '%s\n' "$INTENT_TABLE" | awk -F':' -v key="$intent" '$1 == key { print $2; exit }'
}

# ─── Detect intent from user input ────────────────────────────
detect_intent() {
    local input="${1,,}" # lowercase
    input=$(echo "$input" | tr -s ' ' | sed 's/[^a-z0-9_ ]//g' | tr ' ' '_')

    # Direct check against each intent's keyword list
    for intent in $(list_intents); do
        for kw in $(keywords_for_intent "$intent"); do
            if [[ "$input" == *"$kw"* ]]; then
                echo "$intent"
                return 0
            fi
        done
    done

    # Levenshtein distance fallback for single words
    local best_intent=""
    local best_dist=99
    local word=$(echo "$input" | tr '_' ' ' | awk '{print $1}')

    for intent in $(list_intents); do
        for kw in $(keywords_for_intent "$intent"); do
            local dist=$(levenshtein "$word" "$kw")
            if [ "$dist" -lt "$best_dist" ]; then
                best_dist=$dist
                best_intent=$intent
            fi
        done
    done

    if [ "$best_dist" -le 2 ]; then
        echo "$best_intent"
        return 0
    fi

    echo "unknown"
    return 1
}

# ─── Levenshtein distance (pure bash) ─────────────────────────
levenshtein() {
    local s="$1" t="$2"
    local m=${#s} n=${#t}
    local -a d

    for ((i=0; i<=m; i++)); do d[i*100+0]=$i; done
    for ((j=0; j<=n; j++)); do d[0*100+j]=$j; done

    for ((i=1; i<=m; i++)); do
        for ((j=1; j<=n; j++)); do
            local cost=1
            [[ "${s:i-1:1}" == "${t:j-1:1}" ]] && cost=0
            local del=$(( d[(i-1)*100+j] + 1 ))
            local ins=$(( d[i*100+(j-1)] + 1 ))
            local sub=$(( d[(i-1)*100+(j-1)] + cost ))
            local min=$del
            (( ins < min )) && min=$ins
            (( sub < min )) && min=$sub
            d[i*100+j]=$min
        done
    done
    echo "${d[m*100+n]}"
}

# ─── AI intent detection via OpenRouter (fallback for complex) ─
ai_detect_intent() {
    local input="$1"
    local api_key="${OPENROUTER_API_KEY:-}"
    [ -z "$api_key" ] && { echo "unknown"; return 1; }

    local valid_intents="clean purge slow scan dupes brew run_project fix extension stack_setup deploy git free_ai pro_ai voice bot preview status ports wifi kill_apps remind update doctor config env_setup publish help"

    local result
    result=$(curl -s "https://openrouter.ai/api/v1/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg input "$input" \
            --arg intents "$valid_intents" \
            '{
                model: "meta-llama/llama-3.3-70b-instruct:free",
                max_tokens: 20,
                messages: [{
                    role: "user",
                    content: ("You are an intent classifier. User input may be in English, Telugu, Hindi, or mixed Tinglish. Classify this input into exactly ONE of these intents: " + $intents + ". Reply with ONLY the intent word, nothing else. Input: " + $input)
                }]
            }')" 2>/dev/null)

    local intent
    intent=$(echo "$result" | jq -r '.choices[0].message.content // "unknown"' 2>/dev/null | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')

    # Validate it's a real intent
    if echo "$valid_intents" | grep -qw "$intent"; then
        echo "$intent"
    else
        echo "unknown"
    fi
}

# ─── Main intent resolver ──────────────────────────────────────
resolve_intent() {
    local input="$1"

    # Try keyword bank first (fast, offline)
    local intent
    intent=$(detect_intent "$input")

    if [ "$intent" = "unknown" ] && [ -n "${OPENROUTER_API_KEY:-}" ]; then
        # Fall back to AI for ambiguous inputs
        intent=$(ai_detect_intent "$input")
    fi

    echo "$intent"
}
