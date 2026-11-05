---
name: start-configuring
description: Use when the user, inside the claude-on-a-diet repo, says "start configuring", "set me up", "install my config", "setup", or similar. Interviews them once, backs up the existing ~/.claude, then installs global rules, hooks, settings, skills and plugins from this repo on any OS.
---

# Start configuring

Installs this repo's Claude Code setup into the user's config dir (`~/.claude`, or `$CLAUDE_CONFIG_DIR`).
Works the same on Windows, macOS and Linux: everything runs through `node scripts/setup.mjs`.

## 1. Check the machine (one call)

Run `node scripts/setup.mjs status` and `node scripts/setup.mjs mcp-list` (two parallel calls;
mcp-list can take a minute while servers are health-checked). If `node` itself is missing, stop and give the install line for
their OS: Windows `winget install OpenJS.NodeJS.LTS`, macOS `brew install node`, Fedora
`sudo dnf install nodejs`, Debian/Ubuntu `sudo apt install nodejs npm`. Note what is missing
(python3 → hooks are skipped; npx → third-party skills are skipped) and say so in the questions.

## 2. Ask once (one AskUserQuestion call, up to 4 questions)

1. **Who** (single): "Owner (link files to this repo so edits sync back)" vs "Friend (copy, make it
   my own)". Owner = `--link`. On Windows, links fall back to copies without Developer Mode; say so.
2. **What to install** (multiSelect; all recommended): Global rules (CLAUDE.md) · Token guard hook +
   model gate (needs Python 3) · Settings (merged, nothing of theirs is deleted) · Plugins.
   Own skills (dsr, figma-reading) go with "Global rules".
3. **Third-party skills** (single): "Default set" (the `default: true` ones in
   `manifest/skills.json`, list them by name) · "All N" · "Let me pick" · "None".
   If "Let me pick", ask a follow-up multiSelect grouped by source (max 4 options per question,
   so batch groups like "Cloudflare", "Design/UI", "Marketing/SEO", "Docs: pdf/docx/xlsx").
4. Friends only: **Personal bits** (multiSelect) in `config/CLAUDE.md` they may not want:
   sway workspace rule, LangSync rule, DSR/PM report, the "user runs all publishing" lock,
   the Reply format. Also offer to skip settings keys `voice,tui,theme,model`.

Then a second AskUserQuestion call (same round, do not wait for more input in between):

5. **Personal values**: one question per key in `status` → `placeholders` (e.g. `DISPLAY_NAME`
   for the DSR header, `GIT_AUTHOR` for `git log --author`). Offer the detected value as the first
   option (`gitDefaults.name`, `gh api user -q .login` for GIT_AUTHOR), plus "Skip"; they can type
   their own via Other. Already set keys (non-null) are shown as the default, not asked again.
6. **MCP servers** (multiSelect): run `node scripts/setup.mjs mcp-list` first. Options = the
   servers found (max 4 per question, split if more), pre-describe the ones in
   `manifest/mcp.json` `keep` as "(recommended)". Everything not selected is turned off in every
   project (a `permissions.deny` rule); say that in the question. If they want MCPs left alone,
   drop `--mcp` from the install flags instead.

If the existing `~/.claude` has a `CLAUDE.md` or `settings.json`, say they will be backed up first
(the script does it automatically into `~/.claude/backups/claude-on-a-diet-<time>/`).

## 3. Install

0. Save personal values: `node scripts/setup.mjs set DISPLAY_NAME="..." GIT_AUTHOR=...`
   (stored in `~/.claude/claude-on-a-diet.profile.json`, never in the repo).
1. Dry run first: `node scripts/setup.mjs install <flags> --dry-run`, show the list in 5 lines max.
2. Then run it for real with the same flags. Flags: `--rules --own-skills --hooks --settings
   --plugins --mcp --mcp-keep="claude.ai Figma,claude.ai Linear" --skills=default|all|none|name1,name2
   --link --settings-skip=voice,theme`. Pass `--mcp-keep=` (empty) to turn every MCP off.
   With `--mcp` the dry run lists which servers would go on and off without writing anything.
3. Friend chose to drop personal bits: edit `~/.claude/CLAUDE.md` (the copy, never
   `config/CLAUDE.md`) to remove those sections. Never remove the LOCKED RULES block unless they
   explicitly ask; if they do, remove it and the matching `permissions.deny` lines together.

## 4. Finish

- Report: what was installed, which MCPs are on and off, what was skipped and why, the backup path, and the undo command
  `node scripts/setup.mjs restore`.
- Tell them to restart Claude Code (settings, hooks and skills load at start) and run `/doctor`.
- Later updates: `git pull` then `node scripts/setup.mjs install ...` again (backs up again), and
  `node scripts/setup.mjs update` for the newest third-party skills and plugins.
- Logins are per machine and never in this repo: `gh auth login`, MCP connectors (Figma, Linear)
  via `/mcp` or claude.ai, `claude` login itself.
