# claude-on-a-diet 🥗

My Claude Code setup, packed so a fresh machine (or a friend) gets it in one prompt:
global rules, a token-budget hook with a model gate, settings, my own skills, and a list of
third-party skills and plugins that are installed **fresh** (so you always get their latest version).

Works on Windows, macOS and Linux, from bash, zsh, PowerShell or cmd.

## Use it

Needs [Claude Code](https://claude.com/claude-code), Node.js 18+ and git. Python 3 is optional
(only for the token guard hook).

```sh
git clone https://github.com/dracu-lah/claude-on-a-diet
cd claude-on-a-diet
claude
```

Then type: **start configuring**

Claude checks your machine, asks a few questions (what to install, which skills, which of my
personal rules to drop), shows a dry run, backs up your current `~/.claude`, and installs.
Restart Claude Code afterwards.

## What's inside

| Path | What |
| --- | --- |
| `config/CLAUDE.md` | Global rules: working method, reply format, locked token budget and publishing rules |
| `config/models.md` | Which model and effort for which task (read by the model gate) |
| `config/hooks/token_guard.py` | Hook: blocks wasteful reads/commands, adds the model gate to each prompt |
| `config/settings.json` | Settings (merged into yours, never replaces them) |
| `config/skills/` | My own skills (`dsr`, `figma-reading`) |
| `manifest/skills.json` | Third-party skills (`default: true` = my everyday set), installed with `npx skills` |
| `manifest/plugins.json` | Plugin marketplaces and plugins |
| `scripts/setup.mjs` | The installer (`status`, `install`, `update`, `restore`, `capture`, `check-private`) |

## Without Claude

```sh
node scripts/setup.mjs status
node scripts/setup.mjs install --all --dry-run   # see what it would do
node scripts/setup.mjs install --all             # rules, hooks, settings, own skills, default skills, plugins
node scripts/setup.mjs install --rules --skills=impeccable,wrangler
node scripts/setup.mjs update                    # newest third-party skills and plugins
node scripts/setup.mjs restore                   # undo: put back the latest backup
```

Every install first copies whatever it will touch into `~/.claude/backups/claude-on-a-diet-<time>/`.

## Not included (log in per machine)

Claude login, `gh auth login`, MCP connectors (Figma, Linear...), project memories and per-project
permissions.
