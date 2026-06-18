package tui

import "charm.land/lipgloss/v2"

type screenLayout struct {
	width  int
	height int

	viewportW int
	viewportH int
	inputW    int
	inputH    int

	headerH int
	statusH int
	footerH int

	chatHeaderY int
	chatInputY  int
	chatFooterY int

	homePanelX int
	homePanelY int
	homePanelW int
	homePanelH int
	menuRowY   []int
}

func (m Model) layout() screenLayout {
	w := max(20, m.width)
	h := max(8, m.height)

	header := "  chinna ❯ v7.0 • chat"
	footer := "  esc home  /help  /status  /clear  /config  ctrl+c quit"
	status := "  ready  "

	headerH := lipgloss.Height(header)
	footerH := lipgloss.Height(footer)
	statusH := lipgloss.Height(status)
	inputH := max(3, min(6, h/6))
	chrome := headerH + statusH + footerH + inputH + 2

	return screenLayout{
		width:       w,
		height:      h,
		viewportW:   max(20, w-2),
		viewportH:   max(4, h-chrome),
		inputW:      max(20, w-2),
		inputH:      inputH,
		headerH:     headerH,
		statusH:     statusH,
		footerH:     footerH,
		chatHeaderY: 0,
		chatInputY:  headerH + max(4, h-chrome),
		chatFooterY: h - footerH - statusH,
	}
}

func (m Model) homeMenuIndexAt(x, y int) (int, bool) {
	w := max(20, m.width)
	h := max(8, m.height)
	panelW := max(40, w-4)
	itemCount := len(menuItems())
	panelH := 4 + 2 + 1 + itemCount + 5
	panelX := max(0, (w-panelW)/2)
	panelY := max(0, (h-panelH)/2)

	if x < panelX || x >= panelX+panelW || y < panelY || y >= panelY+panelH {
		return -1, false
	}
	firstRow := panelY + 5
	idx := y - firstRow
	if idx >= 0 && idx < itemCount {
		return idx, true
	}
	return -1, false
}