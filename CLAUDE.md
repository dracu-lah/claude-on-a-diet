# claude-on-a-diet

Portable Claude Code setup. `config/` mirrors `~/.claude`; `manifest/` lists third-party skills and
plugins to fetch fresh; `scripts/setup.mjs` does all the work (Node built-ins only, any OS/shell).

- "start configuring", "setup", "install" → use the `start-configuring` skill.
- "save my config", "sync" → use the `save-config` skill.
- This repo is public. Never put tokens, company names, client paths or project memories in it;
  `node scripts/setup.mjs check-private` must pass before a commit (the pre-commit hook runs it).
- `config/settings.json` keeps `__HOME__` and `__PYTHON__` placeholders; the installer fills them.
- Never edit `~/.claude` files without the script: it is what makes the backup.
