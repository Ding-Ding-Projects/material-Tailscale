// Extension host. Extensions add actions to devices (peer.action) and checks to Diagnostics
// (status.check). Each lives in its own folder with a manifest.json and runs out of process:
// one JSON request on standard input, one JSON answer on standard output.
//
// What the app enforces: an extension runs only after you allowed exactly the permissions its
// current version asks for; it receives only the fields those permissions name (never keys,
// tokens, e-mail addresses or vault contents); it is stopped after five seconds; an answer
// larger than 64 KiB, malformed, or asking for something it has no permission for is refused.
// What the app cannot enforce: an extension is a program running as you, so nothing stops it
// from reading your files or using the network on its own. The manager says so.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const API = require('../shared/extension-api.js');

const ID = /^[a-z0-9][a-z0-9.-]{1,62}$/;
const ACTION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
const MANIFEST_FIELDS = ['manifestVersion', 'id', 'name', 'version', 'apiVersion', 'description', 'author', 'homepage', 'run', 'actions', 'permissions'];
const ACTION_FIELDS = ['id', 'hook', 'title', 'icon', 'description'];
const ANSWER_FIELDS = ['ok', 'message', 'copy', 'openUrl', 'checks'];

const chars = (s) => [...s].length;
const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && chars(v) <= max;
const isLocalized = (v, max) => isText(v, max) || (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k === 'en' || k === 'yue') && isText(v.en, max) && (v.yue === undefined || isText(v.yue, max)));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isSafeScript = (p) => typeof p === 'string' && p.length <= 200 && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..') && /\.(c|m)?js$/.test(p);

/** Checks a manifest. Returns { ok: true, manifest } or { ok: false, errors: [...] } in plain words. */
function validateManifest(m, folder) {
  if (!isPlainObject(m)) return { ok: false, errors: ['The manifest is not a JSON object.'] };
  const errors = [];
  for (const k of Object.keys(m)) if (!MANIFEST_FIELDS.includes(k)) errors.push(`Unknown field "${k}".`);
  if (m.manifestVersion !== API.MANIFEST_VERSION) errors.push(`manifestVersion must be ${API.MANIFEST_VERSION}.`);
  if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push('id must be 2 to 63 lowercase letters, digits, dots or hyphens, starting with a letter or digit.');
  else if (folder && m.id !== folder) errors.push(`id "${m.id}" must match its folder name "${folder}".`);
  if (!isLocalized(m.name, 60)) errors.push('name must be text of up to 60 characters, or { "en": ..., "yue": ... }.');
  if (typeof m.version !== 'string' || !VERSION.test(m.version)) errors.push('version must look like 1.0.0.');
  if (m.apiVersion !== API.API_VERSION) errors.push(`apiVersion must be ${API.API_VERSION}: this app speaks version ${API.API_VERSION} of the extension protocol.`);
  if (!isLocalized(m.description, 300)) errors.push('description must be text of up to 300 characters, or { "en": ..., "yue": ... }.');
  if (m.author !== undefined && !isText(m.author, 80)) errors.push('author must be text of up to 80 characters.');
  if (m.homepage !== undefined && !(typeof m.homepage === 'string' && /^https:\/\/\S{1,200}$/.test(m.homepage))) errors.push('homepage must be an https link.');

  const r = m.run;
  if (!isPlainObject(r) || Object.keys(r).length !== 1 || !['script', 'command'].includes(Object.keys(r)[0])) errors.push('run must have exactly one of "script" (a JavaScript file run by the app\'s own runtime) or "command" (a program and its arguments).');
  else if (r.script !== undefined && !isSafeScript(r.script)) errors.push('run.script must be a .js, .mjs or .cjs file inside the extension folder.');
  else if (r.command !== undefined && !(Array.isArray(r.command) && r.command.length >= 1 && r.command.length <= 16 && r.command.every((a) => typeof a === 'string' && a.length > 0 && a.length <= 260))) errors.push('run.command must be a list of 1 to 16 strings: the program, then its arguments.');

  const perms = m.permissions;
  if (!Array.isArray(perms) || perms.length > Object.keys(API.PERMISSIONS).length || new Set(perms).size !== perms.length || !perms.every((p) => Object.hasOwn(API.PERMISSIONS, p))) {
    errors.push(`permissions must be a list without repeats from: ${Object.keys(API.PERMISSIONS).join(', ')}.`);
  }

  if (!Array.isArray(m.actions) || m.actions.length < 1 || m.actions.length > 12) errors.push('actions must list 1 to 12 actions.');
  else {
    const seen = new Set();
    m.actions.forEach((a, i) => {
      if (!isPlainObject(a)) { errors.push(`actions[${i}] is not an object.`); return; }
      for (const k of Object.keys(a)) if (!ACTION_FIELDS.includes(k)) errors.push(`actions[${i}]: unknown field "${k}".`);
      if (typeof a.id !== 'string' || !ACTION_ID.test(a.id) || seen.has(a.id)) errors.push(`actions[${i}].id must be unique: lowercase letters, digits or hyphens, up to 40.`);
      else seen.add(a.id);
      if (!Object.hasOwn(API.HOOKS, a.hook)) errors.push(`actions[${i}].hook must be one of: ${Object.keys(API.HOOKS).join(', ')}.`);
      else if (Array.isArray(perms)) for (const need of API.HOOKS[a.hook].needs) if (!perms.includes(need)) errors.push(`actions[${i}]: the ${a.hook} hook needs the "${need}" permission.`);
      if (!isLocalized(a.title, 60)) errors.push(`actions[${i}].title must be text of up to 60 characters, or { "en": ..., "yue": ... }.`);
      if (a.icon !== undefined && !(typeof a.icon === 'string' && /^[a-z0-9_]{1,40}$/.test(a.icon))) errors.push(`actions[${i}].icon must be a Material Symbols name such as "terminal".`);
      if (a.description !== undefined && !isLocalized(a.description, 200)) errors.push(`actions[${i}].description must be text of up to 200 characters.`);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, manifest: m };
}

/** What consent covers: the version, the permissions and the program that runs. */
function fingerprint(m) {
  return crypto.createHash('sha256').update(JSON.stringify({ version: m.version, permissions: [...m.permissions].sort(), run: m.run })).digest('hex').slice(0, 32);
}

// ---------- what an extension may see ----------
const str = (v, max = 253) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const addrs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 64).slice(0, 8) : []);
const noDot = (v) => str(v)?.replace(/\.$/, '');

/** One device, by allow-list: keys, owners and public endpoints never pass. */
function pickPeer(p) {
  if (!isPlainObject(p)) throw new Error('No device was given to the extension.');
  return {
    name: str(p.HostName),
    dnsName: noDot(p.DNSName),
    addresses: addrs(p.TailscaleIPs),
    os: str(p.OS, 40),
    online: !!p.Online,
    tags: Array.isArray(p.Tags) ? p.Tags.filter((t) => typeof t === 'string' && t.length <= 100).slice(0, 32) : [],
    lastSeen: str(p.LastSeen, 40),
    offersExitNode: !!p.ExitNodeOption,
    isExitNode: !!p.ExitNode
  };
}

/** A summary of this device and the tailnet, by allow-list. */
function pickStatus(s) {
  if (!isPlainObject(s)) throw new Error('Tailscale status is not available yet.');
  const self = isPlainObject(s.Self) ? s.Self : {};
  const peers = isPlainObject(s.Peer) ? Object.values(s.Peer).filter(isPlainObject) : [];
  const exit = peers.find((p) => p.ExitNode);
  return {
    version: str(s.Version, 60),
    state: str(s.BackendState, 40),
    magicDnsSuffix: str(s.MagicDNSSuffix),
    self: { name: str(self.HostName), dnsName: noDot(self.DNSName), addresses: addrs(self.TailscaleIPs), os: str(self.OS, 40), online: !!self.Online, keyExpiry: str(self.KeyExpiry, 40) },
    exitNode: exit ? { name: str(exit.HostName), dnsName: noDot(exit.DNSName) } : null,
    devices: { total: peers.length, online: peers.filter((p) => p.Online).length },
    health: Array.isArray(s.Health) ? s.Health.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 300)) : []
  };
}

/** The request an action receives. Data is included only when the permission is held. */
function buildRequest(manifest, action, context = {}) {
  const has = (p) => manifest.permissions.includes(p);
  const req = { protocol: 'material-tailscale.extension', apiVersion: API.API_VERSION, hook: action.hook, action: action.id, language: ['en', 'yue', 'both'].includes(context.language) ? context.language : 'en' };
  if (action.hook === 'peer.action') {
    if (!has('peer-details')) throw new Error('This action needs the peer-details permission.');
    req.peer = pickPeer(context.peer);
  }
  if (action.hook === 'status.check') {
    if (!has('tailnet-status')) throw new Error('This action needs the tailnet-status permission.');
    req.status = pickStatus(context.status);
  }
  return req;
}

/** Checks an answer against the protocol and the extension's permissions. Throws in plain words. */
function validateAnswer(a, { hook, permissions }) {
  const L = API.LIMITS;
  if (!isPlainObject(a)) throw new Error('Its answer is not a JSON object.');
  for (const k of Object.keys(a)) if (!ANSWER_FIELDS.includes(k)) throw new Error(`Its answer has an unknown field "${k}".`);
  if (typeof a.ok !== 'boolean') throw new Error('Its answer must say "ok": true or false.');
  if (a.message !== undefined && !(typeof a.message === 'string' && chars(a.message) <= L.message)) throw new Error(`Its message must be text of up to ${L.message} characters.`);
  if (a.copy !== undefined) {
    if (!permissions.includes('clipboard')) throw new Error('Its answer asked to copy text, but it does not have the clipboard permission.');
    if (typeof a.copy !== 'string' || !a.copy.length || chars(a.copy) > L.copy) throw new Error(`Text to copy must be 1 to ${L.copy} characters.`);
  }
  if (a.openUrl !== undefined) {
    if (!permissions.includes('open-url')) throw new Error('Its answer asked to open a link, but it does not have the open-url permission.');
    let u = null;
    try { u = new URL(a.openUrl); } catch { /* checked below */ }
    if (typeof a.openUrl !== 'string' || a.openUrl.length > L.url || !u || !['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('A link to open must be an http or https address without a user name or password in it.');
  }
  if (a.checks !== undefined) {
    if (hook !== 'status.check') throw new Error('Only checks for Diagnostics may answer with "checks".');
    if (!Array.isArray(a.checks) || a.checks.length > L.checks) throw new Error(`"checks" must be a list of up to ${L.checks}.`);
    a.checks.forEach((c, i) => {
      if (!isPlainObject(c)) throw new Error(`checks[${i}] is not an object.`);
      for (const k of Object.keys(c)) if (!['title', 'state', 'detail'].includes(k)) throw new Error(`checks[${i}] has an unknown field "${k}".`);
      if (!isText(c.title, L.checkTitle)) throw new Error(`checks[${i}].title must be text of up to ${L.checkTitle} characters.`);
      if (!API.CHECK_STATES.includes(c.state)) throw new Error(`checks[${i}].state must be one of ${API.CHECK_STATES.join(', ')}.`);
      if (c.detail !== undefined && !(typeof c.detail === 'string' && chars(c.detail) <= L.checkDetail)) throw new Error(`checks[${i}].detail must be text of up to ${L.checkDetail} characters.`);
    });
  }
  return a;
}

// ---------- running ----------
// The environment an extension starts with: enough to find programs and a temp folder, and
// nothing that might hold a token.
const ENV_KEEP = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL'];
function baseEnv() {
  const env = {};
  for (const k of ENV_KEEP) if (process.env[k] !== undefined) env[k] = process.env[k];
  env.MT_EXTENSION_API = String(API.API_VERSION);
  return env;
}

/** Starts the program, sends the request, and resolves with { ok, answer } or { ok: false, error, code }. */
function runProcess({ dir, run, request, execPath = process.execPath, timeoutMs = API.LIMITS.timeoutMs, maxBytes = API.LIMITS.answerBytes }) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const env = baseEnv();
    let cmd, args;
    if (run.script) { cmd = execPath; args = [path.join(dir, run.script)]; env.ELECTRON_RUN_AS_NODE = '1'; }
    else { [cmd, ...args] = run.command; }
    let child, done = false, size = 0, timer = null;
    const out = [];
    let err = '';
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); resolve({ ...r, ms: Date.now() - t0 }); };
    try { child = spawn(cmd, args, { cwd: dir, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false }); }
    catch (e) { finish({ ok: false, code: 'start', error: `It could not start: ${e.message}` }); return; }
    timer = setTimeout(() => { child.kill(); finish({ ok: false, code: 'timeout', error: `It did not answer within ${timeoutMs / 1000} seconds, so it was stopped.` }); }, timeoutMs);
    child.stdout.on('data', (d) => {
      size += d.length;
      if (size > maxBytes) { child.kill(); finish({ ok: false, code: 'too-large', error: `Its answer was larger than ${Math.round(maxBytes / 1024)} KiB, so it was refused.` }); return; }
      out.push(d);
    });
    child.stderr.on('data', (d) => { if (err.length < 2000) err += d.toString('utf8'); });
    child.on('error', (e) => finish({ ok: false, code: 'start', error: `It could not start: ${e.message}` }));
    child.on('close', (code) => {
      if (code !== 0) { const why = err.trim().split(/\r?\n/)[0]; finish({ ok: false, code: 'exit', error: `It stopped with exit code ${code}${why ? `: ${why.slice(0, 300)}` : ''}.` }); return; }
      let answer;
      // A byte-order mark is tolerated: Windows PowerShell writes one with some encodings.
      try { answer = JSON.parse(Buffer.concat(out).toString('utf8').replace(/^\uFEFF/, '')); } catch { finish({ ok: false, code: 'bad-answer', error: 'Its answer was not valid JSON.' }); return; }
      finish({ ok: true, answer });
    });
    child.stdin.on('error', () => { /* the program closed its input early; its answer still counts */ });
    child.stdin.end(JSON.stringify(request));
  });
}

// ---------- folders ----------
function hashFolder(dir) {
  const h = crypto.createHash('sha256');
  const walk = (d, rel) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name), r = rel ? `${rel}/${name}` : name;
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p, r);
      else if (st.isFile()) h.update(r).update('\0').update(fs.readFileSync(p)).update('\0');
    }
  };
  walk(dir, '');
  return h.digest('hex').slice(0, 32);
}

function measureFolder(dir) {
  let bytes = 0, files = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) throw new Error('Extension folders cannot contain links to other places.');
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { files++; bytes += fs.statSync(p).size; }
      if (files > API.LIMITS.folderFiles || bytes > API.LIMITS.folderBytes) throw new Error(`An extension folder can hold at most ${API.LIMITS.folderFiles} files and ${API.LIMITS.folderBytes / 1024 / 1024} MB.`);
    }
  };
  walk(dir);
  return { bytes, files };
}

// A plain recursive copy that also reads from inside the packaged app archive.
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name), to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.writeFileSync(to, fs.readFileSync(from));
  }
}

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return { ok: false, errors: ['There is no manifest.json in this folder.'] };
  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { ok: false, errors: [`manifest.json is not valid JSON: ${e.message}`] }; }
  return validateManifest(m, path.basename(dir));
}

// ---------- host ----------
function createHost({ dir, statePath, builtinDir, execPath = process.execPath, timeoutMs, maxBytes }) {
  let state = { masterOff: false, grants: {}, builtIns: {}, runs: {} };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(statePath, 'utf8')) }; } catch { /* first run */ }
  const save = () => { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); };
  const folderOf = (id) => {
    if (typeof id !== 'string' || !ID.test(id)) throw new Error('That is not an extension id.');
    return path.join(dir, id);
  };

  /** Copies the extensions that ship with the app, and updates them only while unmodified. */
  function installBuiltins() {
    if (!builtinDir || !fs.existsSync(builtinDir)) return;
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(builtinDir)) {
      if (!ID.test(name) || !fs.statSync(path.join(builtinDir, name)).isDirectory()) continue;
      const e = { name };
      const src = path.join(builtinDir, name), dest = path.join(dir, name);
      const shipped = hashFolder(src);
      const rec = state.builtIns[e.name];
      if (!rec) {
        if (fs.existsSync(dest)) continue; // a folder of yours with the same name stays yours
        copyDir(src, dest);
        state.builtIns[e.name] = { hash: shipped };
      } else if (rec.removed) {
        continue; // you removed it; it stays removed
      } else if (!fs.existsSync(dest)) {
        rec.removed = true;
      } else if (rec.hash !== shipped && hashFolder(dest) === rec.hash) {
        fs.rmSync(dest, { recursive: true, force: true });
        copyDir(src, dest);
        rec.hash = shipped;
      }
    }
    save();
  }

  function consentOf(id, m) {
    const g = state.grants[id];
    if (!g) return { consent: 'needed' };
    if (g.fingerprint === fingerprint(m)) return { consent: 'granted', enabled: !!g.enabled };
    const added = m.permissions.filter((p) => !g.permissions.includes(p));
    const dropped = g.permissions.filter((p) => !m.permissions.includes(p));
    return { consent: 'changed', was: { version: g.version, permissions: g.permissions }, added, dropped };
  }

  function list() {
    const items = [];
    if (fs.existsSync(dir)) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const folder = path.join(dir, e.name);
        const r = readManifest(folder);
        const rec = state.builtIns[e.name];
        const builtIn = !!rec && !rec.removed;
        const item = { id: e.name, folder, builtIn, modified: builtIn && hashFolder(folder) !== rec.hash, runs: state.runs[e.name] || [] };
        if (!r.ok) { items.push({ ...item, valid: false, errors: r.errors, enabled: false, consent: 'invalid' }); continue; }
        const c = consentOf(e.name, r.manifest);
        items.push({ ...item, valid: true, manifest: r.manifest, fingerprint: fingerprint(r.manifest), ...c, enabled: !state.masterOff && c.consent === 'granted' && !!c.enabled });
      }
    }
    items.sort((a, b) => a.id.localeCompare(b.id));
    return { masterOff: !!state.masterOff, folder: dir, api: API.API_VERSION, items };
  }

  /** Records consent for exactly what the current version asks for, and turns it on. */
  function allow(id, fp) {
    const r = readManifest(folderOf(id));
    if (!r.ok) throw new Error('This extension has manifest errors, so it cannot be turned on.');
    if (fingerprint(r.manifest) !== fp) throw new Error('The extension changed while you were reviewing it. Review it again.');
    state.grants[id] = { fingerprint: fp, version: r.manifest.version, permissions: [...r.manifest.permissions], enabled: true, at: new Date().toISOString() };
    save();
    return list();
  }

  function setEnabled(id, on) {
    const g = state.grants[id];
    if (!g) throw new Error('Allow this extension first.');
    g.enabled = !!on;
    save();
    return list();
  }

  function setMasterOff(off) { state.masterOff = !!off; save(); return list(); }

  function remove(id) {
    fs.rmSync(folderOf(id), { recursive: true, force: true });
    delete state.grants[id];
    delete state.runs[id];
    if (state.builtIns[id]) state.builtIns[id].removed = true;
    save();
    return list();
  }

  /** Adds or replaces an extension from a folder. A different version is replaced only with replace: true. */
  function addFromFolder(src, { replace = false } = {}) {
    if (typeof src !== 'string' || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) throw new Error('Choose a folder that holds an extension.');
    const file = path.join(src, 'manifest.json');
    if (!fs.existsSync(file)) throw new Error('That folder has no manifest.json.');
    let m;
    try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`manifest.json is not valid JSON: ${e.message}`); }
    const v = validateManifest(m);
    if (!v.ok) { const e = new Error(`The manifest has problems: ${v.errors.join(' ')}`); e.code = 'invalid'; throw e; }
    measureFolder(src);
    const dest = folderOf(m.id);
    if (path.resolve(src) === path.resolve(dest)) return { added: m.id, list: list() };
    if (fs.existsSync(dest)) {
      const old = readManifest(dest);
      const oldVersion = old.ok ? old.manifest.version : null;
      if (oldVersion !== m.version && !replace) return { confirm: true, id: m.id, from: oldVersion, to: m.version };
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
    copyDir(src, dest);
    if (state.builtIns[m.id]) state.builtIns[m.id].removed = true; // your copy now; the app no longer updates it
    save();
    return { added: m.id, list: list() };
  }

  async function run(id, actionId, context = {}) {
    if (state.masterOff) throw new Error('Extensions are turned off in the extensions manager.');
    const folder = folderOf(id);
    const r = readManifest(folder);
    if (!r.ok) throw new Error('This extension has manifest errors.');
    const c = consentOf(id, r.manifest);
    if (c.consent !== 'granted') throw new Error(c.consent === 'changed' ? 'This extension changed what it asks for. Review it in the extensions manager.' : 'This extension has not been allowed yet.');
    if (!c.enabled) throw new Error('This extension is turned off.');
    const action = r.manifest.actions.find((a) => a.id === actionId);
    if (!action) throw new Error('This extension has no such action.');
    const request = buildRequest(r.manifest, action, context);
    const res = await runProcess({ dir: folder, run: r.manifest.run, request, execPath, timeoutMs, maxBytes });
    let out = res;
    if (res.ok) {
      try { out = { ok: true, answer: validateAnswer(res.answer, { hook: action.hook, permissions: r.manifest.permissions }), ms: res.ms }; }
      catch (e) { out = { ok: false, code: 'refused', error: e.message, ms: res.ms }; }
    }
    const log = state.runs[id] || (state.runs[id] = []);
    log.unshift({ at: new Date().toISOString(), action: actionId, ok: out.ok && out.answer.ok !== false, ms: out.ms, error: out.ok ? (out.answer.ok === false ? out.answer.message || 'It reported a failure.' : undefined) : out.error });
    log.length = Math.min(log.length, API.LIMITS.runsKept);
    save();
    return out;
  }

  return { list, allow, setEnabled, setMasterOff, remove, addFromFolder, run, installBuiltins, folder: dir };
}

module.exports = { validateManifest, fingerprint, pickPeer, pickStatus, buildRequest, validateAnswer, runProcess, hashFolder, createHost, baseEnv };
