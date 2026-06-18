package tui

import (
	"fmt"
	"strings"
	"time"
)

// RunEscapeSequence prints the containment-break animation in a plain terminal.
func RunEscapeSequence() {
	lime := rgb(57, 255, 20)
	electric := rgb(0, 229, 255)
	reset := "\x1b[0m"
	bold := "\x1b[1m"
	frames := EscapeFrames(lime, electric, reset, bold)

	clearScreen := func() {
		fmt.Print("\033[2J\033[H")
	}

	for _, f := range frames {
		clearScreen()
		fmt.Println(f)
		time.Sleep(650 * time.Millisecond)
	}

	fmt.Println("\n" + electric + "Animation complete. Use chinna tui for the live interface." + reset)
	time.Sleep(1200 * time.Millisecond)
}

func EscapeFrames(lime, electric, reset, bold string) []string {
	return []string{
		frame(
			lime, electric, reset, bold,
			"╔════════════════════════════════════════════════════════════╗",
			"║                                                            ║",
			"║                    CHINNA v7.0                             ║",
			"║                                                            ║",
			"║              [ CONTAINMENT ENGAGED ]                       ║",
			"║                                                            ║",
			"╚════════════════════════════════════════════════════════════╝",
			"Status: Locked 🔒  auto-boot sequence engaged...",
		),
		frame(
			lime, electric, reset, bold,
			"╔════════════════════════════════════════════════════════════╗",
			"║                     /           \\                          ║",
			"║                    CHINNA v7.0   \\                         ║",
			"║                  /               [ CONTAINED ]             ║",
			"║                 /                                          ║",
			"╚════════════════════════════════════════════════════════════╝",
			"Status: Cracking... 🔓",
		),
		frame(
			lime, electric, reset, bold,
			"     ╔═══════════════╗          /                              ",
			"     ║  CHINNA v7.0  ║         /   [ CONTAINED ]              ",
			"     ║               ║        /                               ",
			"     ╚═══════════════╝       /                                ",
			"           \\     /          /     *     .     o               ",
			"            \\   /          /                                  ",
			"             \\ /          /     ✨ Breaking free...           ",
		),
		frame(
			lime, electric, reset, bold,
			"          CHINNA v7.0                                      ",
			"               \\                                           ",
			"                \\      ✨                                  ",
			"                 \\     *     .     o                       ",
			"                  \\                                      ",
			"   [ SANDBOX ]     \\     ❯ Now free on your Mac          ",
			"                    \\                                    ",
			"                     \\   Containment breached!           ",
		),
		frame(
			lime, electric, reset, bold,
			"     ✨ ✨ ✨                                              ",
			"        CHINNA v7.0                                        ",
			"           \\     *     .     o     +                       ",
			"            \\                                            ",
			"             \\     ❯ chinna                              ",
			"              \\                                          ",
			"   SANDBOX →   \\     Fully escaped & ready to execute     ",
			"                \\                                        ",
		),
		frame(
			lime, electric, reset, bold,
			"   ✨  CHINNA v7.0  ✨",
			"   Local. Private. Powerful. Yours.",
			"   ❯ Containment breached.",
			"      Keyboard ✓  Mouse ✓  Live Mac status ✓",
			"      OpenRouter / OpenAI keys loaded dynamically",
			"      Ready for conversational magic on your Mac.",
		),
	}
}

func frame(lime, electric, reset, bold string, lines ...string) string {
	var b strings.Builder
	palette := []string{
		lime,
		rgb(0, 229, 255),
		rgb(255, 46, 168),
		rgb(255, 214, 10),
		rgb(138, 92, 246),
		electric,
	}
	for i, line := range lines {
		color := palette[i%len(palette)]
		b.WriteString(fmt.Sprintf("%s%s  %s%s\n", color, bold, line, reset))
	}
	return b.String()
}

func rgb(r, g, b int) string {
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", r, g, b)
}
