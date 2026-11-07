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

Then send this prompt:

```text
start configuring
```

Claude checks your machine and asks one round of questions: what to install, which skills,
your name and git author (for the `{{PLACEHOLDERS}}`), which MCP servers stay on, and which of my
personal rules to drop. It shows a dry run, backs up your current `~/.claude`, then installs.
Restart Claude Code afterwards.

Later, to pull in new rules and the newest skills:

```text
git pull, then start configuring again
```

## What's inside

| Path | What |
| --- | --- |
| `config/CLAUDE.md` | Global rules: working method, reply format, hands-free plan runs (orchestrator + worker subagents), publishing split (feature-branch push, PR and dev deploy are Claude's; prod, merge, release are yours) |
| `config/models.md` | Which model and effort for which task (read by the model gate) |
| `config/hooks/token_guard.py` | Hook: blocks wasteful reads/commands and user-only publishing (prod, main/dev push, force, tags, merge), adds an advisory model gate to each prompt |
| `config/settings.json` | Settings (merged into yours, never replaces them) |
| `config/settings.remove.json` | Retired values the installer takes out of yours first (merge alone only adds) |
| `config/skills/` | My own skills (`dsr`, `figma-reading`) |
| `manifest/skills.json` | Third-party skills (`default: true` = my everyday set), installed with `npx skills` |
| `manifest/plugins.json` | Plugin marketplaces and plugins |
| `manifest/mcp.json` | MCP servers that stay on; every other one found is turned off |
| `scripts/setup.mjs` | The installer (`status`, `install`, `set`, `mcp-list`, `update`, `restore`, `capture`, `check-private`) |

## Without Claude

```sh
node scripts/setup.mjs status
node scripts/setup.mjs install --all --dry-run   # see what it would do
node scripts/setup.mjs install --all             # rules, hooks, settings, own skills, default skills, plugins,
                                                 # and MCP allowlist (servers not in manifest/mcp.json go off)
node scripts/setup.mjs install --rules --skills=impeccable,wrangler
node scripts/setup.mjs set DISPLAY_NAME="Your Name" GIT_AUTHOR=your-git-name   # fills {{PLACEHOLDERS}}
node scripts/setup.mjs mcp-list                  # MCP servers found and whether they are on
node scripts/setup.mjs install --mcp --mcp-keep="claude.ai Figma"   # everything else off
node scripts/setup.mjs update                    # newest third-party skills and plugins
node scripts/setup.mjs restore                   # undo: put back the latest backup
```

Every install first copies whatever it will touch into `~/.claude/backups/claude-on-a-diet-<time>/`.

## Not included (log in per machine)

Claude login, `gh auth login`, MCP connectors (Figma, Linear...), project memories and per-project
permissions.
