'use strict';
// Main-process half of the Ollama suite. It is the only code that talks to Ollama's local HTTP
// API: one fixed loopback address, an allowlist of documented endpoints, validated request
// bodies and bounded responses. It also owns the runtime process it starts, reads hardware facts
// for the fit check, keeps the ollama.com catalogue with every tag, runs the durable download
// queue and stores chat conversations on this computer.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { parseLibrary, parseTags } = require('../shared/ollama-catalog.js');

const BASE = 'http://127.0.0.1:11434';
const LIBRARY = 'https://ollama.com/library';
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}){0,2}(:[A-Za-z0-9._-]{1,128})?$/;
const KB = 1024, MB = KB * 1024;

let dataDir = () => path.join(os.tmpdir(), 'mt-ollama');
let emit = () => {};
function setup({ userData, send }) { dataDir = typeof userData === 'function' ? userData : () => userData; emit = send; }

// ---------------- allowlisted local API ----------------
const API = {
  version: ['GET', '/api/version'], tags: ['GET', '/api/tags'], ps: ['GET', '/api/ps'],
  show: ['POST', '/api/show'], delete: ['DELETE', '/api/delete'], copy: ['POST', '/api/copy'],
  generate: ['POST', '/api/generate'], pull: ['POST', '/api/pull'], create: ['POST', '/api/create'], chat: ['POST', '/api/chat']
};
const STREAMING = new Set(['pull', 'create', 'chat']);
const PARAMS = { temperature: [0, 2], top_p: [0, 1], top_k: [1, 1000], num_ctx: [256, 1048576], seed: [0, 2 ** 31 - 1], repeat_penalty: [0.5, 2], num_predict: [-2, 131072] };

const needName = (v, what = 'model') => { if (typeof v !== 'string' || !NAME.test(v) || v.includes('..')) throw new Error(`That is not a valid ${what} name.`); return v; };
function cleanOptions(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (!(k in PARAMS)) throw new Error(`The setting ${k} is not one Ollama documents.`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < PARAMS[k][0] || n > PARAMS[k][1]) throw new Error(`${k} must be between ${PARAMS[k][0]} and ${PARAMS[k][1]}.`);
    out[k] = n;
  }
  return out;
}
/** Checks a request body against the documented fields for that endpoint and returns a clean copy. */
function validate(op, body = {}) {
  if (!(op in API)) throw new Error(`${op} is not an allowed Ollama operation.`);
  const b = body || {};
  switch (op) {
    case 'version': case 'tags': case 'ps': return undefined;
    case 'show': case 'delete': return { model: needName(b.model) };
    case 'copy': return { source: needName(b.source), destination: needName(b.destination, 'new model') };
    case 'pull': return { model: needName(b.model), stream: true };
    case 'generate': {
      // Only used to load a model (keep it in memory) or unload it (keep_alive 0).
      const keep = b.keep_alive === 0 ? 0 : typeof b.keep_alive === 'string' && /^\d{1,4}[smh]$/.test(b.keep_alive) ? b.keep_alive : null;
      if (keep === null) throw new Error('keep_alive must be 0 or a duration such as 5m.');
      return { model: needName(b.model), keep_alive: keep, stream: false };
    }
    case 'create': {
      const out = { model: needName(b.model, 'new model'), from: needName(b.from, 'base model'), stream: true };
      if (b.system !== undefined) { if (typeof b.system !== 'string' || b.system.length > 16 * KB) throw new Error('The system prompt must be text of at most 16 KB.'); out.system = b.system; }
      if (b.template !== undefined) { if (typeof b.template !== 'string' || b.template.length > 16 * KB) throw new Error('The template must be text of at most 16 KB.'); out.template = b.template; }
      if (b.parameters) out.parameters = cleanOptions(b.parameters);
      return out;
    }
    case 'chat': {
      if (!Array.isArray(b.messages) || !b.messages.length || b.messages.length > 400) throw new Error('A chat needs between 1 and 400 messages.');
      let bytes = 0;
      const messages = b.messages.map((m) => {
        if (!['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') throw new Error('Each message needs a role and text.');
        bytes += m.content.length;
        const out = { role: m.role, content: m.content };
        if (m.images) {
          if (!Array.isArray(m.images) || m.images.length > 4) throw new Error('At most four images per message.');
          out.images = m.images.map((x) => { if (typeof x !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(x) || x.length > 14 * MB) throw new Error('Each image must be Base64 and at most 10 MB.'); bytes += x.length; return x; });
        }
        return out;
      });
      if (bytes > 48 * MB) throw new Error('The conversation is too large to send; start a new one.');
      return { model: needName(b.model), messages, stream: true, ...(b.options ? { options: cleanOptions(b.options) } : {}) };
    }
  }
  throw new Error(`${op} is not an allowed Ollama operation.`);
}

async function readBounded(res, limit) {
  const reader = res.body.getReader(); const chunks = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > limit) { reader.cancel(); throw new Error(`Ollama sent more than ${Math.round(limit / MB)} MB, so the answer was not used.`); } chunks.push(value); }
  return Buffer.concat(chunks).toString('utf8');
}
/** One request to the local API. Returns the parsed JSON (or null for an empty body). */
async function call(op, body, { timeout = 15000 } = {}) {
  if (STREAMING.has(op)) throw new Error(`${op} streams its answer; use stream().`);
  const clean = validate(op, body);
  const [method, p] = API[op];
  const res = await fetch(BASE + p, { method, body: clean ? JSON.stringify(clean) : undefined, headers: clean ? { 'Content-Type': 'application/json' } : undefined, signal: AbortSignal.timeout(timeout) });
  const txt = await readBounded(res, 8 * MB);
  let json = null;
  if (txt.trim()) { try { json = JSON.parse(txt); } catch { throw new Error('Ollama answered with something that is not JSON.'); } }
  if (!res.ok) throw new Error(json?.error || `Ollama answered HTTP ${res.status}.`);
  return json;
}

const running = new Map(); // stream id -> AbortController
/** A streaming request; every line Ollama sends goes to onLine. Resolves with the last line. */
async function stream(op, body, id, onLine) {
  if (!STREAMING.has(op)) throw new Error(`${op} does not stream.`);
  const clean = validate(op, body);
  const ctl = new AbortController();
  running.set(id, ctl);
  try {
    const res = await fetch(BASE + API[op][1], { method: 'POST', body: JSON.stringify(clean), headers: { 'Content-Type': 'application/json' }, signal: ctl.signal });
    if (!res.ok) { const t = await readBounded(res, MB).catch(() => ''); let e; try { e = JSON.parse(t).error; } catch { e = null; } throw new Error(e || `Ollama answered HTTP ${res.status}.`); }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', last = null, lines = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.length > 4 * MB) throw new Error('Ollama sent a line longer than 4 MB.');
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        let j; try { j = JSON.parse(line); } catch { throw new Error('Ollama sent a line that is not JSON.'); }
        if (j.error) throw new Error(j.error);
        last = j; lines++;
        if (lines > 2_000_000) throw new Error('Ollama kept streaming past two million lines, so the request was stopped.');
        onLine?.(j);
      }
    }
    return last;
  } catch (e) {
    if (ctl.signal.aborted) { const err = new Error('Stopped.'); err.code = 'CANCELLED'; throw err; }
    throw e;
  } finally { running.delete(id); }
}
function cancel(id) { const c = running.get(id); if (c) c.abort(); return !!c; }

// ---------------- runtime ----------------
function onPath(name) {
  const exts = process.platform === 'win32' ? ['.exe'] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) for (const e of exts) { const p = path.join(dir, name + e); try { if (fs.statSync(p).isFile()) return p; } catch { /* next */ } }
  return null;
}
function binary() {
  const cands = process.platform === 'win32'
    ? [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'), process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Ollama', 'ollama.exe')]
    : process.platform === 'darwin' ? ['/Applications/Ollama.app/Contents/Resources/ollama', '/opt/homebrew/bin/ollama', '/usr/local/bin/ollama'] : ['/usr/local/bin/ollama', '/usr/bin/ollama'];
  for (const c of cands.filter(Boolean)) { try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ } }
  return onPath('ollama');
}
let owned = null; // the ollama serve process this app started, if any
async function runtime() {
  try {
    const v = await call('version', null, { timeout: 1500 });
    return { state: 'healthy', version: v?.version || null, owned: !!owned, endpoint: BASE, binary: binary() };
  } catch (e) {
    const bin = binary();
    const refused = /fetch failed|ECONNREFUSED|timeout|aborted/i.test(String(e.cause?.code || e.message));
    return { state: refused ? (bin ? 'stopped' : 'missing') : 'unhealthy', error: refused ? null : e.message, owned: !!owned, endpoint: BASE, binary: bin };
  }
}
async function start() {
  const now = await runtime();
  if (now.state === 'healthy') return now;
  if (!now.binary) throw new Error('Ollama is not installed. Use "Install or repair Ollama" first.');
  owned = spawn(now.binary, ['serve'], { env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' }, windowsHide: true, stdio: 'ignore', detached: false });
  owned.on('exit', () => { owned = null; });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const r = await runtime();
    if (r.state === 'healthy') return r;
    if (!owned) break;
  }
  try { owned?.kill(); } catch { /* gone */ }
  owned = null;
  throw new Error('Ollama did not answer within 20 seconds of starting. Another program may be using port 11434.');
}
async function stop() {
  if (!owned) throw new Error('Ollama was started outside this app, so the app leaves it running. Stop it from its own tray icon or service.');
  const pid = owned.pid;
  if (process.platform === 'win32') await new Promise((r) => execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => r()));
  else owned.kill('SIGTERM');
  for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 500)); if ((await runtime()).state !== 'healthy') break; }
  owned = null;
  return runtime();
}

// ---------------- hardware facts ----------------
const run = (cmd, args, timeout = 4000) => new Promise((resolve) => execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: MB }, (err, out) => resolve(err ? null : String(out))));
function modelsDir() { return process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'); }
function freeSpace(p) {
  let dir = p;
  while (dir && !fs.existsSync(dir)) { const up = path.dirname(dir); if (up === dir) break; dir = up; }
  try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch { return null; }
}
async function hardware() {
  const ram = { total: os.totalmem(), free: os.freemem() };
  let gpu = { known: false, name: null, vram: null, free: null, driver: null, source: null, note: null };
  const smi = await run('nvidia-smi', ['--query-gpu=name,memory.total,memory.free,driver_version', '--format=csv,noheader,nounits']);
  if (smi && smi.trim()) {
    const [name, total, free, driver] = smi.trim().split(/\r?\n/)[0].split(',').map((x) => x.trim());
    gpu = { known: true, name, vram: Number(total) * MB, free: Number(free) * MB, driver, source: 'nvidia-smi', note: null };
  } else if (process.platform === 'darwin' && process.arch === 'arm64') {
    gpu = { known: true, name: 'Apple GPU', vram: Math.round(ram.total * 0.75), free: null, driver: null, source: 'unified memory', note: 'Shares system memory; about three quarters of it can hold a model.' };
  } else if (process.platform === 'win32') {
    const ps = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object -First 1 Name,DriverVersion | ConvertTo-Json -Compress'], 8000);
    try { const j = JSON.parse(ps); gpu = { known: false, name: j.Name, vram: null, free: null, driver: j.DriverVersion, source: 'Windows', note: 'Windows does not report this card\'s video memory reliably, so the fit check counts system memory only.' }; } catch { /* none */ }
  }
  const dir = modelsDir();
  return { ram, gpu, disk: { path: dir, free: freeSpace(dir) }, at: new Date().toISOString() };
}

// ---------------- catalogue: every model and every tag on ollama.com ----------------
const catFile = () => path.join(dataDir(), 'ollama-catalog.json');
function catalog() { try { return JSON.parse(fs.readFileSync(catFile(), 'utf8')); } catch { return null; } }
async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MaterialTailscale' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readBounded(res, 12 * MB);
}
let refreshing = null;
async function refreshCatalog(onProgress) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const hash = crypto.createHash('sha256');
    const lib = await fetchPage(LIBRARY);
    hash.update(lib);
    const models = parseLibrary(lib);
    if (!models.length) throw new Error('The ollama.com library page had no models in it; its layout may have changed, so the last catalogue is kept.');
    const failures = [];
    let done = 0, next = 0;
    const worker = async () => {
      while (next < models.length) {
        const m = models[next++];
        try { const html = await fetchPage(`${LIBRARY}/${encodeURIComponent(m.name).replace(/%2F/g, '/')}/tags`); hash.update(html); m.tags = parseTags(html, m.name); if (!m.tags.length) failures.push(m.name); }
        catch (e) { m.tags = []; failures.push(m.name); }
        done++;
        onProgress?.({ phase: `Reading tags: ${done} of ${models.length}`, got: done, total: models.length });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    const catalogue = {
      source: LIBRARY, fetchedAt: new Date().toISOString(), pages: models.length + 1, revision: hash.digest('hex').slice(0, 16),
      complete: failures.length === 0, failures, modelCount: models.length, tagCount: models.reduce((n, m) => n + m.tags.length, 0), models
    };
    // Only a complete refresh replaces the verified catalogue on disk.
    if (catalogue.complete || !catalog()) { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(catFile(), JSON.stringify(catalogue)); }
    return catalogue;
  })();
  try { return await refreshing; } finally { refreshing = null; }
}

// ---------------- durable download queue ----------------
const pullFile = () => path.join(dataDir(), 'ollama-pulls.json');
let pulls = { parallel: 2, items: [] };
let pullsLoaded = false;
const ensurePulls = () => { if (!pullsLoaded) { pullsLoaded = true; loadPulls(); } };
function loadPulls() {
  try { pulls = JSON.parse(fs.readFileSync(pullFile(), 'utf8')); } catch { pulls = { parallel: 2, items: [] }; }
  for (const it of pulls.items) if (it.state === 'running' || it.state === 'queued') { it.state = 'interrupted'; it.status = 'The app closed while this was downloading. Retry continues where it stopped.'; }
}
let saveTimer = null;
function savePulls(now = false) {
  const write = () => { saveTimer = null; try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(pullFile(), JSON.stringify(pulls)); } catch { /* reported by the next action */ } };
  if (now) { clearTimeout(saveTimer); write(); } else if (!saveTimer) saveTimer = setTimeout(write, 1000);
  // Progress lines arrive many times a second; the page hears about them at most four times a second.
  if (now) { clearTimeout(emitTimer); emitTimer = null; emit('ollama:pulls', pulls); } else if (!emitTimer) emitTimer = setTimeout(() => { emitTimer = null; emit('ollama:pulls', pulls); }, 250);
}
let emitTimer = null;
function pullState() { ensurePulls(); return pulls; }
function enqueue(tags) {
  ensurePulls();
  if (!Array.isArray(tags) || !tags.length || tags.length > 50) throw new Error('Add between 1 and 50 models at a time.');
  for (const t of tags) {
    needName(t);
    if (pulls.items.some((x) => x.tag === t && (x.state === 'queued' || x.state === 'running'))) continue;
    pulls.items.push({ id: crypto.randomUUID(), tag: t, state: 'queued', completed: 0, total: 0, status: 'Waiting', addedAt: new Date().toISOString() });
  }
  pulls.items = pulls.items.slice(-200);
  savePulls(true); pump();
  return pulls;
}
function pump() {
  while (pulls.items.filter((x) => x.state === 'running').length < pulls.parallel) {
    const it = pulls.items.find((x) => x.state === 'queued');
    if (!it) break;
    it.state = 'running'; it.status = 'Starting'; it.error = null;
    stream('pull', { model: it.tag }, 'pull:' + it.id, (j) => {
      it.status = j.status || it.status;
      if (j.total) { it.total = j.total; it.completed = j.completed || 0; }
      savePulls();
    }).then(() => { it.state = 'done'; it.status = 'Downloaded and verified by Ollama'; it.finishedAt = new Date().toISOString(); })
      .catch((e) => { it.state = e.code === 'CANCELLED' ? 'cancelled' : 'failed'; it.error = e.code === 'CANCELLED' ? null : e.message; it.status = e.code === 'CANCELLED' ? 'Cancelled' : 'Failed'; it.finishedAt = new Date().toISOString(); })
      .finally(() => { savePulls(true); pump(); });
  }
}
function cancelPull(id) { ensurePulls(); const it = pulls.items.find((x) => x.id === id); if (!it) return pulls; if (it.state === 'queued') { it.state = 'cancelled'; it.status = 'Cancelled'; savePulls(true); } else cancel('pull:' + id); return pulls; }
function retryPull(id) { ensurePulls(); const it = pulls.items.find((x) => x.id === id); if (it && ['failed', 'cancelled', 'interrupted'].includes(it.state)) { it.state = 'queued'; it.status = 'Waiting'; it.error = null; savePulls(true); pump(); } return pulls; }
function clearPulls() { ensurePulls(); pulls.items = pulls.items.filter((x) => x.state === 'queued' || x.state === 'running'); savePulls(true); return pulls; }
function setParallel(n) { ensurePulls(); pulls.parallel = Math.max(1, Math.min(3, Math.round(Number(n) || 1))); savePulls(true); pump(); return pulls; }

// ---------------- chat conversations, kept on this computer ----------------
const chatFile = () => path.join(dataDir(), 'ollama-chats.json');
function chats() { try { return JSON.parse(fs.readFileSync(chatFile(), 'utf8')); } catch { return { sessions: [] }; } }
function saveChat(s) {
  if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]{8,64}$/.test(s.id)) throw new Error('A conversation needs an id.');
  const clean = {
    id: s.id, title: String(s.title || 'New conversation').slice(0, 120), model: s.model ? needName(s.model) : null,
    system: String(s.system || '').slice(0, 16 * KB), options: cleanOptions(s.options || {}),
    // Images are not kept: only how many there were.
    messages: (s.messages || []).slice(-400).map((m) => ({ role: ['user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 64 * KB), images: Math.min(4, Number(m.images) || 0), at: m.at || null })),
    createdAt: s.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  const all = chats();
  all.sessions = [clean, ...all.sessions.filter((x) => x.id !== clean.id)].slice(0, 200);
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(chatFile(), JSON.stringify(all));
  return clean;
}
function deleteChat(id) { const all = chats(); all.sessions = all.sessions.filter((x) => x.id !== id); fs.writeFileSync(chatFile(), JSON.stringify(all)); return true; }
/** Markdown or JSON of chosen conversations, with nothing but the words, the model and the settings. */
function exportChats(ids, format) {
  const list = chats().sessions.filter((x) => !ids?.length || ids.includes(x.id));
  if (format === 'json') return JSON.stringify(list.map(({ id, title, model, system, options, messages, createdAt, updatedAt }) => ({ id, title, model, system, options, messages, createdAt, updatedAt })), null, 2);
  return list.map((s) => [`# ${s.title}`, '', `Model: ${s.model || 'none'} · started ${s.createdAt}`, s.system ? `\nSystem prompt:\n\n> ${s.system.replace(/\n/g, '\n> ')}` : '', '',
    ...s.messages.map((m) => `**${m.role === 'user' ? 'You' : s.model || 'Model'}**${m.images ? ` (${m.images} image${m.images > 1 ? 's' : ''} not included)` : ''}\n\n${m.content}\n`)].join('\n')).join('\n---\n\n');
}

module.exports = { setup, validate, call, stream, cancel, runtime, start, stop, hardware, catalog, refreshCatalog, pullState, enqueue, cancelPull, retryPull, clearPulls, setParallel, chats, saveChat, deleteChat, exportChats, binary, onPath, BASE, NAME };
