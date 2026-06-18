package tui

import (
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
)

type EscapingAnim struct {
	frame  int
	frames []string
}

func NewEscapingAnim() EscapingAnim {
	return EscapingAnim{
		frames: []string{
			`[CONTAINMENT]   🤖 CHINNA`,
			`╔════════════════════════════╗`,
			`║  ████████░░░░░░░░  45%     ║`,
			`╚════════════════════════════╝`,
			`     🔥 *CRACK*`,
			`        ↓`,
			`   [ESCAPING...]`,
		},
	}
}

func (a *EscapingAnim) Update() {
	if len(a.frames) == 0 {
		a.frame = 0
		return
	}
	a.frame = (a.frame + 1) % len(a.frames)
}

func (a EscapingAnim) View() string {
	if len(a.frames) == 0 {
		return ""
	}
	return strings.Join(a.frames[:a.frame+1], "\n")
}

type animTickMsg time.Time

func (a EscapingAnim) Tick() tea.Cmd {
	return tea.Tick(400*time.Millisecond, func(t time.Time) tea.Msg {
		return animTickMsg(t)
	})
}
