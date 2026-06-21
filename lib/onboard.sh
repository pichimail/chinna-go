#!/usr/bin/env bash
# lib/onboard.sh — Claude-style onboarding flow + interactive natural-language prompt loop
#
# Provides:
#   chinna_needs_onboarding   → returns 0 if first run (no marker)
#   chinna_onboard            → guided first-run setup (provider, key, language, theme)
#   chinna_prompt_loop        → interactive NL REPL ("chinna chat" / post-onboarding space)
#
# Relies on helpers defined in bin/chinna: ok/info/warn/fail/sep/section/banner,
# color vars (ACCENT/CHINNA/DIM/...), config helpers (chinna_setenv/chinna_load_env),
# and the intent engine (resolve_intent/dispatch_intent + cmd_pro).

CHINNA_ONBOARD_MARKER="${CHINNA_HOME}/.onboarded"

chinna_needs_onboarding() {
    # Skip in non-interactive shells; only onboard real TTY sessions.
    [ -t 0 ] && [ -t 1 ] || return 1
    [ "${CHINNA_SKIP_ONBOARD:-}" = "1" ] && return 1
    [ -f "$CHINNA_ONBOARD_MARKER" ] && return 1
    # Treat an already-configured key as "onboarded" so upgrading users aren't nagged.
    chinna_load_env 2>/dev/null || true
    if [ -n "${OPENROUTER_API_KEY:-}${OPENAI_API_KEY:-}${ANTHROPIC_API_KEY:-}" ]; then
        touch "$CHINNA_ONBOARD_MARKER" 2>/dev/null || true
        return 1
    fi
    return 0
}

_ob_type() {
    # Typewriter print (degrades gracefully when not a TTY)
    local text="$1" delay="${2:-0.012}"
    if [ -t 1 ]; then
        local i
        for ((i = 0; i < ${#text}; i++)); do
            printf '%s' "${text:$i:1}"
            sleep "$delay" 2>/dev/null || true
        done
        printf '\n'
    else
        printf '%s\n' "$text"
    fi
}

_ob_rule() {
    echo -e "  ${DARK}────────────────────────────────────────────────${RESET}"
}

_ob_logo() {
    clear 2>/dev/null || true
    echo ""
    echo -e "  ${BOLD}${CHINNA}   ▟█▙ ${RESET}${BOLD}${WHITE}chinna${RESET}"
    echo -e "  ${BOLD}${CHINNA}  ▟█████▙${RESET}  ${DIM}your local mac sidekick${RESET}"
    echo -e "  ${BOLD}${CHINNA}   ▜█▛ ${RESET} ${DIM}private · native · fast${RESET}"
    echo ""
    _ob_rule
}

# ────────────────────────────────────────────────────────────────
# Onboarding: a short, Claude-style guided setup
# ────────────────────────────────────────────────────────────────
chinna_onboard() {
    _ob_logo
    echo ""
    _ob_type "  Welcome 👋  Let's get you set up in three quick steps."
    echo ""
    grok_line "Everything runs locally. Keys are stored in ${CHINNA_ENV_FILE} (chmod 600)."
    echo ""

    # ── Step 1: AI provider ───────────────────────────────────────
    section "1 / 3  ·  Choose your AI provider"
    echo -e "    ${ACCENT}1${RESET}  OpenRouter   ${DIM}— one key, hundreds of models (recommended)${RESET}"
    echo -e "    ${ACCENT}2${RESET}  OpenAI       ${DIM}— GPT-4o, Whisper${RESET}"
    echo -e "    ${ACCENT}3${RESET}  Anthropic    ${DIM}— Claude models${RESET}"
    echo -e "    ${ACCENT}4${RESET}  Skip         ${DIM}— set it up later with 'chinna config'${RESET}"
    echo ""

    local choice provider="" key_name="" key_url="" key_val=""
    printf "  ${PROMPT}select ❯ ${RESET}"
    read -r choice || choice="4"

    case "$choice" in
        1|"") provider="OpenRouter"; key_name="OPENROUTER_API_KEY"; key_url="https://openrouter.ai/keys" ;;
        2)    provider="OpenAI";     key_name="OPENAI_API_KEY";     key_url="https://platform.openai.com/api-keys" ;;
        3)    provider="Anthropic";  key_name="ANTHROPIC_API_KEY";  key_url="https://console.anthropic.com/settings/keys" ;;
        *)    provider="" ;;
    esac

    if [ -n "$provider" ]; then
        echo ""
        info "Get a free key at: ${ACCENT}${key_url}${RESET}"
        echo ""
        printf "  ${PROMPT}paste %s key ❯ ${RESET}" "$provider"
        # -s hides the key as it's pasted
        read -rs key_val || key_val=""
        echo ""
        if [ -n "$key_val" ]; then
            chinna_setenv "$CHINNA_ENV_FILE" "$key_name" "$key_val"
            ok "${provider} key saved"
        else
            warn "No key entered — skipping (configure later with 'chinna config')"
        fi
    else
        warn "Skipped AI setup — run 'chinna config' anytime"
    fi

    # ── Step 2: Language / tone ───────────────────────────────────
    section "2 / 3  ·  Pick your language"
    echo -e "    ${ACCENT}1${RESET}  English      ${ACCENT}2${RESET}  Telugu      ${ACCENT}3${RESET}  Hindi      ${ACCENT}4${RESET}  Tinglish"
    echo ""
    local lang_choice lang="english"
    printf "  ${PROMPT}select ❯ ${RESET}"
    read -r lang_choice || lang_choice="1"
    case "$lang_choice" in
        2) lang="telugu" ;;
        3) lang="hindi" ;;
        4) lang="tinglish" ;;
        *) lang="english" ;;
    esac
    chinna_setenv "$CHINNA_ENV_FILE" "CHINNA_LANG" "$lang"
    ok "Language set to ${lang}"

    # ── Step 3: Dashboard ─────────────────────────────────────────
    section "3 / 3  ·  Web dashboard"
    grok_line "Chinna ships a full web dashboard at ${ACCENT}http://localhost:${PORT:-7777}${RESET}"
    echo ""
    printf "  ${PROMPT}open dashboard now? [Y/n] ❯ ${RESET}"
    local dash_choice
    read -r dash_choice || dash_choice="n"

    # Mark complete before launching anything that may exec/replace the shell.
    touch "$CHINNA_ONBOARD_MARKER" 2>/dev/null || true
    chinna_load_env 2>/dev/null || true

    echo ""
    _ob_rule
    ok "You're all set."
    echo ""
    grok_line "Type natural language and Chinna does the rest:"
    echo -e "      ${DIM}\"clean my mac\"   \"find duplicates\"   \"what's eating my RAM?\"${RESET}"
    echo ""
    grok_line "Commands: ${ACCENT}chinna help${RESET}  ·  Chat: ${ACCENT}chinna chat${RESET}  ·  Dashboard: ${ACCENT}chinna dashboard${RESET}"
    echo ""

    case "$dash_choice" in
        ""|y|Y|yes) cmd_dashboard 2>/dev/null || true ;;
    esac

    # Drop straight into the interactive prompt — Claude-style.
    chinna_prompt_loop
}

# ────────────────────────────────────────────────────────────────
# Interactive natural-language prompt loop (REPL)
# ────────────────────────────────────────────────────────────────
chinna_prompt_loop() {
    [ -t 0 ] && [ -t 1 ] || { show_help; return 0; }

    chinna_load_env 2>/dev/null || true

    echo ""
    _ob_rule
    echo -e "  ${BOLD}${WHITE}chinna chat${RESET}  ${DIM}— natural-language prompt. Type a task, or 'exit' to leave.${RESET}"
    echo -e "  ${DIM}try: clean · scan · status · dupes · ports · \"summarize my downloads\"${RESET}"
    _ob_rule
    echo ""

    local input
    while true; do
        printf "  ${PROMPT}chinna ❯ ${RESET}"
        if ! read -r input; then
            echo ""
            break
        fi

        # Trim leading/trailing whitespace
        input="${input#"${input%%[![:space:]]*}"}"
        input="${input%"${input##*[![:space:]]}"}"

        [ -z "$input" ] && continue

        case "$input" in
            exit|quit|q|:q)
                echo -e "  ${GRAY}Later 👋${RESET}"
                break
                ;;
            help|"?")
                show_help
                ;;
            clear|cls)
                clear 2>/dev/null || true
                ;;
            dashboard|ui|web)
                cmd_dashboard 2>/dev/null || true
                ;;
            *)
                # Resolve the spoken intent; fall back to the AI for free-form prompts.
                local intent
                intent=$(resolve_intent "$input" 2>/dev/null || echo "unknown")
                if [ "$intent" != "unknown" ]; then
                    echo ""
                    dispatch_intent "$intent" "$input"
                    echo ""
                else
                    echo ""
                    cmd_pro "$input"
                    echo ""
                fi
                ;;
        esac
    done
}
