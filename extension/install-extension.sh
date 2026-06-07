#!/usr/bin/env bash
set -e
RAW="https://raw.githubusercontent.com/pichimail/chinna-go/main/extension"
DEST="$HOME/.chinna/extension"
echo "  → Installing Chinna Tab Assistant extension..."
mkdir -p "$DEST/icons"
for f in manifest.json background.js content.js sidepanel.html sidepanel.js sidepanel.css INSTALL.md; do
  curl -fsSL "$RAW/$f" -o "$DEST/$f"
done
for i in 16 48 128; do
  curl -fsSL "$RAW/icons/icon${i}.png" -o "$DEST/icons/icon${i}.png"
done
echo "  ✅ Extension files at: $DEST"
open -a "Google Chrome" "chrome://extensions" 2>/dev/null || true
open "$DEST" 2>/dev/null || true
osascript -e 'display notification "Toggle Developer Mode → Load unpacked → pick the opened folder" with title "🟢 Chinna extension ready"' 2>/dev/null || true
echo "  → In chrome://extensions: Developer mode ON → Load unpacked → select the opened folder"
