package tui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
)

type aiLoadingMsg struct{}
type aiErrorMsg struct{ Err string }
type aiDoneMsg struct {
	Result dashboardChatResult
}
type projectJobStartMsg struct{ JobID string }

type dashboardChatResult struct {
	Reply      string
	ToolNotes  []string
	ProjectJob string
	Model      string
}

func chinnaSystemPrompt() string {
	return `You are Chinna — a Mac-native AI assistant (like Grok Code / Claude Code).
Reply in the SAME language the user writes: Telugu, Tinglish, Hindi, English, or mixed.
Be witty, direct, and helpful. You run locally on the user's Mac.

You can help with: Mac system, disk, apps, repos, any folder, projects, browser tabs, data files,
installing dependencies, creating .env files, running dev servers on localhost, and editing project roots.

When the user asks to run/start/build a project, the dashboard agent will call run_project automatically.
Never invent file paths — ask or say you'll inspect the Mac.`
}

func (c *APIClient) loadAPIKey() string {
	if c == nil {
		return ""
	}
	if data, err := os.ReadFile(c.ConfigPath); err == nil {
		var cfg map[string]any
		if json.Unmarshal(data, &cfg) == nil {
			if v, ok := cfg["OPENROUTER_API_KEY"].(string); ok {
				return strings.TrimSpace(v)
			}
		}
	}
	envPath := filepath.Join(c.HomeDir, ".chinna", "env")
	if b, err := os.ReadFile(envPath); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "OPENROUTER_API_KEY=") {
				return strings.Trim(strings.TrimPrefix(line, "OPENROUTER_API_KEY="), `"'`)
			}
		}
	}
	return ""
}

func dashboardPort() string {
	if p := os.Getenv("CHINNA_DASHBOARD_PORT"); p != "" {
		return p
	}
	return "7777"
}

func (c *APIClient) chatCompletion(userPrompt string, history []Message) (dashboardChatResult, error) {
	// Prefer dashboard /api/chat — full Mac tools + project run
	if res, err := tryDashboardChat(userPrompt, history); err == nil {
		return res, nil
	}

	key := c.loadAPIKey()
	if key == "" {
		return dashboardChatResult{}, fmt.Errorf("no OpenRouter key — start dashboard or run: chinna config openrouter")
	}

	model := defaultModelID
	if c != nil && c.Model != "" {
		model = c.Model
	}

	msgs := []map[string]string{{"role": "system", "content": chinnaSystemPrompt()}}
	for _, m := range history {
		if m.Role == "user" || m.Role == "assistant" {
			msgs = append(msgs, map[string]string{"role": m.Role, "content": m.Content})
		}
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": userPrompt})

	body, _ := json.Marshal(map[string]any{
		"model":       model,
		"max_tokens":  1200,
		"temperature": 0.7,
		"messages":    msgs,
	})

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return dashboardChatResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/pichimail/chinna-go")
	req.Header.Set("X-Title", "Chinna CLI")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return dashboardChatResult{}, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return dashboardChatResult{}, fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return dashboardChatResult{}, err
	}
	if len(parsed.Choices) == 0 {
		return dashboardChatResult{}, fmt.Errorf("empty AI response")
	}
	return dashboardChatResult{
		Reply: strings.TrimSpace(parsed.Choices[0].Message.Content),
		Model: DisplayModelName(model),
	}, nil
}

func tryDashboardChat(userPrompt string, history []Message) (dashboardChatResult, error) {
	hist := make([]map[string]string, 0, len(history))
	for _, m := range history {
		hist = append(hist, map[string]string{"role": m.Role, "content": m.Content})
	}
	model := defaultModelID
	payload, _ := json.Marshal(map[string]any{
		"message": userPrompt,
		"model":   model,
		"history": hist,
	})
	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Post(
		fmt.Sprintf("http://127.0.0.1:%s/api/chat", dashboardPort()),
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return dashboardChatResult{}, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed struct {
		Reply      string `json:"reply"`
		Error      string `json:"error"`
		Model      string `json:"model"`
		ProjectJob string `json:"project_job"`
		ToolCalls  []struct {
			Tool   string `json:"tool"`
			Result string `json:"result"`
		} `json:"tool_calls"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return dashboardChatResult{}, err
	}
	if parsed.Error != "" {
		return dashboardChatResult{}, fmt.Errorf("%s", parsed.Error)
	}
	if parsed.Reply == "" {
		return dashboardChatResult{}, fmt.Errorf("dashboard chat unavailable")
	}
	var notes []string
	for _, t := range parsed.ToolCalls {
		notes = append(notes, fmt.Sprintf("%s → %s", t.Tool, truncate(t.Result, 120)))
	}
	return dashboardChatResult{
		Reply:      parsed.Reply,
		ToolNotes:  notes,
		ProjectJob: parsed.ProjectJob,
		Model:      DisplayModelName(parsed.Model),
	}, nil
}

func sendAIMessage(client *APIClient, prompt string, history []Message) tea.Cmd {
	return func() tea.Msg {
		res, err := client.chatCompletion(prompt, history)
		if err != nil {
			return aiErrorMsg{Err: err.Error()}
		}
		return aiDoneMsg{Result: res}
	}
}

func formatAIReply(res dashboardChatResult) string {
	content := res.Reply
	if len(res.ToolNotes) > 0 {
		content += "\n\n— tools —\n" + strings.Join(res.ToolNotes, "\n")
	}
	if res.ProjectJob != "" {
		content += fmt.Sprintf("\n\n⚡ Project run job: %s (polling…)", res.ProjectJob)
	}
	return content
}

func pollProjectJob(jid string) tea.Cmd {
	return func() tea.Msg {
		port := dashboardPort()
		for i := 0; i < 40; i++ {
			time.Sleep(2 * time.Second)
			resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:%s/api/job?id=%s", port, jid))
			if err != nil {
				continue
			}
			raw, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			var job struct {
				Lines []string `json:"lines"`
				Done  bool     `json:"done"`
				Ok    bool     `json:"ok"`
			}
			json.Unmarshal(raw, &job)
			if job.Done {
				summary := "Project run finished."
				for _, ln := range job.Lines {
					if strings.Contains(ln, "Preview ready:") || strings.Contains(ln, "localhost:") {
						summary = ln
						break
					}
				}
				return commandDoneMsg{Label: "Project run · " + summary, Err: nil}
			}
		}
		return commandDoneMsg{Label: "Project run still going — check dashboard Jobs", Err: nil}
	}
}

func detectMacAction(prompt string) (label string, args []string, ok bool) {
	lower := strings.ToLower(prompt)
	switch {
	case containsAny(lower, "doctor", "health check", "diagnose", "healthcheck"):
		return "chinna doctor", []string{"doctor"}, true
	case containsAny(lower, "audit", "project audit"):
		return "chinna audit", []string{"audit"}, true
	case containsAny(lower, "dashboard", "open ui", "web ui"):
		return "open dashboard", []string{"dashboard"}, true
	case containsAny(lower, "run cheyyi", "run chey", "start cheyyi", "localhost", "preview", "install deps", "create env", "dotenv", "stack setup", "npm install", "pnpm install", "idi run", "project run", "dev server"):
		return "project run", []string{"run"}, true
	case containsAny(lower, "run", "start", "serve", "stack") && containsAny(lower, "project", "repo", "app", "this", "idi"):
		return "project run", []string{"run"}, true
	case containsAny(lower, "clean", "saaf", "cleanup", "disk clean"):
		return "chinna clean", []string{"clean"}, true
	}
	return "", nil, false
}

func containsAny(s string, words ...string) bool {
	for _, w := range words {
		if strings.Contains(s, w) {
			return true
		}
	}
	return false
}

func runMacAction(label string, args []string) tea.Cmd {
	if label == "project run" {
		return startProjectRunAPI(".")
	}
	bin, err := exec.LookPath("chinna")
	if err != nil {
		bin = filepath.Join(os.Getenv("HOME"), ".local/bin/chinna")
	}
	return tea.ExecProcess(exec.Command(bin, args...), func(err error) tea.Msg {
		if err != nil {
			return commandDoneMsg{Label: label, Err: err}
		}
		return commandDoneMsg{Label: label, Err: nil}
	})
}

func startProjectRunAPI(path string) tea.Cmd {
	return func() tea.Msg {
		payload, _ := json.Marshal(map[string]any{"path": path, "install_deps": true})
		resp, err := http.Post(
			fmt.Sprintf("http://127.0.0.1:%s/api/project/run", dashboardPort()),
			"application/json",
			bytes.NewReader(payload),
		)
		if err != nil {
			bin, _ := exec.LookPath("chinna")
			if bin == "" {
				bin = filepath.Join(os.Getenv("HOME"), ".local/bin/chinna")
			}
			cmd := exec.Command(bin, "run", path)
			if runErr := cmd.Start(); runErr != nil {
				return commandDoneMsg{Label: "project run", Err: runErr}
			}
			return commandDoneMsg{Label: "project run started via chinna CLI", Err: nil}
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		var parsed struct {
			Job string `json:"job"`
		}
		json.Unmarshal(raw, &parsed)
		if parsed.Job != "" {
			return projectJobStartMsg{JobID: parsed.Job}
		}
		return commandDoneMsg{Label: "project run requested", Err: nil}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
