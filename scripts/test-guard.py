#!/usr/bin/env python3
"""Run config/hooks/token_guard_cases.txt (want|command) against the repo's hook.
Bare pushes resolve the branch of a throwaway git repo on `main`. Usage: python3 scripts/test-guard.py"""
import json, os, subprocess, sys, tempfile
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hook = os.path.join(repo, 'config', 'hooks', 'token_guard.py')
tmp = tempfile.mkdtemp()
subprocess.run(['git', 'init', '-q', '-b', 'main', tmp], check=True)
bad = 0
for line in open(os.path.join(repo, 'config', 'hooks', 'token_guard_cases.txt'), encoding='utf-8'):
    line = line.rstrip('\n')
    if '|' not in line:
        continue
    want, cmd = line.split('|', 1)
    p = subprocess.run([sys.executable, '-I', hook, 'bash'], capture_output=True, text=True,
                       input=json.dumps({'tool_input': {'command': cmd}, 'cwd': tmp}))
    if str(p.returncode) != want:
        bad += 1
        print(f'MISMATCH want {want} got {p.returncode}: {cmd}')
def run(cmd, cwd):
    return subprocess.run([sys.executable, '-I', hook, 'bash'], capture_output=True, text=True,
                          input=json.dumps({'tool_input': {'command': cmd}, 'cwd': cwd})).returncode

# bare push depends on the repo's state: feature branch ok, push.default=matching blocked
feat = tempfile.mkdtemp()
subprocess.run(['git', 'init', '-q', '-b', 'feat/y', feat], check=True)
for want, setup in ((0, None), (2, 'matching')):
    if setup:
        subprocess.run(['git', '-C', feat, 'config', 'push.default', setup], check=True)
    got = run('git push', feat)
    if got != want:
        bad += 1
        print(f'MISMATCH want {want} got {got}: bare push on feat/y, push.default={setup}')

print('guard cases:', 'all pass' if not bad else f'{bad} failed')
sys.exit(1 if bad else 0)
