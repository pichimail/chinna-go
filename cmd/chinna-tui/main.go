package main

import (
	"fmt"
	"os"

	tea "charm.land/bubbletea/v2"

	"github.com/pichimail/chinna-go/tui"
)

func main() {
	client := tui.LoadAPIClient()
	p := tea.NewProgram(tui.InitialModel(client))
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "chinna tui: %v\n", err)
		os.Exit(1)
	}
}
