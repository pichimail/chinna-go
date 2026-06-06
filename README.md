# Chinna V6

Chinna is a local Mac sidekick for cleanup, system checks, disk exploration, AI chat, Telegram control, and voice actions.
It also includes a local Chrome/Edge/Brave extension for live website scanning and console-error fix prompts.

## One-Touch Install

Copy and paste this into Terminal on macOS to strictly replace any older Chinna version with the latest V6:

```bash
curl -fsSL -H "Cache-Control: no-cache" https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

Alternative form (also supported):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
```

What it does:
- Stops old Chinna services
- Clears stale Chinna app code and local app caches
- Installs the latest Chinna V6 app files from GitHub
- Refreshes the unpacked browser extension in `~/.chinna/extension/dist`
- Replaces older installed Chinna code with V6
- Sets up the local command in your shell path
- Keeps your user data and API keys separate from app code

## Upgrade From Older Versions

If you already have any older Chinna install, run the same one-touch install command again:

```bash
curl -fsSL -H "Cache-Control: no-cache" https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

This will:
- Stop the old server and replace the old app code with V6
- Clear stale local app caches
- Preserve your local data, config, and API keys
- Refresh the command so `chinna` points to the new version

## Run Locally

After install, use these commands:

```bash
chinna --version
chinna help
chinna dashboard
chinna extension
chinna fix
chinna start
chinna config
```

## Browser Extension

The installer refreshes the unpacked extension here:

```bash
~/.chinna/extension/dist
```

Load it in Chrome, Edge, or Brave:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select `~/.chinna/extension/dist`

The extension uses a compact chat UI with quick actions, file upload, page scan, command cards, copy buttons, and confirm-before-run terminal fixes. It scans the active tab, captures live runtime errors after injection, supports log/code file upload, and sends results only to the local Chinna server at `http://localhost:7777`.
Normal content scripts cannot read historic DevTools logs from before injection; re-run the scan and reproduce the issue once for fresh console capture.

The bare `chinna` command opens a compact conversational command center. Type a quick action number or a natural-language request such as `fix this project`, `scan browser`, or `run localhost`.

Optional commands:

```bash
chinna bot
chinna update
chinna uninstall
chinna uninstall --purge
```

Where files live:
- App and local state: `~/.chinna`
- API keys and config: `~/.chinna/env`
- Model presets: `~/.chinna/models`

## Auto Update

Chinna checks for newer releases dynamically.

When a new version is available:
- You get a prompt/notification in the app or daemon
- The update only applies after your approval
- Your data, config, and API keys stay intact

If you want to update manually:

```bash
chinna update
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

Remove everything from the Mac, including Chinna home, caches, and keys:

```bash
chinna uninstall --purge
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

- If the extension cannot connect, run:

  ```bash
  chinna dashboard
  chinna extension
  ```

- If AI chat or Telegram is not working, verify keys in:

  ```bash
  chinna config
  ```

- If you want a clean reinstall without deleting your data, run:

  ```bash
  chinna uninstall
  bash <(curl -fsSL -H "Cache-Control: no-cache" https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
  ```

## Notes

- Chinna is designed for macOS.
- Background media customization and OLED settings are local preferences, not API keys.
- Updates refresh the app code only; they do not overwrite your data or credentials.
