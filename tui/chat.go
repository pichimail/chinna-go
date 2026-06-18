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

func chinnaSystemPrompt() string {
	return `You are Chinna — a Mac-native AI assistant (like Grok Code / Claude Code).
Reply in the SAME language the user writes: Telugu, Tinglish, Hindi, English, or mixed.
Be witty, direct, and helpful. You run locally on the user's Mac.

You can help with: Mac system, disk, apps, repos, any folder, projects, browser tabs, data files,
installing dependencies, creating .env files, running dev servers on localhost, and editing project roots.

When the user asks to run/start/build a project, say you're setting up the stack and keep it brief.
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

func (c *APIClient) chatCompletion(userPrompt string, history []Message) (string, error) {
	key := c.loadAPIKey()
	if key == "" {
		return "", fmt.Errorf("no OpenRouter key — add one in dashboard Settings or: chinna config openrouter")
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
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/pichimail/chinna-go")
	req.Header.Set("X-Title", "Chinna CLI")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return tryDashboardChat(userPrompt, history)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		// fallback to local dashboard agent when available
		if msg, derr := tryDashboardChat(userPrompt, history); derr == nil {
			return msg, nil
		}
		return "", fmt.Errorf("openrouter %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("empty AI response")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func tryDashboardChat(userPrompt string, history []Message) (string, error) {
	port := os.Getenv("CHINNA_DASHBOARD_PORT")
	if port == "" {
		port = "7777"
	}
	hist := make([]map[string]string, 0, len(history))
	for _, m := range history {
		hist = append(hist, map[string]string{"role": m.Role, "content": m.Content})
	}
	payload, _ := json.Marshal(map[string]any{
		"message": userPrompt,
		"model":   "openrouter/free",
		"history": hist,
	})
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(
		fmt.Sprintf("http://127.0.0.1:%s/api/chat", port),
		"application/json",
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed struct {
		Reply string `json:"reply"`
		Error string `json:"error"`
	}
	json.Unmarshal(raw, &parsed)
	if parsed.Error != "" {
		return "", fmt.Errorf(parsed.Error)
	}
	if parsed.Reply != "" {
		return parsed.Reply, nil
	}
	return "", fmt.Errorf("dashboard chat unavailable")
}

func sendAIMessage(client *APIClient, prompt string, history []Message) tea.Cmd {
	return func() tea.Msg {
		reply, err := client.chatCompletion(prompt, history)
		if err != nil {
			return aiErrorMsg{Err: err.Error()}
		}
		return AIResponseMsg{Content: reply}
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
	case containsAny(lower, "run", "start", "serve", "localhost", "preview", "stack", "install deps", "dependencies", "npm install", "pnpm", "env"):
		return "chinna run", []string{"run"}, true
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

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}