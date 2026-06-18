# chinna v7.0

**chinna** is the local-first Mac sidekick that actually *does* things on your machine.

Privacy-first. Zero cloud. Deep macOS integration + a genuinely powerful conversational AI Agent that can plan, build, and execute real work — all while letting you embed any web tool you love as a full-window native view inside the dashboard.

> Built like a Grok CLI. Feels like v0 for your Mac. Runs 100% locally.

---

## One-Touch Install (or Upgrade)

```bash
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

Or the classic:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh)
```

This command **always** gives you the latest version. Run it again any time to upgrade — your data, keys, and configs are never touched.
No `hash -r` step is required.

If `chinna` ever prints Go compile errors or looks half-updated, run the same command again. The installer force-refreshes the CLI, Go TUI source, dashboard, and server while preserving `~/.chinna/api_keys.json`, models, history, and local config.

After install, open a new terminal tab and run:

```bash
chinna
```

That launches the **~1:10 containment escape intro** (press `s`, `enter`, or `space` to skip) and then the Bubble Tea CLI. Just type `chinna`; do not run `hash -r chinna`.

## Auto-Update (built-in)

Chinna checks GitHub on launch.

- When a new version ships you get a clean prompt
- You approve → it self-updates using the same installer
- Everything local stays exactly as it was

Manual one-liner (also works from inside chinna):

```bash
chinna update
```

## The chinna CLI — 100% Grok CLI Style

We rebuilt the entire terminal experience to feel exactly like a premium Grok-style CLI:

- Clean, sparse, high-signal output
- Elegant minimal banner (`chinna v7.0.0`)
- `chinna ❯ ` prompt aesthetic
- Restrained beautiful ANSI (electric accents + signature lime)
- Direct, slightly wry, extremely useful messages
- Perfect progress, spinners, and sectioning

```bash
chinna                # escape intro (~1:10) + interactive TUI
chinna escape         # standalone escape animation only
chinna code           # direct conversational terminal prompt, skips intro
chinna --version
chinna dashboard
chinna clean
chinna config
```

Everything else (`help`, `doctor`, `status`...) follows the same strict visual language.

---

## Unique Features (what actually makes chinna different)

| Feature                        | Why it feels special                                                                 |
|--------------------------------|--------------------------------------------------------------------------------------|
| **Conversational App Builder Agent** | The Agent tab is a full v0.app / emergent-style experience: Ask / Plan / Build modes that are *actually* dynamic, live Code ↔ Preview toggles, artifacts that instantly appear in an optimized workspace, export to real local folders or ZIP, one-click share, new-tab preview. You chat → it builds real things you can keep iterating on. |
| **True Mac-native execution**  | The agent and tools can run real `bash`, `python`, AppleScript, open apps, control music, clean your disk, write files — safely, with your approval flow where it matters. Not another chat that just tells you commands. |
| **Full-window Web Embeds** | Add *any* URL as a named view. They live in the sidebar with a sub-menu. Open them and they fill the entire dashboard window (optimized, no chrome). Fullscreen, dock back to normal, edit name/URL live, mark "auth done". Perfect for Vercel, Linear, internal tools, staging sites, Notion, whatever. Auth usually just works because it's your browser session. |
| **Grok-style CLI**             | The `chinna` command itself now looks and feels like a first-class Grok terminal client. Clean, precise, beautiful. |
| **Everything local & private** | All state, keys (`~/.chinna/api_keys.json`), artifacts, chat history, and your custom web views live only on your Mac. The dashboard is a local Python server. No accounts. No telemetry. |
| **Real artifacts & exports**   | When the Agent builds HTML/JS/apps it creates live previewable artifacts you can instantly preview, iterate, download, or export straight to `~/ChinnaExports/...` (or as a ZIP). |
| **Plan → Build loop**          | Dedicated Plan mode produces beautiful checklists you can edit and hand straight to Build mode for execution. |
| **One installer to rule them all** | Same command installs, upgrades, or repairs. Your keys and data are sacred. |

---

## Run It

After install:

```bash
chinna dashboard     # beautiful local UI on http://127.0.0.1:7777
chinna start         # same thing
chinna agent         # jump straight to the powerful builder
chinna config        # set your OpenRouter / OpenAI / Telegram keys
```

## Settings → Custom Web Views

In **Settings** there is a dedicated "Embeds" card:

- Tiny name field + URL field + big `+` button
- Add as many as you want
- Live list with inline editing of name/URL + "auth ok" checkbox (for your own reference)
- Open button jumps you straight into the full-window view

In the **sidebar** you get a "Web" section with:
- The main "Web Views" entry (opens the last used or selector)
- Auto-populated sub-menu of your named views (click any to load instantly)
- All changes (add/edit/delete) are instantly reflected

Inside a Web View you have a crisp toolbar:
- Dropdown switcher between all your views
- Edit / Fullscreen / Dock / + Add / Delete

Fullscreen uses the real browser fullscreen API. "Dock" brings you back into the normal Chinna frame.

---

## Where everything lives

- `~/.chinna/` — the entire world (code lives in the installed copy, your data does not)
- `~/.chinna/api_keys.json`
- `~/.chinna/custom_views.json` (your named web embeds)
- `~/.chinna/artifacts/` (everything the Agent builds)
- `~/ChinnaExports/` (when you hit Export → local disk)

---

## Update / Repair / Remove

**Update** (preserves everything):

```bash
chinna update
# or just re-run the curl installer
```

**Clean reinstall** (keeps your data):

```bash
chinna uninstall
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/install/install.sh | bash
```

**Nuclear** (delete code + all your local data + keys):

```bash
chinna uninstall --purge
```

---

## Why people actually keep using chinna

Most "AI Mac tools" are just wrappers that suggest commands.

chinna's Agent can **execute** the plan, create real files/artifacts you can keep, control your actual Mac, and now also host any web surface you care about as a first-class citizen inside the same beautiful interface — with a terminal that finally looks as good as the GUI.

Local. Private. Powerful. Yours.

---

**Current version:** v7.0.0
**Repo:** https://github.com/pichimail/chinna-go

Run the installer. Open the dashboard. Try the Agent. Add a couple of web views.

Then never think about "where do I put that one-off tool" again.

**UI Redesign (v7+)**: Floating shadcn-style surfaces (clean borders, subtle elevation, no slop), sleek separators, resizable panels (generalized drag handles with persistence), top floating command bar, pop-to-float for panes (Agent preview, Web views, etc.), #workspace for composable floats. All original features preserved via upgrade/merge. Press ? for shortcuts; drag resizers; use ⤴ to float.
