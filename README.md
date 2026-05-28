# Chinna V5

Chinna is a local Mac sidekick for cleanup, system checks, disk exploration, AI chat, Telegram control, and voice actions.

## One-Touch Install

Copy and paste this into Terminal on macOS to install or replace any older Chinna version with V5:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

Alternative form (also supported):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
```

What it does:
- Installs the latest Chinna V5 app files
- Replaces older installed Chinna code with V5
- Sets up the local command in your shell path
- Keeps your user data and API keys separate from app code

## Upgrade From Older Versions

If you already have any older Chinna install, run the same one-touch install command again:

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

This will:
- Replace the old app code with V5
- Preserve your local data, config, and API keys
- Refresh the command so `chinna` points to the new version

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

- If AI chat or Telegram is not working, verify keys in:

  ```bash
  chinna config
  ```

- If you want a clean reinstall without deleting your data, run:

  ```bash
  chinna uninstall
  bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
  ```

## Notes

- Chinna is designed for macOS.
- Background media customization and OLED settings are local preferences, not API keys.
- Updates refresh the app code only; they do not overwrite your data or credentials.
