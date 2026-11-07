'use strict';
// Offline website companion: the whole Material Tailscale website (landing, Features, every
// documentation article, changelog and download notes) in one portable program. Pages are served
// from the copy bundled inside this program through a private app:// address; links to other
// sites open in the default browser. Nothing is downloaded.
const { app, BrowserWindow, protocol, shell, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SITE = path.join(__dirname, 'site');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(SITE, rel);
    if (!file.startsWith(SITE + path.sep) && file !== SITE) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  const win = new BrowserWindow({ width: 1280, height: 860, minWidth: 360, minHeight: 480, title: 'Material Tailscale · Offline website', backgroundColor: '#0b0f1a', autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  win.loadURL('app://site/index.html');
});
app.on('window-all-closed', () => app.quit());
