package tui

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

const defaultModelID = "openrouter/free"

// DisplayModelName maps backend model ids to user-facing labels.
func DisplayModelName(modelID string) string {
	switch strings.TrimSpace(modelID) {
	case "openrouter/free":
		return "chinna/free"
	case "openrouter/auto":
		return "chinna/auto"
	default:
		return modelID
	}
}

// ResolveModelID maps UI labels back to provider model ids.
func ResolveModelID(label string) string {
	switch strings.TrimSpace(label) {
	case "chinna/free":
		return "openrouter/free"
	case "chinna/auto":
		return "openrouter/auto"
	default:
		return label
	}
}

func readActiveModel(home string) string {
	modelsFile := filepath.Join(home, ".chinna", "models")
	f, err := os.Open(modelsFile)
	if err != nil {
		return defaultModelID
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "ACTIVE_MODEL=") {
			v := strings.Trim(strings.TrimPrefix(line, "ACTIVE_MODEL="), `"'`)
			if v != "" {
				return v
			}
		}
	}
	return defaultModelID
}
