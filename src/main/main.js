'use strict';
if (require('electron-squirrel-startup')) process.exit(0);

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, autoUpdater, clipboard, Notification } = require('electron');
const { openRoute } = require('./capture-routes.js');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('./tailscale');
const admin = require('./admin-api');
const secrets = require('./secrets');
const history = require('./history');
const ladder = require('./ladder');
const tools = require('./tools');
const mc = require('./minecraft');
const extensions = require('./extensions');
const { COMMANDS, GROUPS, GLOBAL_FLAGS } = require('../shared/cli-catalog');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PRODUCT = 'Material Tailscale';
let win = null;
let tray = null;

function buildInfo() {
  try { return JSON.parse(fs.readFileSync(path.join(DIST, 'build-info.json'), 'utf8')); } catch { return null; }
}

// ---------- shared cross-app record (School mode and its credential) ----------
const sharedDir = () => path.join(app.getPath('appData'), 'DingDingProjects', 'shared');
const sharedFile = () => path.join(sharedDir(), 'school-mode.json');
function readShared() {
  try { return JSON.parse(fs.readFileSync(sharedFile(), 'utf8')); } catch { return { enabled: false, name: null }; }
}
function writeShared(rec) {
  fs.mkdirSync(sharedDir(), { recursive: true });
  const cur = readShared();
  fs.writeFileSync(sharedFile(), JSON.stringify({ ...cur, ...rec, updatedAt: new Date().toISOString() }, null, 2));
}
function watchShared() {
  try {
    fs.mkdirSync(sharedDir(), { recursive: true });
    fs.watch(sharedDir(), { persistent: false }, () => win?.webContents.send('shared:changed', readShared()));
  } catch { /* watching is best effort; the renderer also polls */ }
}

// ---------- window ----------
// On Windows the title bar keeps Windows' own caption buttons through the title-bar overlay, so
// Snap layouts work; the renderer hides its drawn buttons and sends the theme's colours (checked
// below). Other platforms draw the buttons in the page.
const OVERLAY = process.platform === 'win32';
const OVERLAY_HEIGHT = 44;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 380, minHeight: 480,
    ...(OVERLAY ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#131829', symbolColor: '#e6e8f2', height: OVERLAY_HEIGHT } } : { frame: false, titleBarStyle: 'hidden' }),
    backgroundColor: '#0b0f1a', show: false,
    icon: path.join(ROOT, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, backgroundThrottling: false }
  });
  win.loadFile(path.join(DIST, 'index.html'));
  win.once('ready-to-show', () => { if (!process.env.MT_HEADLESS) win.show(); });
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(ROOT, 'assets', 'tray.png'));
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip(PRODUCT);
    const menu = Menu.buildFromTemplate([
      { label: 'Open', click: () => { win?.show(); win?.focus(); } },
      { label: 'Connect', click: () => ts.run('up', {}).then((r) => win?.webContents.send('tray:result', { id: 'up', r })) },
      { label: 'Disconnect', click: () => ts.run('down', {}).then((r) => win?.webContents.send('tray:result', { id: 'down', r })) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => { win?.show(); win?.focus(); });
  } catch { /* tray unsupported on this desktop */ }
}

// ---------- updates (Squirrel.Windows feed from GitHub releases) ----------
function setupUpdates() {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return;
  }
  const feed = `https://update.electronjs.org/Ding-Ding-Projects/material-Tailscale/${process.platform}-${process.arch}/${app.getVersion()}`;
  try { autoUpdater.setFeedURL({ url: feed }); } catch { return; }
  autoUpdater.on('checking-for-update', () => win?.webContents.send('update:state', { state: 'checking' }));
  autoUpdater.on('update-available', () => win?.webContents.send('update:state', { state: 'downloading' }));
  autoUpdater.on('update-not-available', () => win?.webContents.send('update:state', { state: 'current' }));
  autoUpdater.on('error', (e) => win?.webContents.send('update:state', { state: 'error', message: e.message }));
  autoUpdater.on('update-downloaded', (_e, notes, name) => win?.webContents.send('update:state', { state: 'ready', name, notes }));
  const check = () => { try { autoUpdater.checkForUpdates(); } catch { /* offline */ } };
  setTimeout(check, 15000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

// ---------- IPC ----------
const handle = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => {
  try { return { ok: true, value: await fn(...a) }; } catch (err) { return { ok: false, error: err.message, code: err.code }; }
});

handle('app:info', () => ({ product: PRODUCT, version: app.getVersion(), build: buildInfo(), platform: process.platform, arch: process.arch, electron: process.versions.electron, userData: app.getPath('userData'), packaged: app.isPackaged, titleBarOverlay: OVERLAY }));
handle('cli:catalog', () => ({ commands: COMMANDS, groups: GROUPS, global: GLOBAL_FLAGS }));
handle('api:catalog', () => require('../shared/api-catalog.json'));
handle('ts:locate', () => ts.locate());
handle('ts:setBinary', (p) => { ts.setOverride(p); return ts.locate(); });
handle('ts:run', (id, values) => ts.run(id, values));
handle('ts:raw', (argv) => ts.raw(argv));
handle('ts:stream', (id, values, streamId) => ts.stream(id, values, streamId, (msg) => win?.webContents.send('ts:stream', msg)));
handle('ts:cancel', (streamId) => ts.cancel(streamId));
handle('ts:terminal', (id, values) => ts.openTerminal(id, values));
handle('api:request', (req) => admin.request(req));
handle('secret:set', (name, obj) => { if (!/^[a-z0-9:_-]{1,64}$/i.test(name)) throw new Error('Bad name'); secrets.set(name, obj); return secrets.presence(name); });
handle('secret:presence', (name) => secrets.presence(name));
handle('secret:clear', (name) => { secrets.clear(name); return true; });
handle('secret:available', () => secrets.available());
handle('auth:load', () => { const r = secrets.get('authenticator:secrets'); return r?.value ? JSON.parse(r.value) : {}; });
const lockId = (name) => { if (!/^lock:[a-z0-9:_.-]{1,80}$/i.test(name)) throw new Error('Bad lock name'); return name.slice(5); };
handle('lock:verify', (name, attempt) => ladder.verify(lockId(name), attempt || {}));
handle('lock:status', (name) => ladder.status(lockId(name)));
handle('lock:clearState', (name) => ladder.clear(lockId(name)));
handle('ladder:start', (name, rung, opts) => ladder.start(lockId(name), rung, opts));
handle('ladder:answer', (nonce, payload) => ladder.answer(nonce, payload));
handle('ladder:complete', (name, opts) => ladder.complete(lockId(name), opts));
// Tools: progress for long operations is sent back on 'tools:progress' with the caller's job id.
const progress = (job) => (p) => win?.webContents.send('tools:progress', { job, ...p });
handle('tools:installTailscale', (job) => tools.installTailscale(progress(job)));
handle('tools:installOllama', (job) => tools.installOllama(progress(job)));
handle('tools:ensureJava', (feature, job) => tools.ensureJava(feature, progress(job)));
handle('tools:archiveCreate', (opts, job) => tools.archiveCreate(opts, progress(job)));
handle('tools:archiveExtract', (opts, job) => tools.archiveExtract(opts, progress(job)));
handle('tools:archiveList', (file) => tools.archiveList(file));
handle('tools:archiveData', (opts) => tools.archiveData(opts));
handle('tools:convertMedia', (opts, job) => tools.convertMedia(opts, progress(job)));
handle('tools:convertDocument', (opts) => tools.convertDocument(opts));
handle('tools:grep', (opts) => tools.grep(opts));
mc.setEmitter((kind, payload) => { if (kind === 'progress') win?.webContents.send('tools:progress', payload); else win?.webContents.send('mc:' + kind, payload); });
for (const [name, fn] of Object.entries({
  registry: () => mc.loadRegistry(), catalog: (e, f) => mc.catalog(e, f), resolve: (e, f, v) => mc.resolve(e, f, v), probe: (t) => mc.probeTarget(t), discover: (t) => mc.discover(t),
  create: (spec, job) => mc.create(spec, job), adopt: (t, item, n) => mc.adopt(t, item, n), acceptEula: (id) => mc.acceptEula(id), start: (id) => mc.start(id), stop: (id, o) => mc.stop(id, o),
  command: (id, c) => mc.command(id, c), status: (id) => mc.status(id), readFile: (id, rel) => mc.readFile(id, rel), writeFile: (id, rel, t) => mc.writeFile(id, rel, t), update: (id, patch) => mc.updateServer(id, patch),
  searchExtensions: (o) => mc.searchExtensions(o), installExtension: (id, pid, o, job) => mc.installExtension(id, pid, o, job), listExtensions: (id) => mc.listExtensions(id), toggleExtension: (id, f, file, en) => mc.toggleExtension(id, f, file, en), removeExtension: (id, f, file) => mc.removeExtension(id, f, file),
  backup: (id, job) => mc.backup(id, job), listBackups: (id) => mc.listBackups(id), restore: (id, file, job) => mc.restore(id, file, job), extractWorldgen: (id, job) => mc.extractWorldgen(id, job), generateWorld: (id, o, job) => mc.generateWorld(id, o, job), cancelGenerate: (job) => mc.cancelGenerate(job),
  lookupPlayer: (n) => mc.lookupPlayer(n), remove: (id, o) => mc.remove(id, o), followLogs: (id) => mc.followLogs(id)
})) handle('mc:' + name, fn);
handle('tools:bundled', () => ({ ffmpeg: tools.ffmpegPath(), sevenZip: tools.sevenZipPath(), ffmpegPresent: !!tools.ffmpegPath() && fs.existsSync(tools.ffmpegPath()), sevenZipPresent: !!tools.sevenZipPath() && fs.existsSync(tools.sevenZipPath()) }));
handle('history:record', (message, files) => history.record(message, files));
handle('history:list', (limit) => history.list(limit));
handle('history:files', (oid) => history.files(oid));
handle('history:restore', (oid) => history.restore(oid));
handle('shared:get', () => readShared());
handle('shared:set', (rec) => { writeShared(rec); return readShared(); });
handle('dialog:open', (opts) => dialog.showOpenDialog(win, { properties: opts?.properties || ['openFile'], filters: opts?.filters, title: opts?.title }).then((r) => (r.canceled ? null : r.filePaths)));
handle('dialog:save', (opts) => dialog.showSaveDialog(win, { defaultPath: opts?.defaultPath, filters: opts?.filters }).then((r) => (r.canceled ? null : r.filePath)));
handle('fs:writeText', async (p, text) => { fs.writeFileSync(p, text); return p; });
handle('fs:writeBytes', async (p, b64) => { fs.writeFileSync(p, Buffer.from(b64, 'base64')); return p; });
handle('fs:readText', async (p) => { const st = fs.statSync(p); if (st.size > 32 * 1024 * 1024) throw new Error('File is larger than 32 MB.'); return fs.readFileSync(p, 'utf8'); });
handle('fs:readBytes', async (p) => { const st = fs.statSync(p); if (st.size > 256 * 1024 * 1024) throw new Error('File is larger than 256 MB.'); return fs.readFileSync(p).toString('base64'); });
// ---------- extensions ----------
let extHost = null;
const exts = () => extHost || (extHost = extensions.createHost({
  dir: path.join(app.getPath('userData'), 'extensions'),
  statePath: path.join(app.getPath('userData'), 'extensions-state.json'),
  builtinDir: path.join(__dirname, '..', '..', 'extensions', 'builtin')
}));
let extPicked = null; // the folder chosen in the last Add dialog; a replace may only use that one
handle('ext:list', () => exts().list());
handle('ext:allow', (id, fp) => exts().allow(id, fp));
handle('ext:setEnabled', (id, on) => exts().setEnabled(id, on));
handle('ext:setMasterOff', (off) => exts().setMasterOff(off));
handle('ext:remove', (id) => exts().remove(id));
handle('ext:openFolder', () => { fs.mkdirSync(exts().folder, { recursive: true }); return shell.openPath(exts().folder); });
handle('ext:run', (id, action, context) => exts().run(id, action, context));
handle('ext:add', async (opts = {}) => {
  if (!opts.replace) {
    const r = await dialog.showOpenDialog(win, { title: 'Add an extension folder', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    extPicked = r.filePaths[0];
  }
  if (!extPicked) throw new Error('Choose the extension folder again.');
  return exts().addFromFolder(extPicked, { replace: !!opts.replace });
});

handle('shell:external', (url) => { if (!/^https?:\/\//.test(url)) throw new Error('Only web links can be opened.'); return shell.openExternal(url); });
handle('shell:openPath', (p) => shell.openPath(p));
handle('shell:showItem', (p) => shell.showItemInFolder(p));
handle('editor:detect', () => detectEditors());
handle('editor:open', (exe, target) => { require('node:child_process').spawn(exe, [target], { detached: true, windowsHide: true }).unref(); return true; });
handle('clipboard:readImage', () => { const img = clipboard.readImage(); return img.isEmpty() ? null : img.toDataURL(); });
handle('notify', ({ title, body }) => { if (Notification.isSupported()) new Notification({ title, body }).show(); return true; });
handle('update:install', () => { autoUpdater.quitAndInstall(); return true; });
handle('update:check', () => {
  if (process.platform !== 'win32' || !app.isPackaged) return { state: 'unsupported' };
  try { autoUpdater.checkForUpdates(); return { state: 'checking' }; } catch (e) { return { state: 'error', message: e.message }; }
});
handle('win:minimize', () => win.minimize());
handle('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
handle('win:close', () => win.close());
handle('win:overlay', (o) => {
  if (!OVERLAY || !win) return false;
  const hex = /^#[0-9a-f]{6}$/i;
  if (!o || !hex.test(o.color) || !hex.test(o.symbolColor)) throw new Error('Title-bar colours must be #rrggbb.');
  win.setTitleBarOverlay({ color: o.color, symbolColor: o.symbolColor, height: OVERLAY_HEIGHT });
  return true;
});
handle('win:title', (t) => win.setTitle(String(t).slice(0, 120)));
handle('win:capture', async () => (await win.webContents.capturePage()).toPNG().toString('base64'));

function detectEditors() {
  const out = [];
  const add = (name, p) => { if (p && fs.existsSync(p)) out.push({ name, path: p }); };
  const L = process.env.LOCALAPPDATA || '';
  const P = process.env.ProgramFiles || 'C:\\Program Files';
  if (process.platform === 'win32') {
    add('Visual Studio Code (user)', path.join(L, 'Programs', 'Microsoft VS Code', 'Code.exe'));
    add('Visual Studio Code (machine)', path.join(P, 'Microsoft VS Code', 'Code.exe'));
    add('Visual Studio Code Insiders', path.join(L, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'));
    add('Notepad++', path.join(P, 'Notepad++', 'notepad++.exe'));
    add('Notepad', 'C:\\Windows\\System32\\notepad.exe');
  } else if (process.platform === 'darwin') {
    add('Visual Studio Code', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code');
    add('TextEdit', '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit');
  } else {
    add('Visual Studio Code', '/usr/bin/code');
    add('gedit', '/usr/bin/gedit');
  }
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const c = path.join(dir, process.platform === 'win32' ? 'code.cmd' : 'code');
    if (dir && fs.existsSync(c) && !out.some((x) => x.path === c)) out.push({ name: 'VS Code (code on PATH)', path: c });
  }
  return out;
}

app.setAppUserModelId('com.dingdingprojects.materialtailscale');
// The every-surface sweep runs in a throwaway profile: it never touches the user's settings,
// starts from a known state, and can run beside an open copy of the app.
if (process.env.MT_SWEEP_DIR) app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mt-sweep-profile-')));
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

async function captureAll(dir) {
  // Drives the real built renderer through every destination in both themes
  // and writes PNGs. Used by `npm run screenshots` and the release workflow.
  fs.mkdirSync(dir, { recursive: true });
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 100 && !(await wc.executeJavaScript('!!window.__mtReady').catch(() => false)); i++) await wait(100);
  await wc.executeJavaScript("document.querySelector('.scrim')?.remove(); document.querySelector('.dimsum')?.remove(); true");
  // Chromium remembers zoom per origin, so every capture sets it explicitly (default 100%).
  wc.setZoomFactor(Number(process.env.MT_CAPTURE_ZOOM || 1));
  await wait(150);
  if (process.env.MT_CAPTURE_DIAG) console.log(await wc.executeJavaScript('JSON.stringify({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, fs: getComputedStyle(document.body).fontSize, ts: getComputedStyle(document.documentElement).getPropertyValue("--text-scale") })'));
  if (process.env.MT_CAPTURE_MOTION) await wc.executeJavaScript(`window.__mtSet('motion', ${JSON.stringify(process.env.MT_CAPTURE_MOTION)}); true`);
  // Captures change settings only for their run: the user's saved settings come back at the end.
  const savedSettings = await wc.executeJavaScript("localStorage.getItem('mt.settings.v1')").catch(() => null);
  const captureLang = process.env.MT_CAPTURE_LANG || 'both';
  await wc.executeJavaScript(`window.__mtSet('lang', ${JSON.stringify(captureLang)}); true`);
  const clipping = [];
  const provenance = [];
  // Finds visible text that is cut off: horizontal overflow without a scroll
  // container, or an element that extends past the window's right edge.
  const CLIP_PROBE = `(() => { const out = []; const W = innerWidth; for (const el of document.querySelectorAll('body *')) { if (!el.offsetParent || el.closest('[aria-hidden=true],.out,.tbl-wrap,.picker-list,canvas,svg,.cmdline')) continue; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (!r.width) continue; const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue; const clipped = el.scrollWidth > el.clientWidth + 6 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis'; const past = r.right > W + 1; if (clipped || past) out.push({ sw: el.scrollWidth, cw: el.clientWidth, text: el.textContent.trim().slice(0, 60), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40), why: past ? 'past the right edge' : 'overflow hidden' }); if (out.length > 40) break; } return out; })()`;
  const dests = (process.env.MT_CAPTURE_DESTS || 'home,peers,exit,routes,serve,taildrop,dns,lock,drive,certs,accounts,diagnostics,cli,cli:set,cli:serve,admin,console,tools,authenticator,base64,converter,regex,draw,ollama,minecraft,extensions,extensions>overlay@ext-consent,docs,status,history,changelog,notifications,settings,settings:appearance,settings:language,settings:school,settings:schedules,about').split(',');
  for (const theme of (process.env.MT_CAPTURE_THEMES || 'dark,light').split(',')) {
    await wc.executeJavaScript(`window.__mtSet('theme', ${JSON.stringify(theme)}); window.__mtSet('motion', 'reduced'); true`);
    for (const d of dests) {
      await openRoute(wc, d);
      if (process.env.MT_CAPTURE_CLIP) { const found = await wc.executeJavaScript(CLIP_PROBE).catch(() => []); if (found.length) clipping.push({ theme, dest: d, found }); }
      const img = await wc.capturePage();
      const file = `${theme}-${d.replace(/[:>]/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}.png`;
      const png = img.toPNG();
      fs.writeFileSync(path.join(dir, file), png);
      const vp = await wc.executeJavaScript('({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, lang: document.documentElement.lang, motion: document.documentElement.classList.contains("reduce-motion") ? "reduced" : "full" })').catch(() => ({}));
      provenance.push({ file, route: d, theme, viewport: { width: vp.width, height: vp.height }, scale: vp.dpr, zoom: wc.getZoomFactor(), motion: vp.motion, language: captureLang, bytes: png.length, sha256: require('node:crypto').createHash('sha256').update(png).digest('hex') });
    }
  }
  if (process.env.MT_CAPTURE_PALETTE !== '0') {
    await wc.executeJavaScript("window.dispatchEvent(new CustomEvent('mt:palette')); true");
    await wait(600);
    const palPng = (await wc.capturePage()).toPNG();
    fs.writeFileSync(path.join(dir, 'light-palette.png'), palPng);
    provenance.push({ file: 'light-palette.png', route: 'palette', theme: 'light', zoom: wc.getZoomFactor(), bytes: palPng.length, sha256: require('node:crypto').createHash('sha256').update(palPng).digest('hex') });
  }
  if (process.env.MT_CAPTURE_CLIP) fs.writeFileSync(path.join(dir, 'clipping.json'), JSON.stringify(clipping, null, 2));
  // Provenance for every capture: what was built, how it was captured, and each file's hash.
  const bundle = path.join(__dirname, '..', '..', 'dist', 'app.js');
  let bundleSha = null; try { bundleSha = require('node:crypto').createHash('sha256').update(fs.readFileSync(bundle)).digest('hex'); } catch { /* packaged app: bundle lives in the asar */ }
  fs.writeFileSync(path.join(dir, 'capture-manifest.json'), JSON.stringify({
    app: { version: app.getVersion(), build: (() => { try { return require('../../dist/build-info.json'); } catch { return null; } })(), rendererBundleSha256: bundleSha },
    method: 'Electron capturePage of the built renderer in capture mode (cloud Linux, Xvfb); sample-free: screens show this machine\'s real state',
    privacy: 'No account is signed in on the capture machine; no tailnet, token or personal data appears in these captures.',
    captures: provenance
  }, null, 2) + '\n');
  await wc.executeJavaScript(savedSettings === null ? "localStorage.removeItem('mt.settings.v1'); true" : `localStorage.setItem('mt.settings.v1', ${JSON.stringify(savedSettings)}); true`).catch(() => {});
  app.quit();
}

async function recordPath(dir) {
  // Records an end-to-end path through the real interface as numbered PNG
  // frames; scripts/record.mjs turns them into an animated GIF.
  fs.mkdirSync(dir, { recursive: true });
  const wc = win.webContents;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 100 && !(await wc.executeJavaScript('!!window.__mtReady').catch(() => false)); i++) await wait(100);
  wc.setZoomFactor(1);
  await wc.executeJavaScript("document.querySelector('.scrim')?.remove(); document.querySelector('.dimsum')?.remove(); window.__mtSet('theme', 'dark'); true");
  let n = 0, rec = true;
  const loop = (async () => { while (rec) { const img = await wc.capturePage(); fs.writeFileSync(path.join(dir, `f${String(n++).padStart(4, '0')}.png`), img.resize({ width: 960 }).toPNG()); await wait(120); } })();
  const js = (code) => wc.executeJavaScript(`(async () => { ${code} })(); true`);
  const press = (label) => js(`[...document.querySelectorAll('button')].find((b) => b.offsetParent && b.textContent.trim().endsWith(${JSON.stringify(label)}))?.click();`);
  const type = async (selector, text) => { for (let i = 1; i <= text.length; i++) { await js(`const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(text.slice(0, i))}; el.dispatchEvent(new Event('input', { bubbles: true }));`); await wait(70); } };
  const steps = [
    () => js("window.__mtOpen('home')"), () => wait(1500),
    () => js("window.dispatchEvent(new CustomEvent('mt:palette'))"), () => wait(600),
    () => type('input[role=combobox]', 'exit node'), () => wait(1200),
    () => js("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.__mtOpen('cli', 'set')"), () => wait(1200),
    () => press('Guide me'), () => wait(1200), () => press('Next'), () => wait(900), () => press('Next'), () => wait(900), () => press('Show all options'), () => wait(1000),
    () => js("window.__mtOpen('regex')"), () => wait(1200), () => press('Trace the attempts'), () => wait(1200), () => js("window.scrollBy?.(0, 0); document.querySelector('.outlet')?.scrollTo({ top: 900, behavior: 'smooth' })"), () => wait(1500),
    () => js("window.__mtOpen('minecraft')"), () => wait(1200), () => press('New server'), () => wait(1200), () => press('Paper'), () => wait(900), () => press('Next'), () => wait(3500),
    () => js("document.querySelector('.scrim')?.remove(); window.__mtOpen('settings', 'appearance')"), () => wait(1500)
  ];
  for (const s of steps) await s().catch(() => {});
  rec = false; await loop;
  app.quit();
}

// Capture mode can pin the device scale so captures share one exact tuple.
if (process.env.MT_CAPTURE_DIR && process.env.MT_CAPTURE_SCALE) app.commandLine.appendSwitch('force-device-scale-factor', process.env.MT_CAPTURE_SCALE);

app.whenReady().then(() => {
  try { exts().installBuiltins(); } catch (e) { console.error('Built-in extensions were not installed:', e.message); }
  createWindow();
  if (process.env.MT_SWEEP_DIR) { win.webContents.once('did-finish-load', async () => { try { win.focus(); win.webContents.focus(); await require('./sweep.js').runSweep(win, process.env.MT_SWEEP_DIR); } catch (e) { console.error('sweep failed:', e); } app.quit(); }); return; }
  if (process.env.MT_RECORD_DIR) { win.setSize(1440, 900); win.webContents.once('did-finish-load', () => recordPath(process.env.MT_RECORD_DIR)); return; }
  if (process.env.MT_CAPTURE_DIR) { win.setSize(Number(process.env.MT_CAPTURE_W || 1440), Number(process.env.MT_CAPTURE_H || 940)); win.webContents.once('did-finish-load', () => captureAll(process.env.MT_CAPTURE_DIR)); return; }
  createTray();
  watchShared();
  setupUpdates();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
