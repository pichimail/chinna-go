package tui

import "time"

// Message represents a single chat turn in the TUI.
type Message struct {
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp,omitempty"`
}

// APIClient is a placeholder for provider configuration and future API wiring.
type APIClient struct {
	ConfigPath string
	HomeDir    string
	Provider   string
	Model      string
	Ready      bool
}
