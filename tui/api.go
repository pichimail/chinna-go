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
		Model:      "openrouter/free",
	}

	if data, err := os.ReadFile(client.ConfigPath); err == nil {
		client.Ready = len(strings.TrimSpace(string(data))) > 0
		var cfg map[string]any
		if json.Unmarshal(data, &cfg) == nil {
			if v, ok := cfg["provider"].(string); ok && v != "" {
				client.Provider = v
			}
			if v, ok := cfg["model"].(string); ok && v != "" {
				client.Model = v
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
			Content: "Stubbed response from " + provider + " / " + model + ": " + prompt,
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
