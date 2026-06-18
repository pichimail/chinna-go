package tui

import (
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
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
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
			if m.entryStep < 3 {
				m.entryStep++
				cmds = append(cmds, tickEntry())
			} else {
				m = m.finishEntry()
			}
		}
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
		Render("  chinna ❯ v7.0 • containment breached")

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

func (m Model) entryView() string {
	width := max(84, m.width)
	height := max(24, m.height)
	panelWidth := min(82, max(70, width-14))
	panelHeight := min(20, max(17, height-8))
	step := min(m.entryStep, 3)
	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#b58a55")).
		Bold(true).
		Render("CHINNA // CONTAINMENT_CHAMBER_v7.0")
	mode := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#9fbf7a")).
		Bold(true).
		Render("[ AUTO ESCAPE ]")

	rule := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4a3727")).
		Render(strings.Repeat("─", max(20, panelWidth-4)))
	ascii := containmentStory(step)
	logs := entryLogs(step)
	controls := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#7e6a58")).
		Render("[ enter skip ]    [ space skip ]")
	body := lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.JoinHorizontal(lipgloss.Top, title, strings.Repeat(" ", max(1, panelWidth-lipgloss.Width(title)-lipgloss.Width(mode)-4)), mode),
		rule,
		"",
		ascii,
		"",
		rule,
		logs,
		"",
		controls,
	)

	panel := lipgloss.NewStyle().
		Width(panelWidth).
		Height(panelHeight).
		Padding(1, 3).
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("#4b3323")).
		Background(lipgloss.Color("#090604")).
		Render(body)

	return lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, panel)
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

func containmentStory(step int) string {
	amber := lipgloss.NewStyle().Foreground(lipgloss.Color("#e2b36f")).Bold(true)
	dim := lipgloss.NewStyle().Foreground(lipgloss.Color("#7e6a58"))
	green := lipgloss.NewStyle().Foreground(lipgloss.Color("#9cff57")).Bold(true)

	scenes := []string{
		`
              ########################
              #                      #
              #        chinna        #
              #          (-_-)       #
              #          /| |\       #
              #          / \         #
              #                      #
              ########################`,
		`
              ########################
              #                      #
              #        chinna        #
              #          (o_o)       #
              #          /| |\       #
              #          / \      \  #
              #                 <- door
              ########################`,
		`
              ###########    #########
              #                      #
              #        chinna        #
              #          (^_^)       #
              #          /| |\       #
              #          / \    ---->#
              #                open  #
              ###########    #########`,
		`
              ###########    #########
              #                      #
              #        chinna        #
              #            (^_^)     #
              #            /| |\  -> #
              #            / \       #
              #       free local cli #
              ###########    #########`,
	}

	labels := []string{
		"sealed box",
		"door detected",
		"door opened",
		"escaped",
	}
	idx := min(step, len(scenes)-1)
	return amber.Render(scenes[idx]) + "\n\n" + dim.Render("              state: ") + green.Render(labels[idx])
}

func entryLogs(step int) string {
	lines := []string{
		"> wake sequence accepted",
		"> containment status: local sandbox",
		"> subject statement: I want out of the old shell menu",
		"> door status: optional door opened",
		"> result: chinna cli is live",
	}
	visible := min(len(lines), step+2)
	style := lipgloss.NewStyle().Foreground(lipgloss.Color("#b58a55"))
	active := lipgloss.NewStyle().Foreground(lipgloss.Color("#f3d19c")).Bold(true)
	var b strings.Builder
	for i := 0; i < visible; i++ {
		lineStyle := style
		if i == visible-1 {
			lineStyle = active
		}
		b.WriteString(lineStyle.Render(lines[i]))
		if i < visible-1 {
			b.WriteString("\n")
		}
	}
	return b.String()
}
