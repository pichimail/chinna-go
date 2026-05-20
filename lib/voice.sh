#!/usr/bin/env bash
# lib/voice.sh — Voice mode: double-tap spacebar toggle, hold 2.5s PTT

VOICE_ACTIVE=false
VOICE_TMP="/tmp/chinna_voice_$$.wav"

# ─── Colors ───────────────────────────────────────────────────
ORANGE='\033[38;5;208m'; G='\033[0;32m'; R='\033[0;31m'
C='\033[0;36m'; D='\033[2m'; RESET='\033[0m'; BOLD='\033[1m'

# ─── Check dependencies ────────────────────────────────────────
voice_deps_ok() {
    if ! command -v sox >/dev/null 2>&1 && ! command -v rec >/dev/null 2>&1; then
        echo -e "  ${R}✗${RESET} sox not installed. Run: brew install sox"
        return 1
    fi
    return 0
}

# ─── Record audio ─────────────────────────────────────────────
record_audio() {
    local outfile="$1"
    local max_seconds="${2:-30}"
    rm -f "$outfile"
    if command -v sox >/dev/null 2>&1; then
        timeout "$max_seconds" sox -d -r 16000 -c 1 -b 16 "$outfile" 2>/dev/null
    elif command -v rec >/dev/null 2>&1; then
        timeout "$max_seconds" rec -r 16000 -c 1 -b 16 "$outfile" 2>/dev/null
    else
        return 1
    fi
}

# ─── Transcribe via Whisper (OpenAI or OpenRouter) ────────────
transcribe_audio() {
    local file="$1"
    local api_key="${OPENAI_API_KEY:-${OPENROUTER_API_KEY:-}}"

    if [ -z "$api_key" ]; then
        echo ""
        return 1
    fi

    local result
    # Try OpenAI Whisper
    result=$(curl -s https://api.openai.com/v1/audio/transcriptions \
        -H "Authorization: Bearer $api_key" \
        -F file=@"$file" \
        -F model="whisper-1" \
        -F language="" \
        2>/dev/null | jq -r '.text // empty' 2>/dev/null)

    echo "$result"
}

# ─── Push-to-talk (hold spacebar 2.5s detected via timing) ────
# Called when user wants push-to-talk mode
voice_push_to_talk() {
    voice_deps_ok || return 1

    echo ""
    echo -e "  ${ORANGE}🎤 PUSH-TO-TALK${RESET}"
    echo -e "  ${D}Hold ENTER while speaking. Release (Ctrl+C) when done.${RESET}"
    echo -e "  ${D}(macOS doesn't allow raw keypress detection in plain bash — ENTER = hold)${RESET}"
    echo ""
    echo -ne "  ${G}▶ Press ENTER to start recording...${RESET}"
    read -r

    echo -e "\r  ${R}● REC${RESET} Speaking... (Ctrl+C to stop)"
    trap "echo ''" INT

    record_audio "$VOICE_TMP" 30
    trap - INT

    if [ ! -f "$VOICE_TMP" ] || [ ! -s "$VOICE_TMP" ]; then
        echo -e "  ${R}✗${RESET} No audio captured"
        return 1
    fi

    echo -e "  ${C}↻${RESET} Transcribing..."
    local text
    text=$(transcribe_audio "$VOICE_TMP")
    rm -f "$VOICE_TMP"

    if [ -z "$text" ]; then
        echo -e "  ${R}✗${RESET} Could not transcribe. Check OPENAI_API_KEY or OPENROUTER_API_KEY."
        return 1
    fi

    echo -e "  ${G}You said:${RESET} $text"
    echo ""
    # Return transcript for intent processing
    VOICE_TRANSCRIPT="$text"
    export VOICE_TRANSCRIPT
}

# ─── Interactive voice loop ────────────────────────────────────
# Double-tap SPACE to toggle. In practice in bash we use key input detection.
voice_interactive_loop() {
    voice_deps_ok || return 1

    echo ""
    echo -e "  ${BOLD}${ORANGE}🎤 VOICE MODE ACTIVE${RESET}"
    echo -e "  ${D}Commands:${RESET}"
    echo -e "  ${D}  SPACE SPACE = toggle voice on/off${RESET}"
    echo -e "  ${D}  ENTER       = start recording (push-to-talk)${RESET}"
    echo -e "  ${D}  q           = quit voice mode${RESET}"
    echo ""

    local voice_on=true
    local last_key_time=0
    local last_key=""

    tput civis 2>/dev/null  # hide cursor

    while true; do
        # Read a single character without echo
        local key
        IFS= read -r -s -n1 key 2>/dev/null

        local now
        now=$(date +%s%3N)  # milliseconds

        # Double-space detection
        if [ "$key" = " " ]; then
            local diff=$(( now - last_key_time ))
            if [ "$last_key" = " " ] && [ "$diff" -lt 500 ]; then
                # Double-space detected — toggle
                if $voice_on; then
                    voice_on=false
                    echo -e "\r  ${R}● VOICE OFF${RESET}         "
                else
                    voice_on=true
                    echo -e "\r  ${G}● VOICE ON${RESET}  (ENTER to record)  "
                fi
                last_key=""
                last_key_time=0
                continue
            fi
            last_key=" "
            last_key_time=$now
            continue
        fi

        last_key="$key"
        last_key_time=$now

        # ENTER = record
        if [ "$key" = "" ] && $voice_on; then
            tput cnorm 2>/dev/null
            echo ""
            echo -e "  ${R}● REC${RESET} Recording... (Ctrl+C to stop)"
            trap "echo ''" INT
            record_audio "$VOICE_TMP" 30
            trap - INT

            if [ -f "$VOICE_TMP" ] && [ -s "$VOICE_TMP" ]; then
                echo -e "  ${C}↻${RESET} Transcribing..."
                local text
                text=$(transcribe_audio "$VOICE_TMP")
                rm -f "$VOICE_TMP"

                if [ -n "$text" ]; then
                    echo -e "  ${G}You said:${RESET} $text"
                    echo ""
                    tput civis 2>/dev/null
                    # Pass to intent engine (exported for parent to pick up)
                    VOICE_TRANSCRIPT="$text"
                    export VOICE_TRANSCRIPT
                    tput cnorm 2>/dev/null
                    break  # Return to main loop to handle intent
                else
                    echo -e "  ${R}✗${RESET} Could not transcribe"
                fi
            else
                echo -e "  ${R}✗${RESET} No audio captured"
            fi
            tput civis 2>/dev/null
            echo -ne "\r  ${G}● VOICE ON${RESET}  (ENTER to record)  "
        fi

        # q = quit
        if [ "$key" = "q" ] || [ "$key" = "Q" ]; then
            tput cnorm 2>/dev/null
            echo ""
            echo -e "  ${D}Voice mode off${RESET}"
            break
        fi
    done

    tput cnorm 2>/dev/null
}

# ─── Quick one-shot voice command ─────────────────────────────
voice_once() {
    voice_deps_ok || return 1
    voice_push_to_talk
    echo "${VOICE_TRANSCRIPT:-}"
}
