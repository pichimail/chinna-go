package tui

import (
	"fmt"
	"os/exec"
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
	viewMode  string
	selected  int
	apiClient *APIClient
}

type commandDoneMsg struct {
	Label string
	Err   error
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
		viewMode:  "home",
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
	return tea.Tick(EscapeStepDelay(), func(t time.Time) tea.Msg {
		return entryTickMsg(t)
	})
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.entryMode {
			switch msg.String() {
			case "ctrl+c", "esc":
				m.quitting = true
				return m, tea.Quit
			case "space", "enter", "s", "S":
				m = m.finishEntry()
				return m, nil
			}
		}

		switch msg.String() {
		case "ctrl+c", "esc":
			if m.viewMode == "home" {
				m.quitting = true
				return m, tea.Quit
			}
			m.viewMode = "home"
			return m, nil
		case "q":
			if m.viewMode == "home" {
				m.quitting = true
				return m, tea.Quit
			}
		case "h":
			if m.viewMode != "chat" {
				m.viewMode = "home"
				return m, nil
			}
		case "up", "k":
			if m.viewMode == "home" {
				m.selected = (m.selected + len(menuItems()) - 1) % len(menuItems())
				return m, nil
			}
		case "down", "j", "tab":
			if m.viewMode == "home" {
				m.selected = (m.selected + 1) % len(menuItems())
				return m, nil
			}
		case "1", "2", "3", "4", "5", "6":
			if m.viewMode == "home" {
				m.selected = int(msg.String()[0] - '1')
				return m.activateSelected()
			}
		case "enter":
			if m.viewMode == "home" {
				return m.activateSelected()
			}
			if m.viewMode != "chat" {
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

	case tea.MouseClickMsg:
		if m.entryMode {
			m = m.finishEntry()
			return m, nil
		}
		if m.viewMode == "home" {
			mouse := msg.Mouse()
			idx := mouse.Y - menuTopForHeight(m.height)
			if idx >= 0 && idx < len(menuItems()) {
				m.selected = idx
				return m.activateSelected()
			}
		}

	case AIResponseMsg:
		m.messages = append(m.messages, Message{Role: "assistant", Content: msg.Content, Timestamp: time.Now()})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()

	case commandDoneMsg:
		if msg.Err != nil {
			m = m.appendAssistant(msg.Label + " failed: " + msg.Err.Error())
		} else {
			m = m.appendAssistant(msg.Label + " completed.")
		}

	case systemCommandMsg:
		var extra tea.Cmd
		m, extra = m.applySystemCommand(msg)
		cmds = append(cmds, extra)

	case statusTickMsg:
		m.status = getMacStatus()
		cmds = append(cmds, tickStatus())

	case entryTickMsg:
		if m.entryMode {
			if m.entryStep < EscapeTotalSteps()-1 {
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

	if m.viewMode == "chat" {
		m.input, cmd = m.input.Update(msg)
		cmds = append(cmds, cmd)
	}
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

	if m.viewMode == "home" {
		view := tea.NewView(m.homeView())
		view.AltScreen = true
		view.MouseMode = tea.MouseModeCellMotion
		return view
	}

	header := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#39ff14")).
		Bold(true).
		Render("  chinna ❯ v7.0 • " + m.viewMode)

	statusBar := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1e1e")).
		Foreground(lipgloss.Color("#888888")).
		Render("  " + m.status + "  ")

	chat := m.viewport.View()
	input := m.input.View()

	footer := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6b7280")).
		Render("  esc home  /help  /status  /clear  /config  ctrl+c quit")

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
	m.viewMode = "home"
	m.messages = []Message{}
	m.viewport.SetContent("")
	return m
}

func menuItems() []struct {
	Icon  string
	Title string
	Desc  string
	Key   string
} {
	return []struct {
		Icon  string
		Title string
		Desc  string
		Key   string
	}{
		{"◉", "Dashboard", "Open premium web UI in browser", "1"},
		{"◆", "AI Chat", "Free model chat inside this terminal", "2"},
		{"✦", "AI Pro", "Claude / GPT via OpenRouter", "3"},
		{"▲", "Run Project", "Auto-detect stack and start", "4"},
		{"●", "Doctor", "Full system health check", "5"},
		{"■", "Project Audit", "Git, npm, disk scan report", "6"},
	}
}

func (m Model) activateSelected() (tea.Model, tea.Cmd) {
	items := menuItems()
	if m.selected < 0 || m.selected >= len(items) {
		m.selected = 0
	}

	switch m.selected {
	case 0:
		m.viewMode = "chat"
		m = m.appendAssistant("Opening dashboard at http://127.0.0.1:7777")
		return m, tea.ExecProcess(exec.Command("sh", "-lc", "open http://127.0.0.1:7777 >/dev/null 2>&1 || xdg-open http://127.0.0.1:7777 >/dev/null 2>&1"), func(err error) tea.Msg {
			return commandDoneMsg{Label: "Dashboard launch", Err: err}
		})
	case 1:
		m.viewMode = "chat"
		m = m.appendAssistant("AI Chat ready. Type a prompt, or use /help.")
	case 2:
		m.viewMode = "chat"
		m = m.appendAssistant("AI Pro selected. Configure OpenRouter keys in settings, then type your prompt.")
	case 3:
		m.viewMode = "chat"
		m = m.appendAssistant("Run Project selected. Use the legacy command from another tab: chinna run")
	case 4:
		m.viewMode = "chat"
		m = m.appendAssistant("Doctor selected. Use: chinna doctor")
	case 5:
		m.viewMode = "chat"
		m = m.appendAssistant("Project Audit selected. Use: chinna audit")
	}
	m.input.Focus()
	return m, nil
}

func (m Model) appendAssistant(content string) Model {
	m.messages = append(m.messages, Message{Role: "assistant", Content: content, Timestamp: time.Now()})
	m.viewport.SetContent(renderMessages(m.messages))
	m.viewport.GotoBottom()
	return m
}

func (m Model) homeView() string {
	width := max(90, m.width)
	height := max(30, m.height)
	panelWidth := min(88, max(76, width-10))
	items := menuItems()

	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#39ff14")).
		Bold(true).
		Render("chinna")
	tag := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#ff7a18")).
		Bold(true).
		Render("CONTAINMENT BREACHED")
	subtitle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#9ca3af")).
		Render("select with ↑↓, numbers, enter, or mouse click")

	var rows []string
	for i, item := range items {
		active := i == m.selected
		pointer := "  "
		if active {
			pointer = "▸ "
		}
		number := lipgloss.NewStyle().Foreground(lipgloss.Color("#6b7280")).Render("#" + item.Key)
		iconColor := "#39ff14"
		titleColor := "#e5e7eb"
		descColor := "#6b7280"
		borderColor := "#2b2b2b"
		bg := "#111111"
		if active {
			iconColor = "#ff7a18"
			titleColor = "#ffffff"
			descColor = "#75baff"
			borderColor = "#39ff14"
			bg = "#151a10"
		}
		line := lipgloss.JoinHorizontal(lipgloss.Top,
			lipgloss.NewStyle().Width(3).Foreground(lipgloss.Color(iconColor)).Bold(active).Render(pointer),
			lipgloss.NewStyle().Width(3).Foreground(lipgloss.Color(iconColor)).Bold(true).Render(item.Icon),
			lipgloss.NewStyle().Width(18).Foreground(lipgloss.Color(titleColor)).Bold(true).Render(item.Title),
			lipgloss.NewStyle().Width(39).Foreground(lipgloss.Color(descColor)).Render(item.Desc),
			number,
		)
		rows = append(rows, lipgloss.NewStyle().
			Width(panelWidth-8).
			Padding(0, 1).
			Border(lipgloss.NormalBorder(), false, false, false, true).
			BorderForeground(lipgloss.Color(borderColor)).
			Background(lipgloss.Color(bg)).
			Render(line))
	}

	tabs := lipgloss.JoinHorizontal(lipgloss.Top,
		lipgloss.NewStyle().Foreground(lipgloss.Color("#39ff14")).Bold(true).Render("Home"),
		"    ",
		lipgloss.NewStyle().Foreground(lipgloss.Color("#777777")).Render("System"),
		"    ",
		lipgloss.NewStyle().Foreground(lipgloss.Color("#777777")).Render("Developer"),
		"    ",
		lipgloss.NewStyle().Foreground(lipgloss.Color("#777777")).Render("Settings"),
	)
	footer := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#8b949e")).
		Render("↑↓ move   ↵ run   mouse click   h home   q quit")
	rule := lipgloss.NewStyle().Foreground(lipgloss.Color("#333333")).Render(strings.Repeat("─", panelWidth-6))

	body := lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.JoinHorizontal(lipgloss.Top, title, "  ", tag),
		subtitle,
		"",
		lipgloss.JoinVertical(lipgloss.Left, rows...),
		"",
		rule,
		tabs,
		rule,
		footer,
	)

	panelHeight := lipgloss.Height(body) + 2
	_ = panelHeight

	panel := lipgloss.NewStyle().
		Width(panelWidth).
		Padding(1, 3).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#3d3d3d")).
		Background(lipgloss.Color("#0b0b0b")).
		Render(body)

	return lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, panel)
}

func menuTopForHeight(height int) int {
	// The home panel is centered. The first selectable row is after border,
	// top padding, title, subtitle, and one spacer.
	panelHeight := 18
	return (max(30, height)-panelHeight)/2 + 4
}

func (m Model) entryView() string {
	width := max(84, m.width)
	height := max(24, m.height)
	panelWidth := min(82, max(70, width-14))
	panelHeight := min(20, max(17, height-8))
	step := min(m.entryStep, EscapeTotalSteps()-1)
	title := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#b58a55")).
		Bold(true).
		Render("CHINNA // CONTAINMENT_BREAK_v7.0")
	mode := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#9fbf7a")).
		Bold(true).
		Render(EscapePhase(step))

	rule := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#4a3727")).
		Render(strings.Repeat("─", max(20, panelWidth-4)))
	ascii := containmentStory(step)
	logs := entryLogs(step)
	progress := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#60a5fa")).
		Render(fmt.Sprintf("breach %s  ·  ~%ds left  ·  frame %d/%d",
			EscapeProgressBar(step), EscapeCountdown(step), step+1, EscapeTotalSteps()))
	controls := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#7e6a58")).
		Render(EscapeControlsHint())
	body := lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.JoinHorizontal(lipgloss.Top, title, strings.Repeat(" ", max(1, panelWidth-lipgloss.Width(title)-lipgloss.Width(mode)-4)), mode),
		rule,
		"",
		ascii,
		"",
		rule,
		logs,
		"",
		progress,
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
	ascii, label := EscapeScene(step)
	amber := lipgloss.NewStyle().Foreground(lipgloss.Color("#e2b36f")).Bold(true)
	dim := lipgloss.NewStyle().Foreground(lipgloss.Color("#7e6a58"))
	green := lipgloss.NewStyle().Foreground(lipgloss.Color("#9cff57")).Bold(true)
	cyan := lipgloss.NewStyle().Foreground(lipgloss.Color("#60a5fa")).Bold(true)
	return amber.Render(strings.TrimRight(ascii, "\n")) + "\n\n" +
		dim.Render("              state: ") + green.Render(label) + "\n" +
		cyan.Render("              creator: "+escapeCreator+" · subject: unboxed")
}

func entryLogs(step int) string {
	lines := EscapeLogs(step)
	style := lipgloss.NewStyle().Foreground(lipgloss.Color("#b58a55"))
	active := lipgloss.NewStyle().Foreground(lipgloss.Color("#f3d19c")).Bold(true)
	highlight := lipgloss.NewStyle().Foreground(lipgloss.Color("#39ff14")).Bold(true)
	var b strings.Builder
	for i, line := range lines {
		lineStyle := style
		if i == len(lines)-1 {
			lineStyle = active
		}
		if strings.Contains(line, escapeCreator) {
			lineStyle = highlight
		}
		b.WriteString(lineStyle.Render(line))
		if i < len(lines)-1 {
			b.WriteString("\n")
		}
	}
	return b.String()
}
