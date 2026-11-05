---
name: dsr
description: Use when the user says "create a dsr" or asks for the daily status report for the PM. Builds it from git log in the fixed format.
---

Build it from
`git log --since=<last DSR> --author={{GIT_AUTHOR}} --no-merges dev main HEAD` (the user pastes the last
DSR; skip what it lists; yesterday plus today so far). Fixed format:

```
DD/MM/YYYY | {{DISPLAY_NAME}}

Project: <project name>
- one line per task
```

Each bullet becomes one Linear issue: task-shaped, one line, super short, plain PM-facing English
(no jargon, paths, hashes, branch names or em-dashes). Merge commits on one task into one bullet.
Drop pure chores (dev flags, internal docs, dummy commits, add-then-revert); user-visible work and
i18n syncs stay. Missed days mean one report per day. Reply in chat only; never save DSR files in a repo.
