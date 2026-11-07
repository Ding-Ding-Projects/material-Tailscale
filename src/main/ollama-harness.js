'use strict';
// Harness launch for the Ollama suite: the app starts another program pointed at a local model.
// Ollama itself cannot launch programs; this is the app's own, allowlisted orchestration. A
// profile is a program, a list of arguments (no shell, no command line text) that may use only
// the {model} and {host} placeholders, a working folder and environment variables from a short
// allowlist. Every launch saves a snapshot of the profiles first, runs a health check, and puts
// the snapshot back automatically if the launch or the check fails.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ollama = require('./ollama');

const HOST = '127.0.0.1:11434';
const ENV_KEYS = { OLLAMA_HOST: HOST, OLLAMA_API_BASE: `http://${HOST}`, OLLAMA_BASE_URL: `http://${HOST}` };
const PLACEHOLDER = /\{(model|host)\}/g;
let dataDir = () => '';
function setup({ userData }) { dataDir = typeof userData === 'function' ? userData : () => userData; }

const BUILTIN = [
  { id: 'terminal', name: 'Terminal chat', builtin: true, find: () => ollama.binary(), args: ['run', '{model}'], console: true, needsFolder: false, env: [], health: 'alive', about: 'Opens a console window running "ollama run" with the model.' },
  { id: 'aider', name: 'Aider', builtin: true, find: () => ollama.onPath('aider'), args: ['--model', 'ollama_chat/{model}'], console: true, needsFolder: true, env: ['OLLAMA_API_BASE'], health: 'alive', about: 'Pair programming in a folder you choose. Needs Aider installed (pip install aider-install).' },
  { id: 'open-webui', name: 'Open WebUI', builtin: true, find: () => ollama.onPath('docker'), args: ['run', '-d', '-p', '3000:8080', '--add-host=host.docker.internal:host-gateway', '-e', 'OLLAMA_BASE_URL=http://host.docker.internal:11434', '-v', 'open-webui:/app/backend/data', '--name', 'open-webui', 'ghcr.io/open-webui/open-webui:main'], console: false, needsFolder: false, env: [], health: 'http://127.0.0.1:3000', about: 'A browser chat for your local models, run in Docker on port 3000. Needs Docker Desktop.' }
];

const file = () => path.join(dataDir(), 'ollama-harness.json');
const snapDir = () => path.join(dataDir(), 'ollama-snapshots');
function load() { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return { profiles: [], lastUsed: {} }; } }
function save(state) { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(state, null, 2)); }

function checkArgs(args) {
  if (!Array.isArray(args) || args.length > 40) throw new Error('A profile has at most 40 arguments.');
  return args.map((a) => {
    if (typeof a !== 'string' || !a.length || a.length > 300 || /[\r\n\0]/.test(a)) throw new Error('Each argument is one line of at most 300 characters.');
    const left = a.replace(PLACEHOLDER, '');
    if (/\{[A-Za-z_]+\}/.test(left)) throw new Error('Only {model} and {host} can be filled in.');
    return a;
  });
}
function checkProgram(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p)) throw new Error('Choose the program with the file picker.');
  const st = fs.statSync(p, { throwIfNoEntry: false });
  if (!st || !st.isFile()) throw new Error('That program does not exist any more.');
  // Script files would run through a shell interpreter; only real programs are allowed.
  if (process.platform === 'win32' ? !/\.exe$/i.test(p) : /\.(sh|bash|zsh|py|js|rb|pl)$/i.test(p)) throw new Error('Choose a program (.exe on Windows), not a script.');
  return p;
}

function list() {
  const st = load();
  const builtins = BUILTIN.map((b) => { const exe = b.find(); return { id: b.id, name: b.name, builtin: true, program: exe, found: !!exe, args: b.args, needsFolder: b.needsFolder, env: b.env, about: b.about }; });
  const custom = st.profiles.map((p) => ({ ...p, builtin: false, found: !!fs.statSync(p.program, { throwIfNoEntry: false })?.isFile() }));
  return { profiles: [...builtins, ...custom], lastUsed: st.lastUsed || {} };
}
function addProfile(spec) {
  const name = String(spec?.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Give the profile a name.');
  const p = { id: 'custom-' + crypto.randomUUID().slice(0, 8), name, program: checkProgram(spec.program), args: checkArgs(spec.args || []), needsFolder: !!spec.needsFolder, env: (spec.env || []).filter((k) => k in ENV_KEYS), about: String(spec.about || '').slice(0, 200) };
  const st = load(); st.profiles.push(p); save(st);
  return list();
}
function removeProfile(id) { const st = load(); st.profiles = st.profiles.filter((p) => p.id !== id); save(st); return list(); }

function resolve(id) {
  const b = BUILTIN.find((x) => x.id === id);
  if (b) return { ...b, program: b.find() };
  const c = load().profiles.find((x) => x.id === id);
  if (!c) throw new Error('That profile does not exist.');
  return { ...c, console: true, health: 'alive' };
}
/** Everything that will happen, and every reason it cannot, before anything starts. */
async function preflight({ id, model, folder }) {
  const p = resolve(id);
  const checks = [];
  const rt = await ollama.runtime();
  checks.push({ ok: rt.state === 'healthy', what: `Ollama answers on ${HOST}`, fix: rt.state === 'healthy' ? null : 'Start Ollama on the Models tab.' });
  let installed = [];
  if (rt.state === 'healthy') { try { installed = ((await ollama.call('tags')).models || []).map((m) => m.name); } catch { /* listed below */ } }
  checks.push({ ok: !!model && installed.includes(model), what: `Model ${model || '(none chosen)'} is installed`, fix: 'Download it on the Store tab, or pick an installed model.' });
  checks.push({ ok: !!p.program, what: `${p.name} is installed`, fix: p.program ? null : p.about });
  if (p.needsFolder) checks.push({ ok: !!folder && fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory(), what: 'A working folder is chosen', fix: 'Choose the folder to work in.' });
  const args = p.args.map((a) => a.replace(PLACEHOLDER, (_m, k) => (k === 'model' ? model || '' : HOST)));
  const env = Object.fromEntries(p.env.map((k) => [k, ENV_KEYS[k]]));
  return { ok: checks.every((c) => c.ok), checks, preview: { program: p.program, args, folder: p.needsFolder ? folder : null, env, health: p.health } };
}

function snapshot(reason) {
  fs.mkdirSync(snapDir(), { recursive: true });
  const at = new Date().toISOString();
  const f = path.join(snapDir(), at.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(f, JSON.stringify({ at, reason, profiles: load(), ollama: { endpoint: HOST, OLLAMA_MODELS: process.env.OLLAMA_MODELS ? 'set' : 'default' } }, null, 2));
  return path.basename(f);
}
function snapshots() { try { return fs.readdirSync(snapDir()).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 50).map((f) => { const j = JSON.parse(fs.readFileSync(path.join(snapDir(), f), 'utf8')); return { file: f, at: j.at, reason: j.reason, profiles: j.profiles.profiles.length }; }); } catch { return []; } }
function restore(name) {
  if (!/^[0-9TZ-]+\.json$/.test(name)) throw new Error('That is not a snapshot.');
  const j = JSON.parse(fs.readFileSync(path.join(snapDir(), name), 'utf8'));
  save(j.profiles);
  return list();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function launch({ id, model, folder }) {
  const pf = await preflight({ id, model, folder });
  if (!pf.ok) { const e = new Error('Some checks failed: ' + pf.checks.filter((c) => !c.ok).map((c) => c.what).join('; ')); e.code = 'PREFLIGHT'; throw e; }
  const snap = snapshot(`Before launching ${id} with ${model}`);
  const st = load(); st.lastUsed = { ...st.lastUsed, [id]: { model, folder: folder || null, at: new Date().toISOString() } }; save(st);
  const p = resolve(id);
  const rollback = (why) => { restore(snap); const e = new Error(`${why} The profiles were put back as they were before the launch.`); e.code = 'ROLLED_BACK'; return e; };
  let child;
  try {
    child = spawn(pf.preview.program, pf.preview.args, { cwd: pf.preview.folder || undefined, env: { ...process.env, ...pf.preview.env }, detached: true, stdio: 'ignore', windowsHide: !p.console, shell: false });
  } catch (e) { throw rollback(`The program could not start: ${e.message}.`); }
  let exited = null;
  child.on('exit', (code) => { exited = code; });
  child.on('error', (e) => { exited = e.message; });
  if (pf.preview.health === 'alive') {
    await wait(2500);
    if (exited !== null) throw rollback(`The program stopped straight away (${exited}).`);
    child.unref();
    return { started: true, pid: child.pid, snapshot: snap, health: 'running after 2.5 seconds' };
  }
  // A container launcher exits once the container runs; then the address must answer.
  const deadline = Date.now() + 90000;
  while (exited === null && Date.now() < deadline) await wait(500);
  if (exited === null) throw rollback('The launcher did not finish within 90 seconds.');
  if (exited !== 0) throw rollback(`The launcher exited with ${exited}.`);
  while (Date.now() < deadline) {
    try { const r = await fetch(pf.preview.health, { signal: AbortSignal.timeout(3000) }); if (r.ok || r.status < 500) return { started: true, snapshot: snap, health: `${pf.preview.health} answered` }; } catch { /* not yet */ }
    await wait(2000);
  }
  throw rollback(`${pf.preview.health} did not answer within 90 seconds.`);
}

module.exports = { setup, list, addProfile, removeProfile, preflight, launch, snapshots, restore, checkArgs, checkProgram, ENV_KEYS };
