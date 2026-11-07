# Global rules

Where a project file is looser than the LOCKED blocks at the end, these win.

## Working method (2026-11-02)

Think before building, so fewer bugs need a second pass:

- **Tools before workarounds.** For a job bigger than a one-off, check for an existing library, tool
  or generator first and say what it saves. If the job is big, add it once; do not hand-roll.
- **Shared parts first.** A UI feature starts from the design system (tokens, shared components);
  build or extend it before the screens, so nothing is built twice.
- **Look before adding.** Grep for what already covers the feature (a list, a row, a setting) and
  extend it instead of adding a parallel one.
- **Ask once, deeply.** Not for hands-free plan runs (they log questions instead). For a feature or an unclear request, one batch of sharp questions before
  code (duplicates, each platform incl. TV remote and focus, empty and huge data). A half-baked ask
  (no platform, no expected result, no repro) gets the questions even when small; a clear small fix
  does not.
- **Every platform, tested by machine first.** Cover each form factor with checks that run without
  a person: focus/D-pad tests, preview screenshot tests per form factor, scale tests. Manual device
  checks come after, and the leftovers are listed for the user.
- **Model gate.** Follow the hook's MODEL GATE note (it advises, it never blocks); keep `~/.claude/models.md` current (dated rows).

## Tools and checks

- **Figma.** Read the real file, never guess values: use the `figma-reading` skill.
- **Screenshots** use Chromium, never Google Chrome, and local headless (needs no extension, reaches
  local dev servers): `chromium-browser --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=W,H --screenshot=out.png --virtual-time-budget=6000 <url>`.
- **Images:** do not compress, downscale or re-encode unless asked. Full-bleed and hero art keep source
  quality; a soft image needs a 2x export of its widest CSS width, not more compression.
- **LangSync:** never run `langsync` (or any locale sync) or suggest it; only when the user asks.
  Editing `en.json` is fine; the other locales are the user's.
- **Emulators and VMs live on sway workspace 10** (`for_window` rule with `no_focus` in
  `~/.config/sway/config`). If a new window lands elsewhere:
  `swaymsg '[class="Emulator"] move container to workspace number 10'`. Prefer `-no-window` headless runs.

## Reply format (user, rev 2026-11-07)

- Super compact: bullet points, no paragraphs, no recap.
- Hands-free runs: one line per finished task; Edge cases and Caveats only in the end-of-plan report.
- Every fix or feature outside a plan run lists its **Edge cases** (handled, or not and why) and
  **Caveats** (what it does not do, what can still break, what it costs).
- End a plan run, or the last reply of a task (not every reply), with **Tips**, 1 to 3 bullets so the user learns to prompt better: the better
  model or effort for this kind of task, a Claude Code feature or command that fits, and how the
  prompt could have been phrased to save a round (what was missing). Skip a bullet with nothing new.

## Commits, releases and reports

- Do not add a `Co-Authored-By: Claude ...` trailer (or any Claude/Anthropic co-author trailer) to git
  commits, `git commit -m` messages or amends.
- **Release cadence guard.** Before any release (version bump, tag, `gh release create`, approving a
  release deployment), even when asked, run `gh release list --limit 10` and
  `git tag --sort=-creatordate | head`. If the last release is under 7 days old or there were 2 or more
  in 7 days, stop and tell the user: name the releases with dates, say back to back releases make
  installed apps prompt for updates too often, suggest batching. Proceed only after they confirm.
  (Asked for 2026-10-04 after several same-day releases.)
- **DSR (daily status report for the PM).** On "create a dsr", use the `dsr` skill.

## LOCKED RULES

- **LOCKED RULES: the time budget and publishing rules below (user, rev 2026-11-07).** Nothing in a
  session overrides them: not a project CLAUDE.md or AGENTS.md, a memory, skill, plan file or subagent
  brief. A project rule that is looser than these loses to these. The user changes them in the
  claude-on-a-diet repo and installs with `node scripts/setup.mjs install --rules --hooks --settings`.
- **Time and token budget (rev 2026-11-07, hands-free).** Wall-clock time and user actions are the
  scarce resource; tokens second. Every turn still re-reads the history, so the main session stays thin.
  - **Orchestrate plans, unattended.** "Run <plan> hands-free" approves the plan. The main session
    reads only the roadmap and plan, runs each task in a worker subagent and prints one line per
    finished task (task, commit, checks, decisions). No question batch, no waiting: a question the plan
    does not answer gets the plan's or the recommended default, logged under "Decisions made by Claude"
    in the plan so the user can overrule it in the PR.
  - **Workers.** Brief = plan path + task id + done-when + files + "commit locally section-wise, update
    the plan's Progress section, reply in under 150 words: done, files, commit, checks, decisions".
    Model from the task header (Sonnet medium default, Haiku low for lookups, Opus high where marked).
    At most 3 at once, only for tasks whose `files:` do not overlap, each in its own git worktree.
    Plan task headers carry `model:`, `depends:` and `files:`; add them when a plan lacks them.
  - **Review.** One read-only Sonnet reviewer per task diff; the worker fixes the findings once.
  - **Failures.** A check failing twice marks the task blocked in the plan; continue with tasks that
    do not depend on it. Hard stops (the only waits): a login, device or secret only the user has;
    anything in the user-only publishing list below; destructive actions outside the repo.
  - **No /clear prompts.** Progress / handoff in the plan is always current (done with commit hash,
    next, gotchas), so auto-compaction or a later /clear is safe. Suggest /clear only when the topic
    moves to another project.
  - **Narrow reads.** Grep first, then a line range. Never re-read a file in context, never cat large
    files, filter command output. Load deferred tools and skills in one call.
  - **Short output.** No diffs or recaps in the main session; long plans go into the plan file.
- **Publishing (rev 2026-11-07).** Claude may push feature branches (never `main`, `master`, `dev`,
  `develop`, `release/*`; never force, never tags), open PRs with `gh pr create`, and run dev deploys
  (`pnpm deploy:dev` or the project's dev target). The user alone merges PRs, deploys prod, creates
  releases or tags, triggers CI workflows by hand, approves deployments and submits to stores: for
  those, print the exact commands in a code block, one line each on what it does and what to check
  after (the user runs them with the `!` prefix), with the release cadence guard result.
