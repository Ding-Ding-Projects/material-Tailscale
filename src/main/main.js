'use strict';
if (require('electron-squirrel-startup')) process.exit(0);

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, autoUpdater, clipboard, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('./tailscale');
const admin = require('./admin-api');
const secrets = require('./secrets');
const history = require('./history');
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
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 380, minHeight: 560,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#0b0f1a', show: false,
    icon: path.join(ROOT, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true }
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

handle('app:info', () => ({ product: PRODUCT, version: app.getVersion(), build: buildInfo(), platform: process.platform, arch: process.arch, electron: process.versions.electron, userData: app.getPath('userData'), packaged: app.isPackaged }));
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
handle('lock:verify', (name, attempt) => {
  if (!/^lock:[a-z0-9:_.-]{1,80}$/i.test(name)) throw new Error('Bad lock name');
  const rec = secrets.get(name);
  if (!rec) return { ok: false, missing: true };
  const { createHash, timingSafeEqual } = require('node:crypto');
  const same = (a, b) => { const x = createHash('sha256').update(String(a ?? '')).digest(); const y = createHash('sha256').update(String(b ?? '')).digest(); return timingSafeEqual(x, y); };
  let ok = true;
  if (rec.pin !== undefined) ok = same(rec.pin, attempt.pin) && ok;
  if (rec.password !== undefined) ok = same(rec.password, attempt.password) && ok;
  if (rec.totpSecret) ok = require('../shared/totp').verify(rec.totpSecret, String(attempt.totp || ''), rec.totp || {}) && ok;
  return { ok };
});
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
handle('shell:external', (url) => { if (!/^https?:\/\//.test(url)) throw new Error('Only web links can be opened.'); return shell.openExternal(url); });
handle('shell:openPath', (p) => shell.openPath(p));
handle('shell:showItem', (p) => shell.showItemInFolder(p));
handle('editor:detect', () => detectEditors());
handle('editor:open', (exe, target) => { require('node:child_process').spawn(exe, [target], { detached: true, windowsHide: true }).unref(); return true; });
handle('clipboard:readImage', () => { const img = clipboard.readImage(); return img.isEmpty() ? null : img.toDataURL(); });
handle('notify', ({ title, body }) => { if (Notification.isSupported()) new Notification({ title, body }).show(); return true; });
handle('update:install', () => { autoUpdater.quitAndInstall(); return true; });
handle('update:check', () => { try { autoUpdater.checkForUpdates(); return 'checking'; } catch (e) { return e.message; } });
handle('win:minimize', () => win.minimize());
handle('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
handle('win:close', () => win.close());
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
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(() => {
  createWindow();
  createTray();
  watchShared();
  setupUpdates();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
