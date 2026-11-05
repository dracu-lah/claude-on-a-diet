#!/usr/bin/env python3
"""Token guard (user, 2026-11-02). Hard limits that need no cooperation from the model.
  read   : PreToolUse on Read, blocks a whole-file read of a big text file (no limit given).
  bash   : PreToolUse on Bash, blocks a Gradle run whose full output would land in the history.
  prompt : UserPromptSubmit, warns on long sessions and blocks very long ones until /clear,
           and adds the model gate (current model and effort, routing from ~/.claude/models.md).
Fails open: any error in here lets the action through."""
import json, os, re, sys

READ_MAX_BYTES = 30_000
WARN_CALLS, BLOCK_CALLS = 150, 400
CLAUDE_DIR = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude')
MODELS_MD = os.path.join(CLAUDE_DIR, 'models.md')
SETTINGS = os.path.join(CLAUDE_DIR, 'settings.json')
SET_MODEL = re.compile(r'Set model to `?([^`<"\\]+)')
SET_EFFORT = re.compile(r'[Ee]ffort(?: level)? (?:set )?to `?(low|medium|high|xhigh|max)')
ALIASES = {'opus': 'claude-opus-5-5', 'sonnet': 'claude-sonnet-5-5', 'haiku': 'claude-haiku-5-5',
           'fable': 'claude-fable-5-1'}
GRADLE = re.compile(r'(^|[\s;&|(])(\./|\S*/)?gradlew(\.bat)?(?=[\s;&|)]|$)|(^|[\s;&|(])gradle\s')
GRADLE_OK = re.compile(r'\|\s*(tail|grep|head|rg|jq|wc|sed|awk)\b|(^|\s)(-q|--quiet|--stop|--status|'
                       r'--version|-v)(\s|$)|(?<![0-9&])>|&>')
# Backs up permissions.deny, whose prefix match misses 'git -C x push', 'npx --yes wrangler deploy',
# 'pnpm exec wrangler deploy'. Read-only forms (gh release list/view) stay allowed here.
PUBLISH = re.compile(
    r'\bgit(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?))*\s+push\b'
    r'|(?P<wr>\bwrangler\b(?:\s+(?!deploy\b|publish\b)[^\s;&|]+)*?\s+(?:pages\s+|versions\s+)?(?:deploy|publish)\b)'
    r'|\bgh\s+release\s+(?:create|upload|edit|delete)\b|\bgh\s+workflow\s+run\b')
SKIP_EXT ={'.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.ipynb', '.svg'}

def main():
    mode = sys.argv[1]
    d = json.load(sys.stdin)
    if mode == 'read':
        ti = d.get('tool_input') or {}
        p = ti.get('file_path') or ''
        if ti.get('limit') or ti.get('pages') or os.path.splitext(p)[1].lower() in SKIP_EXT:
            return 0
        if os.path.isfile(p) and os.path.getsize(p) > READ_MAX_BYTES:
            print(f"Blocked by token guard: {p} is {os.path.getsize(p)//1000} KB. Grep for what you need, "
                  f"then Read with offset and limit.", file=sys.stderr)
            return 2
    elif mode == 'bash':
        cmd = (d.get('tool_input') or {}).get('command') or ''
        m = PUBLISH.search(cmd)
        if m and not (m.group('wr') and '--dry-run' in cmd):
            print(f"Blocked by publish guard (LOCKED rule): '{m.group(0).strip()}' publishes. The user runs "
                  "all publishing: commit locally and print the exact command for them to run with '!'.",
                  file=sys.stderr)
            return 2
        if GRADLE.search(cmd) and not GRADLE_OK.search(cmd):
            print("Blocked by token guard: raw Gradle output stays in the history and is re-read every "
                  "turn. Rerun with -q, or pipe it (2>&1 | tail -40, or | grep -E 'FAIL|error:|BUILD'), "
                  "or redirect to a scratchpad log and grep that.", file=sys.stderr)
            return 2
    elif mode == 'prompt':
        if (d.get('prompt') or '').lstrip().startswith('/'):
            return 0
        n, last_req, switched, set_effort = 0, None, None, None
        try:
            f = open(d.get('transcript_path') or '', errors='ignore')
        except OSError:
            # first prompt of a new session: the transcript file does not exist yet
            f = open(os.devnull)
        with f:
            for line in f:
                if '"role":"assistant"' in line and '"usage"' in line:
                    n += 1
                if '"type":"api-request"' in line:
                    last_req, switched, set_effort = line, None, None
                elif '"subtype":"compact_boundary"' in line:
                    # history is now a summary: cache is cold anyway, so treat it as a fresh session
                    n = 0
                elif '<local-command-stdout>' in line:
                    out = command_stdout(line)
                    m = SET_MODEL.search(out)
                    if m:
                        switched, set_effort = m.group(1).strip(), None
                    m = SET_EFFORT.search(out)
                    if m:
                        set_effort = m.group(1)
        if n >= BLOCK_CALLS:
            print(f"Blocked by token guard: this session has {n} model calls, each one re-reads the whole "
                  f"history. Finish the phase, update the plan's Progress section, run /clear and paste "
                  f"the resume prompt.", file=sys.stderr)
            return 2
        ctx = []
        if n >= WARN_CALLS:
            ctx.append(f"TOKEN GUARD: session is at {n} model calls (blocks at {BLOCK_CALLS}). "
                "Tell the user to wrap up this phase, update the plan Progress section and /clear.")
        try:
            ctx.append(model_gate(d, n, last_req, switched, set_effort))
        except Exception:
            pass
        if ctx:
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
                "additionalContext": "\n\n".join(ctx)}}))
    return 0

def command_stdout(line):
    """Text of a real slash-command output entry, '' for anything else (summaries, tool results
    and prompts that only quote 'Set model to' must not count as a switch)."""
    try:
        msg = json.loads(line).get('message') or {}
    except Exception:
        return ''
    if msg.get('role') != 'user':
        return ''
    c = msg.get('content')
    if isinstance(c, list):
        c = next((b.get('text') for b in c if isinstance(b, dict) and b.get('type') == 'text'), '')
    return c if isinstance(c, str) and c.lstrip().startswith('<local-command-stdout>') else ''

def find_key(o, k):
    if isinstance(o, dict):
        if isinstance(o.get(k), str):
            return o[k]
        o = list(o.values())
    if isinstance(o, list):
        for v in o:
            r = find_key(v, k)
            if r:
                return r
    return None

def model_id(name):
    """'Opus 5.5' or 'Default (Opus 5.5)' -> 'claude-opus-5-5'; aliases stay as they are."""
    if 'opusplan' in name.lower():
        return 'opusplan'
    m = re.search(r'(Fable|Opus|Sonnet|Haiku)\s*([\d.]+)', name, re.I)
    return f"claude-{m.group(1).lower()}-{m.group(2).replace('.', '-')}" if m else name

def model_gate(d, n, last_req, switched, set_effort):
    try:
        st = json.load(open(SETTINGS))
    except Exception:
        st = {}
    model = d.get('model')
    if isinstance(model, dict):
        model = model.get('id') or model.get('display_name')
    effort = None
    if not isinstance(model, str) or not model:
        model = None
        if switched:
            model = model_id(switched)
        elif last_req:
            params = json.loads(last_req).get('params') or {}
            model, effort = params.get('model'), find_key(params, 'effort')
        model = model or st.get('model') or 'unknown'
    model = ALIASES.get(model, model)
    effort = (set_effort or os.environ.get('CLAUDE_CODE_EFFORT_LEVEL') or effort
              or ((st.get('modelSettings') or {}).get(model) or {}).get('effortLevel')
              or st.get('effortLevel') or 'default')
    prompt = d.get('prompt') or ''
    head = f"MODEL GATE (hook): current model {model}, effort {effort}."
    if '--stay' in prompt:
        return head + " The user added --stay: work on this model, no model check."
    try:
        md = open(MODELS_MD).read()
    except Exception:
        md = ''
    out = [head]
    base = re.sub(r'-\d{8}$|\[1m\]$', '', model)
    if md and base not in md and base not in ('opusplan', 'unknown', 'opus', 'sonnet', 'haiku', 'fable'):
        out.append(f"NEW MODEL: {base} is not in ~/.claude/models.md. Tell the user in one line and "
                   "offer to add its row (strengths, effort) after this task.")
    if n == 0 or switched:
        sec = md.split('## Routing', 1)[1].split('\n## ', 1)[0].strip() if '## Routing' in md else ''
        out.append("Before any tool call, pick the right model and effort for this task from the "
                   "routing below. If it does not match, do not start the work: reply only with a short "
                   "model check (what the task is, the right model and effort, why in a few words), the "
                   "commands `/model <alias>` and if needed `/effort <level>`, then 'press Up and Enter to "
                   "resend the prompt; add --stay to run it here anyway'. If it matches, just start.\n\n" + sec)
    else:
        out.append("Mid-session: only when this prompt starts a new task of another tier (routing in "
                   "~/.claude/models.md), name the right model in one line and suggest it for after /clear; "
                   "do not stop mid-task, a switch re-reads the whole history uncached.")
    return "\n".join(out)

try:
    sys.exit(main())
except SystemExit:
    raise
except Exception:
    sys.exit(0)
