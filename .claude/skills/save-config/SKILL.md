---
name: save-config
description: Use when the owner says "save my config", "sync my rules", "capture config" or "update the repo" inside claude-on-a-diet. Copies the live ~/.claude setup back into the repo, scrubs private data and commits locally.
---

# Save config

1. `node scripts/setup.mjs capture` (copies rules, models.md, hooks, own skills, sanitized
   settings, and rebuilds `manifest/` from `~/.agents/.skill-lock.json` and installed plugins).
   A new own skill in `~/.claude/skills` is only picked up with `--add-skill=name`; ask if
   `git status` shows none but the user mentions one.
2. If it prints `PRIVATE DATA FOUND`: show the hits, fix them in the repo copy (never in
   `~/.claude`), and add new private words to `.private-patterns` (gitignored).
3. `git diff --stat`, then commit with a short message. Never push: print
   `git push` for the user to run.
