package tui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
)

type AIResponseMsg struct {
	Content string
}

type statusTickMsg time.Time

type systemCommandMsg struct {
	Command string
	Value   string
}

func LoadAPIClient() *APIClient {
	home, err := os.UserHomeDir()
	if err != nil {
		home = ""
	}

	client := &APIClient{
		HomeDir:    home,
		ConfigPath: filepath.Join(home, ".chinna", "api_keys.json"),
		Provider:   "openrouter",
		Model:      readActiveModel(home),
	}

	if data, err := os.ReadFile(client.ConfigPath); err == nil {
		var cfg map[string]any
		if json.Unmarshal(data, &cfg) == nil {
			if v, ok := cfg["OPENROUTER_API_KEY"].(string); ok && strings.TrimSpace(v) != "" {
				client.Ready = true
			}
			if v, ok := cfg["provider"].(string); ok && v != "" {
				client.Provider = v
			}
		}
	}

	envPath := filepath.Join(home, ".chinna", "env")
	if b, err := os.ReadFile(envPath); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "OPENROUTER_API_KEY=") {
				v := strings.Trim(strings.TrimPrefix(line, "OPENROUTER_API_KEY="), `"'`)
				if v != "" {
					client.Ready = true
				}
			}
		}
	}

	return client
}

func sendAIMessage(client *APIClient, prompt string) tea.Cmd {
	return func() tea.Msg {
		time.Sleep(400 * time.Millisecond)

		provider := "unconfigured"
		model := "unknown"
		if client != nil {
			if client.Provider != "" {
				provider = client.Provider
			}
			if client.Model != "" {
				model = client.Model
			}
		}

		return AIResponseMsg{
			Content: "Stubbed response from " + provider + " / " + DisplayModelName(model) + ": " + prompt,
		}
	}
}

func handleSlashCommand(cmd string, m Model) tea.Cmd {
	return func() tea.Msg {
		trimmed := strings.TrimSpace(cmd)
		if trimmed == "" {
			return systemCommandMsg{Command: "noop"}
		}
		fields := strings.Fields(trimmed)
		name := strings.TrimPrefix(fields[0], "/")
		value := strings.TrimSpace(strings.TrimPrefix(trimmed, fields[0]))
		return systemCommandMsg{Command: name, Value: value}
	}
}
