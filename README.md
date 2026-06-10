# Chinna V6.5

Chinna is a local Mac sidekick for cleanup, system checks, disk exploration, AI chat, Telegram control, voice actions, and browser automation.

> **License**: MIT — see [LICENSE](LICENSE) file.

## One-Touch Install

Copy and paste this into Terminal on macOS to install or replace any older Chinna version with V6.5:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

**Security tip**: For extra verification of downloaded files (defense-in-depth), use:
```bash
CHINNA_VERIFY=1 curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
# or
curl -fsSL ... | bash -s -- --verify
```
(This checks SHA256SUMS for key files like the binary and server.)

Alternative form (also supported):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
```

What it does:
- Installs the latest Chinna V6.5 app files
- Replaces older installed Chinna code with V6.5
- Sets up the local command in your shell path
- Keeps your user data and API keys separate from app code

Important:
- Do not paste the raw URL by itself into Terminal. Use `curl -fsSL ... | bash`.

## Upgrade From Older Versions

If you already have any older Chinna install, run the same one-touch install command again:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

This will:
- Replace the old app code with V6.5
- Preserve your local data, config, and API keys
- Refresh the command so `chinna` points to the new version

If you want a clean refresh that keeps your keys and config but clears old app code and cache-like installation traces, use:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash -s -- --fresh
```

After install, you can also run:

```bash
chinna reinstall
```

## Browser Companion

Install the browser extension from the dashboard button, or open this helper in Terminal to load the unpacked extension folder:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/extension/install-extension.sh | bash
```

That helper prints the exact `chrome://extensions` steps and points Chrome at the local `extension/` folder.

## Run Locally

After install, use these commands:

```bash
chinna --version
chinna help
chinna dashboard
chinna start
chinna config
```

Optional commands:

```bash
chinna bot
chinna update
chinna uninstall
chinna uninstall --purge
```

Where files live:
- App and local state: `~/.chinna`
- API keys: `~/.chinna/api_keys.json`
- Config: `~/.chinna/config`

## Auto Update

Chinna checks for newer releases dynamically.

When a new version is available:
- You get a toast and overlay in the dashboard
- The daemon also shows a macOS prompt
- `Update now` applies the refresh after your approval
- `Later` snoozes the reminder
- Your data, config, and API keys stay intact

If you want to update manually:

```bash
chinna update
```

If you want a fresh reinstall while preserving keys and config:

```bash
chinna reinstall
```

## Configure

Open the local config flow:

```bash
chinna config
```

Typical setup:
- OpenRouter key for AI chat
- OpenAI key for transcription and optional fallback features
- Telegram bot token for remote control

## Remove

Remove the app code but keep your local data and keys:

```bash
chinna uninstall
```

This removes the CLI shim, launch agent, macOS app bundle, SwiftBar quick-action plugin, and Chinna app code, but it keeps your config and API keys in `~/.chinna`.

Remove everything from the Mac, including Chinna home, caches, keys, shell setup, and leftover app traces:

```bash
chinna uninstall --purge
```

After a successful purge, opening a new Terminal tab and running `chinna` should return:

```bash
zsh: command not found: chinna
```

## Troubleshooting

- If `chinna` is not found, reopen Terminal or run the installer again.
- Check command location:

  ```bash
  which chinna
  chinna --version
  ```
- If the dashboard does not open, run:

  ```bash
  chinna dashboard
  ```

- If AI chat or Telegram is not working, verify keys in:

  ```bash
  chinna config
  ```

- If you want a clean reinstall without deleting your data, run:

  ```bash
  chinna uninstall
  bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh) --fresh
  ```

## Notes

- Chinna is designed for macOS.
- Background media customization and OLED settings are local preferences, not API keys.
- Updates refresh the app code only; they do not overwrite your data or credentials.

## Testing (Full Playwright E2E)

**Chinna uses Playwright exclusively** for all End-to-End testing.

We have removed all other E2E frameworks (no Cypress).

### Quick Start

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run all E2E tests
npx playwright test

# Run with UI mode (great for debugging)
npx playwright test --ui

# View beautiful HTML report
npx playwright show-report
```

### Test Location
Tests live in `tests/e2e/`. The `playwright.config.ts` automatically starts the Chinna dashboard when running tests.

### Example Tests
- Dashboard loading and navigation
- WhatsApp Bridge status handling
- Network mocking for offline scenarios
- Cross-browser testing (Chromium, Firefox, WebKit)

## WhatsApp Bridge (v7 + LID Ready)

The WhatsApp bridge now supports **Baileys v7** with full **LID (Local Identifier) mapping**.

### Key Features
- Full ESM conversion
- Automatic LID ↔ Phone Number resolution
- `enrichChat()` and `enrichMessage()` helpers for clean display data
- `/chats` and `/messages` endpoints now return resolved `displayJid` automatically
- Batch resolution support

### Files
- `whatsapp_bridge/server.js` — Main bridge (ESM + v7)
- `whatsapp_bridge/lid-helper.js` — Advanced resolution utilities
- `whatsapp_bridge/MIGRATION_NOTES.md` — Migration guide & warnings

**Note**: Baileys v7 is currently in Release Candidate. The bridge is production-ready for most use cases but test multi-device setups thoroughly.

See `whatsapp_bridge/MIGRATION_NOTES.md` for upgrade guidance.

## Browser Extension — Dynamic Automation + Accessibility

The browser companion extension now includes **advanced dynamic automation** capabilities:

- Full dynamic script injection and execution from the sidepanel
- Accessibility tree inspection (live ARIA roles, labels, focus management)
- One-click "Record & Replay" style automation (via dashboard integration)
- Improved keyboard navigation and screen-reader friendly UI
- Dynamic form filling and element highlighting with high contrast

Load the extension from `~/.chinna/extension` (Developer Mode → Load unpacked).

## CLI Improvements

The `chinna` CLI now features **futuristic visual accessibility styling**:

- High-contrast colored output with semantic colors (success/warning/error)
- Better structured tables and progress indicators
- Screen-reader friendly plain text fallbacks
- Consistent emoji + symbol usage for quick scanning
- Improved help and version output formatting

Run `chinna help` or `chinna doctor` to see the new styling.
