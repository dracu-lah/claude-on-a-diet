# Models: which one for which task

Read by the model gate in `~/.claude/hooks/token_guard.py` (it injects the Routing section on the
first prompt of a session). Edit the table here; the hook picks it up on the next session.
When a session shows a model is better or worse at something than this says, update this file and
date the line.

## Routing

| Task | Model (`/model ...`) | Effort |
| --- | --- | --- |
| Question, lookup, status, DSR, commit message, no code change | `haiku` (claude-haiku-5-5) | low |
| Small fix with a known cause, strings and en.json, docs, tests for existing code | `sonnet` (claude-sonnet-5-5) | low or medium |
| Feature or refactor from a written plan, UI from the design system, build and test loops | `sonnet` | medium |
| Large multi-file build from a plan, understood but fiddly | `sonnet` | high |
| Plan a feature (each platform, edge cases), architecture, design or UX direction, bug with an unknown cause, crash, TV performance, security, hooks and config design, release risk | `opus` (claude-opus-5-5) | high |
| Opus at high failed once, or a concurrency or data-loss bug | `opus` | xhigh |
| Plan and then build in one session | `opusplan` (Opus in plan mode, Sonnet after you approve) | as set |
| Opus in plan mode, else Sonnet (the name `/model opusplan` shows, added 2026-11-04) | same as the `opusplan` row: Opus plans, Sonnet builds | as set (high in plan mode, medium after) |
| claude-fable-5-1 | not profiled yet: the gate never picks it until a row is added here | |

Gate rules (rev 2026-11-07): never stop. When the model or effort is off, name the better one in
one line and start the work. Hands-free plan runs pick the model per task in worker subagents. `opusplan` passes for both planning
and building. Mid-task, never stop: a switch makes the whole history re-read without the prompt
cache, so recommend it for after the next `/clear` instead. Right after `/compact` counts as a
fresh session (the cache is cold anyway), so the full check runs again (2026-11-02).

Effort follows the model: `modelSettings` in `~/.claude/settings.json` sets opus-5-5 to high and
sonnet-5-5 to medium, so `/model` alone usually sets both. On a new release, update ALIASES in
the hook too (it resolves `opus` in settings.json to an ID for a fresh session). Use `/effort <level>` to change it.

## Claude Code features that save repeated work

- **`opusplan`**: one session, Opus thinks in plan mode (Shift+Tab), Sonnet does the edits after
  approval. Saves the manual switch on every feature.
- **Skills** (`~/.claude/skills/<name>/SKILL.md`): any procedure done twice (release checklist,
  emulator test pass, screenshot set) becomes a skill, loaded only when used. `dsr` is the model.
- **Hooks**: rules that must always hold go here, not in prose (token guard, this gate).
- **Plan files with Progress / handoff**: `/clear` often, resume from the file alone.
- **Monitor and `/loop`**: wait for a build, CI or emulator without polling turns.
- **Worktrees** (`EnterWorktree`): a second feature in parallel without stashing.
- **Workflows / ultracode, subagents**: multi-agent, costly; off unless the locked token rules allow.
- To evaluate before relying on: `advisorModel` (a server-side advisor for the main model),
  `fastMode` (faster Opus output), `PostModelSwitch` hook event.
