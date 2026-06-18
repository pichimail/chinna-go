package tui

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
	"unicode"

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

	chatInputY int
	homePrompt textarea.Model
	homeFocus  string // "menu" | "prompt"
	aiLoading  bool
	skipEscape bool
}

type commandDoneMsg struct {
	Label string
	Err   error
}

func InitialModel(client *APIClient) Model {
	ta := textarea.New()
	ta.Placeholder = "Message Chinna... (Telugu · Hindi · Tinglish · English)"
	ta.SetWidth(112)
	ta.SetHeight(3)

	hp := textarea.New()
	hp.Placeholder = "Ask Chinna anything… Mac · repos · run projects · localhost (Tab to menu)"
	hp.SetWidth(112)
	hp.SetHeight(2)

	vp := viewport.New(viewport.WithWidth(112), viewport.WithHeight(22))
	vp.SetContent("")

	skipEscape := os.Getenv("CHINNA_CODE_MODE") == "1" || os.Getenv("CHINNA_SKIP_ESCAPE") == "1"
	entryMode := !skipEscape

	m := Model{
		viewport:   vp,
		input:      ta,
		homePrompt: hp,
		messages:   []Message{},
		status:     "ready",
		entryMode:  entryMode,
		entryDone:  skipEscape,
		viewMode:   "home",
		homeFocus:  "prompt",
		apiClient:  client,
		skipEscape: skipEscape,
	}
	if skipEscape {
		m.homeFocus = "prompt"
	}
	return m
}

func (m Model) Init() tea.Cmd {
	cmds := []tea.Cmd{textarea.Blink, tickStatus()}
	if m.entryMode {
		cmds = append(cmds, tickEntry())
	}
	return tea.Batch(cmds...)
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
				m.homeFocus = "menu"
				return m, nil
			}
		case "tab":
			if m.viewMode == "home" {
				if m.homeFocus == "menu" {
					m.homeFocus = "prompt"
					m.homePrompt.Focus()
				} else {
					m.homeFocus = "menu"
					m.homePrompt.Blur()
				}
				return m, nil
			}
		case "up", "k":
			if m.viewMode == "home" && m.homeFocus == "menu" {
				m.selected = (m.selected + len(menuItems()) - 1) % len(menuItems())
				return m, nil
			}
		case "down", "j":
			if m.viewMode == "home" && m.homeFocus == "menu" {
				m.selected = (m.selected + 1) % len(menuItems())
				return m, nil
			}
		case "1", "2", "3", "4", "5", "6":
			if m.viewMode == "home" && m.homeFocus == "menu" {
				m.selected = int(msg.String()[0] - '1')
				return m.activateSelected()
			}
		case "enter":
			if m.viewMode == "home" {
				if m.homeFocus == "prompt" {
					text := strings.TrimSpace(m.homePrompt.Value())
					if text != "" {
						return m.submitHomePrompt(text)
					}
				}
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
				m.aiLoading = true
				cmds = append(cmds, sendAIMessage(m.apiClient, input, m.messages[:len(m.messages)-1]))
				if label, args, ok := detectMacAction(input); ok {
					cmds = append(cmds, runMacAction(label, args))
				}
			}

			m.input.Reset()
		default:
			if m.viewMode == "home" && m.homeFocus == "menu" && isPrintableKey(msg) {
				m.homeFocus = "prompt"
				m.homePrompt.Focus()
				m.homePrompt, cmd = m.homePrompt.Update(msg)
				cmds = append(cmds, cmd)
				return m, tea.Batch(cmds...)
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		l := m.layout()
		m.viewport.SetWidth(l.viewportW)
		m.viewport.SetHeight(l.viewportH)
		m.input.SetWidth(l.inputW)
		m.input.SetHeight(l.inputH)
		m.homePrompt.SetWidth(max(20, msg.Width-8))
		m.chatInputY = l.chatInputY

	case tea.MouseClickMsg:
		if m.entryMode {
			m = m.finishEntry()
			return m, nil
		}
		mouse := msg.Mouse()
		if m.viewMode == "home" {
			if idx, ok := m.homeMenuIndexAt(mouse.X, mouse.Y); ok {
				m.selected = idx
				return m.activateSelected()
			}
			return m, nil
		}
		if m.viewMode == "chat" {
			if mouse.Y >= m.chatInputY {
				m.input.Focus()
				return m, nil
			}
			if mouse.Y > 0 && mouse.Y < m.chatInputY {
				m.viewport, cmd = m.viewport.Update(msg)
				cmds = append(cmds, cmd)
				return m, tea.Batch(cmds...)
			}
		}
	case tea.MouseMotionMsg, tea.MouseWheelMsg:
		if !m.entryMode && m.viewMode == "chat" {
			m.viewport, cmd = m.viewport.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}

	case AIResponseMsg:
		m.aiLoading = false
		m.messages = append(m.messages, Message{Role: "assistant", Content: msg.Content, Timestamp: time.Now()})
		m.viewport.SetContent(renderMessages(m.messages))
		m.viewport.GotoBottom()

	case aiErrorMsg:
		m.aiLoading = false
		m = m.appendAssistant("AI: " + msg.Err)

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

	if m.viewMode == "home" && m.homeFocus == "prompt" {
		m.homePrompt, cmd = m.homePrompt.Update(msg)
		cmds = append(cmds, cmd)
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
		view.MouseMode = tea.MouseModeAllMotion
		view.WindowTitle = "chinna"
		return view
	}

	if m.viewMode == "home" {
		_, placed := m.homeView()
		view := tea.NewView(placed)
		view.AltScreen = true
		view.MouseMode = tea.MouseModeAllMotion
		view.WindowTitle = "chinna"
		return view
	}

	modelLabel := "chinna/free"
	if m.apiClient != nil && m.apiClient.Model != "" {
		modelLabel = DisplayModelName(m.apiClient.Model)
	}
	header := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#39ff14")).
		Bold(true).
		Width(max(20, m.width)).
		Render("  chinna ❯ v7.0 • " + m.viewMode + " • " + modelLabel)

	statusBar := lipgloss.NewStyle().
		Background(lipgloss.Color("#1e1e1e")).
		Foreground(lipgloss.Color("#888888")).
		Width(max(20, m.width)).
		Render("  " + m.status + "  ")

	chatContent := m.viewport.View()
	if m.aiLoading {
		chatContent += "\n" + lipgloss.NewStyle().Foreground(lipgloss.Color("#ff7a18")).Render("Chinna is thinking…")
	}
	chat := lipgloss.NewStyle().Width(max(20, m.width)).Render(chatContent)
	input := lipgloss.NewStyle().Width(max(20, m.width)).Render(m.input.View())

	footer := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#6b7280")).
		Width(max(20, m.width)).
		Render("  esc home  /help  /status  /clear  /config  ctrl+c quit  ·  click anywhere")

	body := lipgloss.JoinVertical(lipgloss.Left, header, chat, input, statusBar, footer)
	padded := lipgloss.Place(max(20, m.width), max(8, m.height), lipgloss.Left, lipgloss.Top, body)

	view := tea.NewView(padded)
	view.AltScreen = true
	view.MouseMode = tea.MouseModeAllMotion
	view.WindowTitle = "chinna"
	return view
}

func (m Model) finishEntry() Model {
	m.entryMode = false
	m.entryDone = true
	m.entryStep = 0
	m.viewMode = "home"
	m.homeFocus = "prompt"
	m.homePrompt.Focus()
	m.messages = []Message{}
	m.viewport.SetContent("")
	return m
}

func (m Model) submitHomePrompt(text string) (tea.Model, tea.Cmd) {
	m.viewMode = "chat"
	m.homePrompt.Reset()
	m.homeFocus = "menu"
	m.messages = append(m.messages, Message{Role: "user", Content: text, Timestamp: time.Now()})
	m.viewport.SetContent(renderMessages(m.messages))
	m.viewport.GotoBottom()
	m.input.Focus()
	m.aiLoading = true
	var cmds []tea.Cmd
	cmds = append(cmds, sendAIMessage(m.apiClient, text, m.messages[:len(m.messages)-1]))
	if label, args, ok := detectMacAction(text); ok {
		cmds = append(cmds, runMacAction(label, args))
	}
	return m, tea.Batch(cmds...)
}

func isPrintableKey(msg tea.KeyMsg) bool {
	k, ok := msg.(tea.KeyPressMsg)
	if !ok {
		return false
	}
	if k.Text == "" {
		return false
	}
	for _, r := range k.Text {
		if unicode.IsPrint(r) {
			return true
		}
	}
	return false
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
		{"◆", "AI Chat", "chinna/free chat inside this terminal", "2"},
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
		model := DisplayModelName(defaultModelID)
		if m.apiClient != nil && m.apiClient.Model != "" {
			model = DisplayModelName(m.apiClient.Model)
		}
		m = m.appendAssistant("AI Chat ready on " + model + ". Type a prompt, or use /help. Add your OpenRouter key in dashboard Settings if needed.")
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

func (m Model) homeView() (panel string, placed string) {
	width := max(20, m.width)
	height := max(8, m.height)
	panelWidth := max(40, width-4)
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
		Render("Escape complete · pick an option or type below · Tab switches menu ↔ prompt")

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
		Render("↑↓ menu   Tab prompt   ↵ send/run   mouse   q quit")
	rule := lipgloss.NewStyle().Foreground(lipgloss.Color("#333333")).Render(strings.Repeat("─", panelWidth-6))

	promptLabel := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#75baff")).
		Bold(true).
		Render("chinna ❯")
	promptBox := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#39ff14")).
		Background(lipgloss.Color("#0d0d0d")).
		Padding(0, 1).
		Width(panelWidth - 6).
		Render(m.homePrompt.View())
	if m.homeFocus == "prompt" {
		promptBox = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#ff7a18")).
			Background(lipgloss.Color("#12100a")).
			Padding(0, 1).
			Width(panelWidth - 6).
			Render(m.homePrompt.View())
	}

	body := lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.JoinHorizontal(lipgloss.Top, title, "  ", tag),
		subtitle,
		"",
		lipgloss.JoinVertical(lipgloss.Left, rows...),
		"",
		rule,
		tabs,
		rule,
		promptLabel,
		promptBox,
		footer,
	)

	panel = lipgloss.NewStyle().
		Width(panelWidth).
		Padding(1, 3).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#3d3d3d")).
		Background(lipgloss.Color("#0b0b0b")).
		Render(body)

	placed = lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, panel)
	return panel, placed
}

func (m Model) entryView() string {
	width := max(20, m.width)
	height := max(8, m.height)
	panelWidth := max(40, width-4)
	panelHeight := max(8, height-4)
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
		Render(fmt.Sprintf("breach %s  ·  ~%ds left  ·  frame %d/%d  ·  total ~1:10",
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
		model := DisplayModelName(defaultModelID)
		if m.apiClient != nil && m.apiClient.Model != "" {
			model = DisplayModelName(m.apiClient.Model)
		}
		backend := defaultModelID
		if m.apiClient != nil && m.apiClient.Model != "" {
			backend = m.apiClient.Model
		}
		m.messages = append(m.messages, Message{Role: "assistant", Content: "Model: " + model + " (backend: " + backend + "). Switch in dashboard → Models & AI."})
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
