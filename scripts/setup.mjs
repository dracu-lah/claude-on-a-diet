#!/usr/bin/env node
// Cross-platform Claude Code config installer. Node built-ins only (Windows, macOS, Linux; any shell).
//   node scripts/setup.mjs status
//   node scripts/setup.mjs install [--rules] [--hooks] [--settings] [--own-skills] [--skills=default|all|none|a,b] [--plugins]
//                                  [--all] [--link] [--settings-skip=voice,theme] [--dry-run]
//   node scripts/setup.mjs update           # pull latest third-party skills + plugins
//   node scripts/setup.mjs capture          # copy this machine's ~/.claude back into the repo (owner)
//   node scripts/setup.mjs restore [dir]    # put a backup back (latest if no dir)
//   node scripts/setup.mjs check-private    # fail if repo files match .private-patterns
//   node scripts/setup.mjs mcp-list         # MCP servers found here and whether they are on
//   node scripts/setup.mjs install --mcp [--mcp-keep=a,b]  # keep listed servers, deny every other one
//   node scripts/setup.mjs set KEY=value ... # save personal values for {{KEY}} placeholders (per machine)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const WIN = process.platform === 'win32';
const CFG = path.join(REPO, 'config');
const fwd = (p) => p.split(path.sep).join('/');
const HOME_FWD = fwd(HOME);

const args = process.argv.slice(2);
const cmd = args[0] || 'status';
const flag = (n) => args.includes(`--${n}`) || args.includes('--all');
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a === undefined ? d : a.slice(n.length + 3); };
const DRY = args.includes('--dry-run');

const log = (...m) => console.log(...m);
const readJson = (p, d = {}) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, o) => { if (DRY) return log(`[dry] write ${p}`); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); };
const exists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

// ---------- personal values: {{KEY}} placeholders in config/ text files ----------
const PROFILE = path.join(CLAUDE, 'claude-on-a-diet.profile.json'); // per machine, never in the repo
const profile = () => readJson(PROFILE);
const PH = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const isText = (f) => /\.(md|txt|json|py|mjs|js|sh|ya?ml|toml)$/i.test(f);
const fill = (s, vals, missing) => s.replace(PH, (m, k) => (k in vals ? vals[k] : (missing?.add(k), m)));
const unfill = (s, vals) => Object.entries(vals).filter(([, v]) => v && v.length > 2)
  .sort((a, b) => b[1].length - a[1].length).reduce((acc, [k, v]) => acc.split(v).join(`{{${k}}}`), s);
function placeholders(dir = CFG, out = new Set()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) placeholders(p, out); else if (isText(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(PH)) out.add(m[1]);
  }
  return out;
}
const hasPH = (p) => fs.statSync(p).isDirectory() ? placeholders(p).size > 0 : isText(p) && PH.test(fs.readFileSync(p, 'utf8')) && !(PH.lastIndex = 0);
const MISSING = new Set();
function copyFilled(src, dst) {
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copyFilled(path.join(src, f), path.join(dst, f)); }
  else if (isText(src)) fs.writeFileSync(dst, fill(fs.readFileSync(src, 'utf8'), profile(), MISSING));
  else fs.copyFileSync(src, dst);
}

function run(bin, argv, { quiet } = {}) {
  log(`$ ${bin} ${argv.join(' ')}`);
  if (DRY) return 0;
  const r = spawnSync(bin, argv, { stdio: quiet ? 'pipe' : 'inherit', shell: WIN });
  return r.status ?? 1;
}
const has = (bin) => spawnSync(bin, ['--version'], { stdio: 'pipe', shell: WIN }).status === 0;
function pythonCmd() {
  for (const c of WIN ? ['py -3', 'python', 'python3'] : ['python3', 'python']) {
    const [b, ...a] = c.split(' ');
    const r = spawnSync(b, [...a, '-c', 'import sys;print(sys.version_info[0])'], { stdio: 'pipe', shell: WIN });
    if (r.status === 0 && String(r.stdout).trim() === '3') return c;
  }
  return null;
}

// ---------- backup ----------
let BACKUP = null;
const CREATED = new Set(); // paths this run adds; restore deletes them
function backup(rel) {
  const src = path.join(CLAUDE, rel);
  if (!BACKUP) {
    BACKUP = path.join(CLAUDE, 'backups', `claude-on-a-diet-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    log(`Backup: ${BACKUP}`);
  }
  if (!exists(src)) { CREATED.add(fwd(rel)); return; }
  const dst = path.join(BACKUP, rel);
  if (exists(dst) || DRY) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, dereference: true });
}

// ---------- place a file or dir (copy, or symlink with --link) ----------
function place(srcAbs, rel) {
  const dst = path.join(CLAUDE, rel);
  const transform = hasPH(srcAbs);
  backup(rel);
  if (DRY) return log(`[dry] ${flag('link') ? 'link' : 'copy'} ${rel}`);
  if (exists(dst) && fs.realpathSync(dst) === fs.realpathSync(srcAbs)) return log(`= ${rel} (already linked)`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (flag('link') && transform) log(`  ${rel} has {{placeholders}}: copied with your values, not linked`);
  if (flag('link') && !transform) {
    try {
      const dir = fs.statSync(srcAbs).isDirectory();
      fs.symlinkSync(srcAbs, dst, dir ? (WIN ? 'junction' : 'dir') : 'file');
      return log(`→ ${rel} (linked)`);
    } catch (e) { log(`! symlink failed for ${rel} (${e.code}); copying instead`); }
  }
  copyFilled(srcAbs, dst);
  log(`+ ${rel}`);
}

// ---------- settings merge ----------
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set(); return [...a, ...b].filter((x) => { const k = JSON.stringify(x); return seen.has(k) ? false : seen.add(k); });
  }
  if (isObj(a) && isObj(b)) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = k in a ? merge(a[k], b[k]) : b[k]; return o; }
  return b;
}
const isGuard = (h) => JSON.stringify(h).includes('token_guard.py');
function stripGuardHooks(s) {
  if (!s.hooks) return s;
  for (const ev of Object.keys(s.hooks)) { s.hooks[ev] = s.hooks[ev].filter((h) => !isGuard(h)); if (!s.hooks[ev].length) delete s.hooks[ev]; }
  if (!Object.keys(s.hooks).length) delete s.hooks;
  return s;
}
function installSettings(withHooks) {
  const py = pythonCmd();
  let repo = JSON.parse(fs.readFileSync(path.join(CFG, 'settings.json'), 'utf8')
    .replaceAll('__HOME__/.claude', fwd(CLAUDE)).replaceAll('__HOME__', HOME_FWD).replaceAll('__PYTHON__', py || 'python3'));
  for (const k of opt('settings-skip', '').split(',').filter(Boolean)) delete repo[k];
  if (!withHooks || !py) { if (withHooks) log('! Python 3 not found: hooks skipped (install Python 3, then re-run with --hooks)'); stripGuardHooks(repo); }
  const file = path.join(CLAUDE, 'settings.json');
  backup('settings.json');
  const cur = stripGuardHooks(readJson(file)); // drop old guard entries so a moved HOME does not duplicate them
  writeJson(file, merge(cur, repo));
  log('+ settings.json (merged; your other keys kept)');
  return !!py;
}

// ---------- third-party skills + plugins ----------
function selectedSkills() {
  const all = readJson(path.join(REPO, 'manifest', 'skills.json')).skills || [];
  const sel = opt('skills', args.includes('--all') ? 'default' : 'none');
  if (sel === 'none') return [];
  if (sel === 'all') return all;
  if (sel === 'default') return all.filter((s) => s.default);
  const want = new Set(sel.split(','));
  return all.filter((s) => want.has(s.name));
}
function installSkills(list) {
  if (!list.length) return;
  if (!has('npx')) return log('! npx not found: install Node.js (https://nodejs.org) to get third-party skills');
  backup('skills');
  const failed = [];
  for (const s of list) if (run('npx', ['-y', 'skills', 'add', s.source, '-g', '-a', 'claude-code', '-s', s.name, '-y'])) failed.push(s.name);
  log(failed.length ? `! skills failed: ${failed.join(', ')}` : `+ ${list.length} skills installed`);
}
function installPlugins() {
  if (!has('claude')) return log('! claude CLI not on PATH: plugins skipped');
  const m = readJson(path.join(REPO, 'manifest', 'plugins.json'));
  for (const mk of m.marketplaces || []) run('claude', ['plugin', 'marketplace', 'add', mk.repo]);
  for (const p of m.plugins || []) run('claude', ['plugin', 'install', p]);
}

// ---------- MCP allowlist (deny rules turn a server off in every project) ----------
const BUILTIN_MCP = ['claude-in-chrome', 'claude-artifacts'];
const mcpRule = (n) => `mcp__${n.replace(/[^A-Za-z0-9_-]/g, '_')}`;
const isServerRule = (r) => r.startsWith('mcp__') && !r.slice(5).includes('__'); // whole server, not one tool
function discoverMcp() {
  const names = new Set(BUILTIN_MCP);
  const r = spawnSync('claude', ['mcp', 'list'], { stdio: 'pipe', shell: WIN, timeout: 120000 });
  for (const line of String(r.stdout || '').split('\n')) { const m = line.match(/^(\S[^:]*): .* - \S/); if (m) names.add(m[1].trim()); }
  for (const n of readJson(path.join(HOME, '.claude.json')).claudeAiMcpEverConnected || []) names.add(n); // read only
  return [...names];
}
function mcpKeep() {
  const o = opt('mcp-keep', null);
  return new Set(o !== null ? o.split(',').map((s) => s.trim()).filter(Boolean) : readJson(path.join(REPO, 'manifest', 'mcp.json')).keep || []);
}
function mcpList() {
  const deny = new Set(readJson(path.join(CLAUDE, 'settings.json')).permissions?.deny || []);
  const keep = mcpKeep();
  log(JSON.stringify(discoverMcp().map((n) => ({ name: n, on: !deny.has(mcpRule(n)), inManifest: keep.has(n) })), null, 2));
}
function installMcp() {
  if (!has('claude')) return log('! claude CLI not on PATH: MCP step skipped');
  const keep = mcpKeep(), found = discoverMcp();
  const file = path.join(CLAUDE, 'settings.json');
  backup('settings.json');
  const s = readJson(file);
  s.permissions ??= {};
  const keepRules = new Set([...keep].map(mcpRule));
  const off = found.filter((n) => !keep.has(n));
  s.permissions.deny = [...new Set([...(s.permissions.deny || []).filter((r) => !keepRules.has(r)), ...off.map(mcpRule)])];
  writeJson(file, s);
  log(`+ MCP on: ${[...keep].join(', ') || 'none'}\n+ MCP off: ${off.join(', ') || 'none'}`);
}

// ---------- commands ----------
function install() {
  log(`Claude config dir: ${CLAUDE}${DRY ? '  (dry run)' : ''}`);
  if (flag('rules')) place(path.join(CFG, 'CLAUDE.md'), 'CLAUDE.md');
  if (flag('hooks')) {
    place(path.join(CFG, 'models.md'), 'models.md');
    for (const f of fs.readdirSync(path.join(CFG, 'hooks'))) place(path.join(CFG, 'hooks', f), path.join('hooks', f));
  }
  if (flag('settings')) installSettings(flag('hooks'));
  if (flag('own-skills')) for (const d of fs.readdirSync(path.join(CFG, 'skills'))) place(path.join(CFG, 'skills', d), path.join('skills', d));
  installSkills(selectedSkills());
  if (flag('plugins')) installPlugins();
  if (flag('mcp')) installMcp(); // after plugins, so plugin MCPs are found
  if (MISSING.size) log(`\n! No value for: ${[...MISSING].join(', ')}. Run: node scripts/setup.mjs set ${[...MISSING].map((k) => `${k}=...`).join(' ')}  then install again`);
  if (BACKUP && !DRY) { fs.mkdirSync(BACKUP, { recursive: true }); writeJson(path.join(BACKUP, '.created.json'), [...CREATED]); }
  log(BACKUP ? `\nDone. Undo with: node scripts/setup.mjs restore "${BACKUP}"` : '\nDone, nothing changed.');
}

function restore() {
  const root = path.join(CLAUDE, 'backups');
  const dir = args[1] || (exists(root) ? fs.readdirSync(root).filter((d) => d.startsWith('claude-on-a-diet-')).sort().map((d) => path.join(root, d)).pop() : null);
  if (!dir || !exists(dir)) return log('No claude-setup backup found.'), process.exit(1);
  for (const rel of readJson(path.join(dir, '.created.json'), [])) { log(`- ${rel}`); if (!DRY) fs.rmSync(path.join(CLAUDE, rel), { recursive: true, force: true }); }
  for (const rel of fs.readdirSync(dir).filter((f) => f !== '.created.json')) {
    const dst = path.join(CLAUDE, rel);
    log(`< ${rel}`);
    if (DRY) continue;
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(path.join(dir, rel), dst, { recursive: true });
  }
  log(`Restored from ${dir}`);
}

function status() {
  const py = pythonCmd();
  log(JSON.stringify({
    os: `${process.platform} ${os.release()}`, node: process.version, claudeDir: CLAUDE,
    tools: { claude: has('claude'), npx: has('npx'), git: has('git'), python3: py },
    present: Object.fromEntries(['CLAUDE.md', 'settings.json', 'models.md', 'hooks/token_guard.py', 'skills'].map((f) => {
      const p = path.join(CLAUDE, f); return [f, !exists(p) ? false : fs.lstatSync(p).isSymbolicLink() ? 'symlink' : true];
    })),
    ownSkills: fs.readdirSync(path.join(CFG, 'skills')),
    placeholders: Object.fromEntries([...placeholders()].map((k) => [k, profile()[k] ?? null])),
    gitDefaults: { name: String(spawnSync('git', ['config', 'user.name'], { stdio: 'pipe', shell: WIN }).stdout || '').trim() || null },
    thirdPartySkills: (readJson(path.join(REPO, 'manifest', 'skills.json')).skills || []).map((s) => `${s.name}${s.default ? '*' : ''} (${s.source})`),
    plugins: readJson(path.join(REPO, 'manifest', 'plugins.json')).plugins,
  }, null, 2));
}

function update() {
  if (has('npx')) run('npx', ['-y', 'skills', 'update', '-g', '-y']);
  if (has('claude')) { run('claude', ['plugin', 'marketplace', 'update']); for (const p of readJson(path.join(REPO, 'manifest', 'plugins.json')).plugins || []) run('claude', ['plugin', 'update', p]); }
}

const DROP_KEYS = ['autoMode', 'skipDangerousModePermissionPrompt']; // machine or company specific
function capture() {
  const vals = profile();
  const unfillTree = (p) => { if (fs.statSync(p).isDirectory()) return fs.readdirSync(p).forEach((f) => unfillTree(path.join(p, f))); if (isText(p)) fs.writeFileSync(p, unfill(fs.readFileSync(p, 'utf8'), vals)); };
  const cp = (from, to) => { if (!exists(from)) return; if (exists(to) && fs.realpathSync(from) === fs.realpathSync(to)) return; fs.mkdirSync(path.dirname(to), { recursive: true }); fs.rmSync(to, { recursive: true, force: true }); fs.cpSync(from, to, { recursive: true, dereference: true }); unfillTree(to); log(`< ${fwd(path.relative(REPO, to))}`); };
  cp(path.join(CLAUDE, 'CLAUDE.md'), path.join(CFG, 'CLAUDE.md'));
  cp(path.join(CLAUDE, 'models.md'), path.join(CFG, 'models.md'));
  for (const f of ['token_guard.py', 'token_guard_cases.txt']) cp(path.join(CLAUDE, 'hooks', f), path.join(CFG, 'hooks', f));
  const own = new Set([...fs.readdirSync(path.join(CFG, 'skills')), ...opt('add-skill', '').split(',').filter(Boolean)]);
  for (const d of own) cp(path.join(CLAUDE, 'skills', d), path.join(CFG, 'skills', d));

  const s = readJson(path.join(CLAUDE, 'settings.json'));
  for (const k of DROP_KEYS) delete s[k];
  if (s.permissions) delete s.permissions.allow; // per-machine approvals, often project paths
  if (s.permissions?.deny) s.permissions.deny = s.permissions.deny.filter((r) => !isServerRule(r)); // rebuilt from manifest/mcp.json per machine
  let txt = JSON.stringify(s, null, 2).split(HOME_FWD).join('__HOME__').split(HOME.replaceAll('\\', '\\\\')).join('__HOME__');
  txt = txt.replace(/"(?:py -3|python3?) -I /g, '"__PYTHON__ -I ');
  fs.writeFileSync(path.join(CFG, 'settings.json'), txt + '\n');
  log('< config/settings.json (sanitized)');

  const lock = readJson(path.join(HOME, '.agents', '.skill-lock.json')).skills || {};
  const mf = path.join(REPO, 'manifest', 'skills.json');
  const prev = Object.fromEntries((readJson(mf).skills || []).map((x) => [x.name, x]));
  const skills = Object.entries(lock).filter(([, v]) => v && typeof v === 'object' && v.source)
    .map(([name, v]) => ({ name, source: v.source, default: prev[name]?.default ?? exists(path.join(CLAUDE, 'skills', name)) }))
    .sort((a, b) => (b.default - a.default) || a.source.localeCompare(b.source));
  if (skills.length) writeJson(mf, { skills });
  const inst = readJson(path.join(CLAUDE, 'plugins', 'installed_plugins.json')).plugins || {};
  const mk = readJson(path.join(CLAUDE, 'plugins', 'known_marketplaces.json'));
  writeJson(path.join(REPO, 'manifest', 'plugins.json'), {
    marketplaces: Object.entries(mk).filter(([, v]) => v?.source?.repo).map(([name, v]) => ({ name, repo: v.source.repo })),
    plugins: Object.keys(inst),
  });
  log('< manifest/*.json');
  checkPrivate();
}

function checkPrivate() {
  const pf = path.join(REPO, '.private-patterns');
  const pats = exists(pf) ? fs.readFileSync(pf, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  pats.push(HOME_FWD, ...Object.values(profile()).filter((v) => typeof v === 'string' && v.length > 2)); // your home path and personal values
  const TOKENS = /sk-ant-[\w-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_\w{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY/;
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(e.name) || e.name === '.private-patterns') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (fs.statSync(p).size < 2e6) { const t = fs.readFileSync(p, 'utf8').replace(/github\.com\/[\w.-]+\/claude-on-a-diet/g, ''); /* the repo's own URL is fine */ for (const pat of pats) if (t.toLowerCase().includes(pat.toLowerCase())) hits.push(`${fwd(path.relative(REPO, p))}: ${pat}`); if (TOKENS.test(t)) hits.push(`${fwd(path.relative(REPO, p))}: looks like a secret token`); }
  } };
  walk(REPO);
  if (hits.length) { log('PRIVATE DATA FOUND, not safe to publish:\n  ' + hits.join('\n  ')); process.exit(1); }
  log('check-private: clean');
}

function set() {
  const vals = profile();
  for (const kv of args.slice(1)) { const i = kv.indexOf('='); if (i > 0) vals[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); }
  writeJson(PROFILE, vals);
  log(`Saved ${Object.keys(vals).join(', ')} to ${PROFILE}`);
}

({ install, restore, set, 'mcp-list': mcpList, status, update, capture, 'check-private': checkPrivate }[cmd] || (() => { log(`Unknown command: ${cmd}`); process.exit(2); }))();
