package tui

import (
	"fmt"
	"image/color"
	"strings"
	"time"

	"charm.land/bubbles/v2/textarea"
	"charm.land/bubbles/v2/viewport"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

type Model struct {
	viewport  viewport.Model
	input     textarea.Model
	messages  []Message
	status    string
	width     int
	height    int
	quitting  bool
	entryMode bool
	entryDone bool
	entryStep int
	apiClient *APIClient
	animation EscapingAnim
}

func InitialModel(client *APIClient) Model {
	ta := textarea.New()
	ta.Placeholder = "Message Chinna... (supports /commands)"
	ta.Focus()
	ta.SetWidth(112)
	ta.SetHeight(3)

	vp := viewport.New(viewport.WithWidth(112), viewport.WithHeight(22))
	vp.SetContent("Containment breached.\nType /help for commands.\n")

	return Model{
		viewport:  vp,
		input:     ta,
		messages:  []Message{},
		status:    "ready",
		entryMode: true,
		apiClient: client,
		animation: NewEscapingAnim(),
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.animation.Tick(),
		tickEntry(),
		tickStatus(),
	)
}

func tickStatus() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return statusTickMsg(t)
	})
}

type entryTickMsg time.Time

func tickEntry() tea.Cmd {
	return tea.Tick(520*time.Millisecond, func(t time.Time) tea.Msg {
		return entryTickMsg(t)
	})
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			m.quitting = true
			return m, tea.Quit
		case "space":
			if m.entryMode {
				m = m.finishEntry()
				return m, nil
			}
		case "enter":
			if m.entryMode {
				m = m.finishEntry()
				return m, nil
			}
			input := strings.TrimSpace(m.input.Value())
			if input == "" {
				break
			}

			m.messages = append(m.messages, Message{Role: "user", Content: input, Timestamp: time.Now()})
			m.viewport.SetContent(renderMessages(m.messages))
			m.viewport.GotoBottom()

			if strings.HasPrefix(input, "/") {
				cmds = append(cmds, handleSlashCommand(input, m))
			} else {
				cmds = append(cmds, sendAIMessage(m.apiClient, input))
			}

			m.input.Reset()
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.viewport.SetWidth(max(70, msg.Width-6))
		m.viewport.SetHeight(max(12, msg.Height-13))
		m.input.SetWidth(max(70, msg.Width-6))

	case AIResponseMsg:
		m.messages = append(m.messages, Message{Role: "assistant", Content: msg.Content, Timestamp: time.Now()})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()

	case systemCommandMsg:
		var extra tea.Cmd
		m, extra = m.applySystemCommand(msg)
		cmds = append(cmds, extra)

	case statusTickMsg:
		m.status = getMacStatus()
		cmds = append(cmds, tickStatus())

	case entryTickMsg:
		if m.entryMode {
			frames := m.entryFrames()
			if m.entryStep < len(frames)-1 {
				m.entryStep++
				cmds = append(cmds, tickEntry())
			} else {
				m = m.finishEntry()
			}
		}

	case animTickMsg:
		m.animation.Update()
		cmds = append(cmds, m.animation.Tick())
	}

	if m.entryMode {
		return m, tea.Batch(cmds...)
	}

	m.input, cmd = m.input.Update(msg)
	cmds = append(cmds, cmd)
	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m Model) View() tea.View {
	if m.quitting {
		return tea.NewView("Goodbye.\n")
	}

	if m.entryMode {
		view := tea.NewView(m.entryView())
		view.AltScreen = true
		view.MouseMode = tea.MouseModeCellMotion
		return view
	}

	header := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#39ff14")).
		Bold(true).
		Render(fmt.Sprintf("  chinna ❯ v7.0 • %s", m.animation.View()))

	statusBar := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1e1e")).
		Foreground(lipgloss.Color("#888888")).
		Render("  " + m.status + "  ")

	chat := m.viewport.View()
	input := m.input.View()

	footer := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6b7280")).
		Render("  /help  /status  /clear  /config  ctrl+c to quit")

	view := tea.NewView(lipgloss.JoinVertical(lipgloss.Left,
		header,
		chat,
		input,
		statusBar,
		footer,
	))
	view.AltScreen = true
	view.MouseMode = tea.MouseModeCellMotion
	return view
}

func (m Model) finishEntry() Model {
	m.entryMode = false
	m.entryDone = true
	m.entryStep = 0
	m.messages = []Message{{
		Role:    "assistant",
		Content: "Containment breached. Chinna TUI is live.",
	}}
	m.viewport.SetContent(renderMessages(m.messages))
	m.viewport.GotoBottom()
	m.input.Focus()
	return m
}

func (m Model) entryFrames() []string {
	return EscapeFrames(rgb(57, 255, 20), rgb(0, 229, 255), "\x1b[0m", "\x1b[1m")
}

func (m Model) entryView() string {
	frames := m.entryFrames()
	step := min(m.entryStep, len(frames)-1)
	frame := frames[step]

	width := max(84, m.width)
	height := max(24, m.height)
	panelWidth := min(82, max(70, width-14))
	panelHeight := min(20, max(17, height-8))
	title := rgbText("chinna escape sequence")
	subtitle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#b6c2cf")).
		Render("private local command surface")

	panel := lipgloss.NewStyle().
		Width(panelWidth).
		Height(panelHeight).
		Padding(1, 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(entryBorderColor(step)).
		Render(lipgloss.JoinVertical(lipgloss.Left, title, subtitle, "", frame))

	progress := rgbProgress(step, len(frames))
	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6b7280")).
		Render("enter or space skips intro")

	content := lipgloss.JoinVertical(lipgloss.Center, panel, progress, hint)
	return lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, content)
}

func (m Model) applySystemCommand(msg systemCommandMsg) (Model, tea.Cmd) {
	switch msg.Command {
	case "clear":
		m.messages = nil
		m.viewport.SetContent("Chat cleared.\n")
		m.viewport.GotoTop()
	case "help":
		m.messages = append(m.messages, Message{
			Role:    "assistant",
			Content: "Commands: /clear, /help, /status, /model, /config, /quit",
		})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()
	case "status":
		m.messages = append(m.messages, Message{
			Role:    "assistant",
			Content: "Status: " + getMacStatus(),
		})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()
	case "model":
		model := "unknown"
		if m.apiClient != nil && m.apiClient.Model != "" {
			model = m.apiClient.Model
		}
		m.messages = append(m.messages, Message{Role: "assistant", Content: "Model: " + model})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()
	case "config":
		path := ""
		ready := false
		if m.apiClient != nil {
			path = m.apiClient.ConfigPath
			ready = m.apiClient.Ready
		}
		state := "missing"
		if ready {
			state = "loaded"
		}
		m.messages = append(m.messages, Message{
			Role:    "assistant",
			Content: "Config " + state + ": " + path,
		})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()
	case "quit":
		m.quitting = true
		return m, tea.Quit
	default:
		m.messages = append(m.messages, Message{
			Role:    "assistant",
			Content: "Unknown slash command: " + msg.Command,
		})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()
	}

	return m, nil
}

func renderMessages(msgs []Message) string {
	var b strings.Builder
	for _, msg := range msgs {
		label := "Chinna"
		color := lipgloss.Color("#39ff14")
		if msg.Role == "user" {
			label = "You"
			color = lipgloss.Color("#75baff")
		}
		b.WriteString(lipgloss.NewStyle().Foreground(color).Render(label + ": "))
		b.WriteString(msg.Content)
		b.WriteString("\n\n")
	}
	return b.String()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func entryBorderColor(step int) color.Color {
	colors := []string{"#00e5ff", "#39ff14", "#ff2ea8", "#ffd60a", "#8a5cf6", "#00e5ff"}
	return lipgloss.Color(colors[step%len(colors)])
}

func rgbProgress(step, total int) string {
	colors := []string{"#39ff14", "#00e5ff", "#ff2ea8", "#ffd60a", "#8a5cf6", "#ffffff"}
	var b strings.Builder
	for i := 0; i < total; i++ {
		char := "░"
		if i <= step {
			char = "█"
		}
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colors[i%len(colors)])).Render(char))
	}
	return b.String()
}

func rgbText(text string) string {
	colors := []string{"#39ff14", "#00e5ff", "#ff2ea8", "#ffd60a", "#8a5cf6"}
	var b strings.Builder
	for i, r := range text {
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color(colors[i%len(colors)])).Bold(true).Render(string(r)))
	}
	return b.String()
}
