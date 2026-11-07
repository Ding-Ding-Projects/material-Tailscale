'use strict';
// Build companion: one portable window with Build, Build and run, and Build installer buttons
// over the repository's own build.bat and build-installer.bat. It carries the complete source of
// the commit it was made from (source.zip beside it), so it builds with no checkout present; it
// can also use a checkout folder you choose. The scripts fetch anything missing themselves and
// Windows asks for permission when they need it.
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const res = (...p) => path.join(process.resourcesPath || __dirname, ...p);
const bundled = () => { try { return JSON.parse(fs.readFileSync(res('source.json'), 'utf8')); } catch { return null; } };
let source = null; // { kind: 'bundled' | 'folder', dir, commit, version, files }
let child = null, log = [];
let win = null;

function folderSource(dir) {
  if (!fs.existsSync(path.join(dir, 'build.bat')) || !fs.existsSync(path.join(dir, 'build-installer.bat'))) throw new Error('That folder has no build.bat and build-installer.bat.');
  return { kind: 'folder', dir };
}
/** Unpacks the bundled source once per commit into the user's local app data. */
async function bundledSource() {
  const meta = bundled();
  if (!meta) throw new Error('This copy carries no bundled source.');
  const base = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'MaterialTailscaleBuild');
  const dir = path.join(base, `source-${meta.commit.slice(0, 12)}`);
  const done = path.join(dir, '.unpacked');
  if (!fs.existsSync(done)) {
    fs.mkdirSync(dir, { recursive: true });
    await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${res('source.zip').replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`], { windowsHide: true }, (e) => (e ? reject(new Error(`The bundled source could not be unpacked: ${e.message}`)) : resolve())));
    fs.writeFileSync(done, meta.commit);
  }
  return { kind: 'bundled', dir, ...meta };
}

ipcMain.handle('build:info', async () => ({ platform: process.platform, bundled: bundled(), source, running: !!child }));
ipcMain.handle('build:useBundled', async () => { source = await bundledSource(); return source; });
ipcMain.handle('build:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose a Material Tailscale checkout' });
  if (r.canceled) return source;
  source = folderSource(r.filePaths[0]);
  return source;
});
ipcMain.handle('build:start', async (_e, action) => {
  if (process.platform !== 'win32') throw new Error('build.bat and build-installer.bat run on Windows.');
  if (child) throw new Error('A build is already running.');
  if (!source) source = await bundledSource();
  const [script, args] = { build: ['build.bat', []], run: ['build.bat', ['--run']], installer: ['build-installer.bat', []] }[action] || [];
  if (!script) throw new Error('Unknown action.');
  log = [];
  child = spawn('cmd.exe', ['/d', '/c', script, ...args], { cwd: source.dir, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const send = (stream) => (d) => { for (const line of String(d).split(/\r?\n/)) { if (!line) continue; log.push(line); if (log.length > 20000) log.shift(); win?.webContents.send('build:line', { stream, line }); } };
  child.stdout.on('data', send('out'));
  child.stderr.on('data', send('err'));
  child.on('close', (code) => { child = null; win?.webContents.send('build:done', { code, action }); });
  child.on('error', (e) => { child = null; win?.webContents.send('build:done', { code: -1, action, error: e.message }); });
  return { started: true, dir: source.dir };
});
ipcMain.handle('build:stop', async () => {
  if (!child) return false;
  await new Promise((r) => execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => r()));
  return true;
});
ipcMain.handle('build:copy', () => { clipboard.writeText(log.join('\n')); return log.length; });

app.whenReady().then(() => {
  win = new BrowserWindow({ width: 1180, height: 820, minWidth: 360, minHeight: 480, title: 'Material Tailscale · Build companion', backgroundColor: '#0b0f1a', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => { if (child) execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => app.quit()); else app.quit(); });
