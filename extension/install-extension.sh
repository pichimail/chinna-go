#!/bin/bash
# Chinna Companion installer helper
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Chinna Companion v2.0 — Chrome Extension"
echo "========================================"
echo ""
echo "1. Make sure Chinna-Go dashboard is running:  chinna dashboard"
echo "2. Open Chrome → chrome://extensions"
echo "3. Enable 'Developer mode' (top-right toggle)"
echo "4. Click 'Load unpacked' and select:"
echo "   $DIR"
echo ""
echo "Then click the Chinna icon or press Cmd+Shift+K to open the sidebar."
