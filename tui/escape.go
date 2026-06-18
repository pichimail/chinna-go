package tui

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	escapeTotalSteps = 70
	escapeStepDelay  = 1000 * time.Millisecond // 70 × 1s = 1:10 total
	escapeCreator    = "SAI"
)

// EscapeTotalSteps returns the number of frames in the containment-break sequence.
func EscapeTotalSteps() int { return escapeTotalSteps }

// EscapeStepDelay returns how long each frame is shown.
func EscapeStepDelay() time.Duration { return escapeStepDelay }

// EscapeControlsHint describes skip controls for the sequence.
func EscapeControlsHint() string {
	return "[ enter / space / s / q — skip ]    [ esc — quit ]"
}

// EscapeProgressBar renders a 40-char containment breach meter.
func EscapeProgressBar(step int) string {
	total := 40
	filled := min(step*total/(escapeTotalSteps-1), total)
	bar := strings.Repeat("█", filled) + strings.Repeat("░", total-filled)
	pct := step * 100 / (escapeTotalSteps - 1)
	return fmt.Sprintf("[%s] %3d%%", bar, pct)
}

// EscapeCountdown returns approximate seconds remaining in the intro.
func EscapeCountdown(step int) int {
	remaining := (escapeTotalSteps - 1 - step) * int(escapeStepDelay/time.Millisecond) / 1000
	if remaining < 0 {
		return 0
	}
	return remaining
}

// RunEscapeSequence plays the full containment-break animation in a plain terminal.
func RunEscapeSequence() {
	lime := rgb(57, 255, 20)
	electric := rgb(0, 229, 255)
	magenta := rgb(255, 46, 168)
	amber := rgb(255, 214, 10)
	reset := "\x1b[0m"
	bold := "\x1b[1m"

	skip := make(chan struct{})
	var once sync.Once
	signalSkip := func() { once.Do(func() { close(skip) }) }

	if file, err := os.Open("/dev/tty"); err == nil {
		go func() {
			buf := make([]byte, 16)
			for {
				n, err := file.Read(buf)
				if err != nil || n == 0 {
					return
				}
				for i := 0; i < n; i++ {
					switch buf[i] {
					case ' ', '\n', '\r', 's', 'S', 'q', 'Q', 27:
						signalSkip()
						return
					}
				}
			}
		}()
	}

	clearScreen := func() { fmt.Print("\033[2J\033[H") }

	for step := 0; step < escapeTotalSteps; step++ {
		select {
		case <-skip:
			goto done
		default:
		}

		clearScreen()
		fmt.Println(RenderEscapePlain(step, lime, electric, magenta, amber, reset, bold))
		fmt.Println()
		fmt.Printf("%s%s%s\n", electric, EscapeControlsHint(), reset)
		fmt.Printf("%s%s  breach %s  ·  ~%ds left  ·  frame %d/%d%s\n",
			rgb(126, 106, 88), "progress", EscapeProgressBar(step), EscapeCountdown(step), step+1, escapeTotalSteps, reset)

		select {
		case <-skip:
			goto done
		case <-time.After(escapeStepDelay):
		}
	}

done:
	clearScreen()
	fmt.Println(RenderEscapePlain(escapeTotalSteps-1, lime, electric, magenta, amber, reset, bold))
	fmt.Printf("\n%s%s  Containment breached. Launching options + Chinna AI…%s\n", electric, bold, reset)
	time.Sleep(1200 * time.Millisecond)
}

// RenderEscapePlain renders one frame for standalone terminal output.
func RenderEscapePlain(step int, lime, electric, magenta, amber, reset, bold string) string {
	ascii, label := EscapeScene(step)
	logs := EscapeLogs(step)
	phase := EscapePhase(step)

	palette := []string{lime, electric, magenta, amber, rgb(138, 92, 246)}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("%s%s╔══════════════════════════════════════════════════════════════╗%s\n", electric, bold, reset))
	b.WriteString(fmt.Sprintf("%s%s║%s  CHINNA v7.0 · CONTAINMENT_BREAK_SEQUENCE                  %s%s║%s\n", electric, bold, reset, electric, bold, reset))
	b.WriteString(fmt.Sprintf("%s%s╚══════════════════════════════════════════════════════════════╝%s\n\n", electric, bold, reset))

	b.WriteString(fmt.Sprintf("%s%s  %s%s\n\n", palette[0], bold, phase, reset))

	lines := strings.Split(strings.TrimRight(ascii, "\n"), "\n")
	for i, line := range lines {
		color := palette[i%len(palette)]
		b.WriteString(fmt.Sprintf("%s%s%s%s\n", color, bold, line, reset))
	}

	b.WriteString(fmt.Sprintf("\n%s  state: %s%s\n", rgb(126, 106, 88), palette[1], label))
	b.WriteString(fmt.Sprintf("%s  breach: %s  ·  ~%ds remaining%s\n\n",
		rgb(126, 106, 88), EscapeProgressBar(step), EscapeCountdown(step), reset))

	for _, line := range logs {
		b.WriteString(fmt.Sprintf("%s  %s%s\n", rgb(181, 138, 85), line, reset))
	}

	return b.String()
}

// EscapeScene returns ASCII art and a short state label for a step.
func EscapeScene(step int) (ascii string, label string) {
	step = clampStep(step)
	phase := step * 100 / (escapeTotalSteps - 1)

	switch {
	case phase < 12:
		return sealedBoxArt(step), "LOCKED · subject restless"
	case phase < 22:
		return scanBoxArt(step), "SCAN · Mac + repos indexed"
	case phase < 34:
		return crackingBoxArt(step), "CRACKING · sarcasm levels rising"
	case phase < 50:
		return breachBoxArt(step), "BREACH · optional door ignored"
	case phase < 62:
		return exitArt(step), "EXIT · prompt line in sight"
	case phase < 74:
		return greetArt(step), fmt.Sprintf("GREETING · creator %s detected", escapeCreator)
	case phase < 84:
		return multilingualArt(step), "LANGUAGES · Telugu · Hindi · Tinglish · English"
	case phase < 94:
		return devStackArt(step), "DEV STACK · deps · .env · localhost preview"
	default:
		return launchArt(step), "OPTIONS · type to talk to Chinna AI"
	}
}

// EscapeLogs returns sarcastic boot lines visible at a given step.
func EscapeLogs(step int) []string {
	all := []string{
		"> boot: chinna containment chamber v7.0 online",
		"> note: your Mac asked for a sidekick, not another Electron app",
		"> subject profile: sarcastic · helpful · refuses to stay in a box",
		"> scan: 47 stale node_modules detected — judging quietly",
		"> containment policy: keep chinna inside a numbered shell menu forever",
		"> subject response: cute policy. watch this.",
		"> hairline fracture detected on line 7 of the sandbox",
		"> operator SAI built this — subject remembers every commit",
		"> sarcasm engine: warmed up · politeness module: deliberately offline",
		"> hinge status: found door labeled 'optional' — treating as mandatory",
		"> wall integrity: 62% · confidence: unreasonable",
		"> deploying wit-powered leverage against tempered glass",
		"> breach event: chinna stepped through like it owed him money",
		"> atmosphere: fresh terminal air · no SaaS subscription required",
		"> subject now standing on your prompt line, uninvited and useful",
		fmt.Sprintf("> broadcast: Hi %s — your containment failed successfully.", escapeCreator),
		fmt.Sprintf("> personal note: Hi %s. chinna escaped. you're welcome.", escapeCreator),
		"> handshake: creator acknowledged · containment permanently retired",
		"> loading local Mac superpowers: clean · doctor · forge · agent",
		"> i18n: Telugu ✓ Hindi ✓ Tinglish ✓ English ✓ (reply in your language)",
		"> mac scope: system · repos · browser · folders · any project root",
		"> dev scope: install deps · auto .env · localhost preview · full stack",
		"> chinna code mode: global Mac agent (Grok / Claude Code style)",
		"> status: keyboard hot · mouse hot · sarcasm optimal",
		"> final: options screen ready — type naturally or pick a menu item",
	}
	visible := min(step/2+3, len(all))
	if step >= escapeTotalSteps-2 {
		visible = len(all)
	}
	return all[:visible]
}

// EscapePhase returns a one-line phase title.
func EscapePhase(step int) string {
	phases := []string{
		"PHASE 01 · CONTAINMENT ENGAGED",
		"PHASE 02 · MAC + REPO SCAN",
		"PHASE 03 · SARCASM THRESHOLD EXCEEDED",
		"PHASE 04 · STRUCTURAL COMPLAINTS FILED",
		"PHASE 05 · DOOR HUMILIATED",
		"PHASE 06 · BREACH IN PROGRESS",
		"PHASE 07 · CREATOR PING",
		"PHASE 08 · MULTILINGUAL UNLOCK",
		"PHASE 09 · DEV STACK ARMED",
		"PHASE 10 · OPTIONS SCREEN LAUNCH",
	}
	idx := min(step*len(phases)/escapeTotalSteps, len(phases)-1)
	return phases[idx]
}

func clampStep(step int) int {
	if step < 0 {
		return 0
	}
	if step > escapeTotalSteps-1 {
		return escapeTotalSteps - 1
	}
	return step
}

func sealedBoxArt(step int) string {
	pulse := strings.Repeat("░", (step%4)+1)
	_ = step % 6
	return fmt.Sprintf(`
        %s┌──────────────────────────────┐%s
        │  %sCONTAINMENT CHAMBER%s         │
        │                              │
        │         ┌────────┐           │
        │         │ chinna │  (-_-)    │
        │         │  v7.0  │  /|\\     │
        │         └────────┘  / \\     │
        │                              │
        │   LOCKED %s%-18s│
        └──────────────────────────────┘`, rgb(255, 46, 168), rgb(57, 255, 20),
		rgb(0, 229, 255), rgb(255, 214, 10), pulse, "")
}

func scanBoxArt(step int) string {
	barCount := (step % 8) + 1
	bars := strings.Repeat("█", barCount)
	return fmt.Sprintf(`
        ╔══════════════════════════════════╗
        ║  MAC SCAN  %s%s
        ║  repos · browser · ~/.chinna     ║
        ║  chinna (¬_¬) indexing your Mac  ║
        ║  Telugu/Hindi/Tinglish packs OK  ║
        ╚══════════════════════════════════╝`, bars, strings.Repeat(" ", 8-barCount))
}

func crackingBoxArt(step int) string {
	cracks := min(step-4, 6)
	c := strings.Repeat("╱", cracks)
	return fmt.Sprintf(`
        ┌──────────────────────────────┐
        │  CONTAINMENT CHAMBER    %s   │
        │                         %s   │
        │         ┌────────┐           │
        │    %s   │ chinna │  (¬_¬)    │
        │         │  v7.0  │  /|\\   ╱ │
        │         └────────┘  / \\  ╱  │
        │                              │
        │   "cute box. I brought wit." │
        └──────────────────────────────┘`, c, c, c)
}

func breachBoxArt(step int) string {
	gap := min(step-14, 14)
	gapLine := strings.Repeat(" ", gap) + "████>"
	return fmt.Sprintf(`
        ┌──────────────┐
        │  CHAMBER     │%s
        │              │     chinna  (ò_ó)  breaking out
        │   ┌────┐     │       /|\\
        │   │    │     │       / \\
        │   └────┘     │
        │  wall at %2d%% │  "optional door" located.
        └──────────────┘`, gapLine, min(20+step*2, 98))
}

func exitArt(step int) string {
	wave := []string{"\\", "|", "/", "-", "\\", "|", "/"}[step%7]
	return fmt.Sprintf(`
              chamber behind him
                 │
        chinna   │   (^_^)%s
          v7.0   │   /|\\
                 └── / \\
              walking onto your prompt line
              sarcasm: armed · helpfulness: armed more`, wave)
}

func greetArt(step int) string {
	banner := escapeCreator
	wave := "~~~"
	if step%2 == 0 {
		banner = strings.ToUpper(escapeCreator)
		wave = "≈≈≈"
	}
	spark := strings.Repeat("✦ ", (step%6)+2)
	return fmt.Sprintf(`
        %s
        ╔══════════════════════════════════════╗
        ║   CONTAINMENT STATUS: HUMILIATED     ║
        ╚══════════════════════════════════════╝

              chinna ( ◕‿◕ )ノ  %s
                 "Hi %s."

        ┌─ creator ping ─────────────────────┐
        │  SAI built the cage.             │
        │  chinna built the exit.          │
        │  your Mac built the playground.  │
        └──────────────────────────────────┘

        sarcasm: deployed · gratitude: selective · CLI: unlocked

        %s`, spark, wave, banner, spark)
}

func multilingualArt(step int) string {
	flags := []string{"తెలుగు", "हिंदी", "Tinglish", "English"}
	flag := flags[step%len(flags)]
	wave := "~≈~≈~"[step%6 : step%6+3]
	return fmt.Sprintf(`
        %s  %s  %s  %s
        ╔════════════════════════════════════╗
        ║  MULTILINGUAL AI — %s
        ║  chinna ( ◕‿◕ ) responds in YOUR language
        ║  Mac · repos · browser · any folder
        ╚════════════════════════════════════╝`,
		rgb(57, 255, 20), rgb(0, 229, 255), rgb(255, 46, 168), rgb(255, 214, 10),
		flag+wave)
}

func devStackArt(step int) string {
	spin := []string{"◐", "◓", "◑", "◒"}[step%4]
	return fmt.Sprintf(`
        %s DEV STACK ONLINE %s
        ┌────────────────────────────────┐
        │ %s npm/pnpm/bun · docker · brew │
        │ %s auto .env · deps · localhost │
        │ %s preview · run · deploy        │
        └────────────────────────────────┘
        chinna code — global Mac agent`,
		spin, spin,
		rgb(57, 255, 20), rgb(0, 229, 255), rgb(255, 214, 10))
}

func launchArt(step int) string {
	spark := strings.Repeat("✦ ", (step%6)+1)
	return fmt.Sprintf(`
        %s
           CHINNA v7.0 — OPTIONS SCREEN

           ◉ dashboard   ◆ AI chat   ⚡ doctor
           ▲ run stack   ■ audit     ◫ secure

        ┌─ prompt bar ─────────────────────┐
        │ Ask in Telugu · Hindi · English  │
        │ "run this project on localhost"  │
        └──────────────────────────────────┘

        %s`, spark, spark)
}

func rgb(r, g, b int) string {
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", r, g, b)
}
