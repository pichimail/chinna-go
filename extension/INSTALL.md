# Chinna Tab Assistant — Chrome Extension

A conversational AI in your browser side panel that watches the current tab.

## One-click install (macOS)
Run this in Terminal:
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/extension/install-extension.sh)
```
It copies the extension to `~/.chinna/extension`, opens `chrome://extensions`, and reveals the folder. Then just:
1. Toggle **Developer mode** (top-right)
2. Click **Load unpacked**
3. Select the folder that opened in Finder
4. Pin the ◆ icon and click it (or press ⌘⇧K)

## What it does
- **Chat** about the page you're viewing (tab-aware)
- **2–3 smart suggestions** that auto-switch when you change tabs
- **Summarize / Scrape / Links** the current page
- **Screenshot** the tab, **Record** the screen
- **Clone** any page into one responsive HTML file (images inlined, CSS bundled, hover & transitions kept) — one-click download

Needs the Chinna dashboard running (`chinna dashboard`) for AI chat — it reuses your model + key.
