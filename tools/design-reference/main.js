// Design-reference viewer: a plain developer tool (not the product) that renders the
// checked-in design-canvas boards from design/canvas exactly as written, offline.
//
//   npx electron tools/design-reference                       browse every board
//   npx electron tools/design-reference --board Peers.dc.html --view peers \
//       --theme dark --width 1440 --height 960 --scale 1 --capture out.png
//
// Determinism: animation and transitions are switched off, fonts come from the
// vendored copies, the uploaded stylesheets come from design/canvas/assets, and the
// window size and device scale come from the arguments.
const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const canvasDir = path.join(root, 'design', 'canvas');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const tuple = { board: arg('board', 'Main.dc.html'), view: arg('view', ''), theme: arg('theme', 'dark'), width: Number(arg('width', 1440)), height: Number(arg('height', 960)), scale: Number(arg('scale', 1)) };
const capture = arg('capture', '');
if (!/^[A-Za-z0-9_-]+\.dc\.html$/.test(tuple.board)) { console.error('Invalid board name.'); process.exit(2); }

protocol.registerSchemesAsPrivileged([{ scheme: 'dcref', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.commandLine.appendSwitch('force-device-scale-factor', String(tuple.scale));
app.commandLine.appendSwitch('disable-gpu');

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const blobs = JSON.parse(fs.readFileSync(path.join(canvasDir, 'assets.json'), 'utf8')).files;
const send = (file) => {
  try { return new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' } }); }
  catch { return new Response('Not found', { status: 404 }); }
};
const inside = (base, rel) => { const p = path.resolve(base, rel); return p.startsWith(base + path.sep) ? p : null; };

function index() {
  const boards = fs.readdirSync(canvasDir).filter((f) => f.endsWith('.dc.html')).sort();
  const links = boards.map((b) => `<li><a href="dcref://board/${b}">${b}</a></li>`).join('');
  return new Response(`<!doctype html><meta charset="utf-8"><title>Design reference</title><body style="font: 15px system-ui; padding: 24px"><h1>Design reference boards</h1><p>Rendered offline from design/canvas. Add ?theme=light or ?view=&lt;id&gt; to a board URL.</p><ul>${links}</ul></body>`, { headers: { 'content-type': 'text/html' } });
}

async function settle(win) {
  for (let i = 0; i < 100; i++) {
    const s = await win.webContents.executeJavaScript('({ ready: document.documentElement.dataset.dcReady, error: document.documentElement.dataset.dcError })');
    if (s.error) throw new Error(`Board error: ${s.error}`);
    if (s.ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, Number(arg('settle', 1500))));
}

const LAYOUT_DRIFT = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('.seg:not(.wrapped)')) {
    const k = el.children;
    for (let i = 1; i < k.length; i++) if (k[i].offsetTop > k[0].offsetTop + 2) { out.push('choice "' + (el.getAttribute('aria-label') || '') + '" wraps without the two-column layout'); break; }
  }
  for (const el of document.querySelectorAll('.mtabs')) {
    const wrap = el.parentElement;
    const over = el.scrollWidth > el.clientWidth + 2;
    if (over && !wrap.classList.contains('can-right')) out.push('tabs "' + el.textContent.trim().slice(0, 30) + '" run past the edge without the arrow');
    if (!over && wrap.classList.contains('can-right')) out.push('tabs "' + el.textContent.trim().slice(0, 30) + '" show an arrow but fit');
  }
  return out;
})()`;

/** Captures every view of every board in each requested theme, with a manifest of tuples and hashes. */
async function captureAll(win, outDir) {
  const crypto = require('node:crypto');
  fs.mkdirSync(outDir, { recursive: true });
  const themes = arg('themes', 'dark').split(',');
  const manifest = [];
  const layoutDrift = [];
  for (const board of fs.readdirSync(canvasDir).filter((f) => f.endsWith('.dc.html')).sort()) {
    const html = fs.readFileSync(path.join(canvasDir, board), 'utf8');
    const m = html.match(/data-props='([^']*)'/);
    const props = m ? JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&')) : {};
    const views = props.view?.options || [''];
    for (const theme of themes) for (const view of views) {
      const q = new URLSearchParams({ theme }); if (view) q.set('view', view);
      await win.loadURL(`dcref://board/${board}?${q}`);
      await settle(win);
      const png = (await win.webContents.capturePage()).toPNG();
      const file = `${theme}-${board.replace('.dc.html', '')}-${view || 'default'}.png`;
      fs.writeFileSync(path.join(outDir, file), png);
      manifest.push({ file, board, view, theme, width: tuple.width, height: tuple.height, scale: tuple.scale, sha256: crypto.createHash('sha256').update(png).digest('hex') });
      // The app lays out a choice that no longer fits one row as a two-column grid, and shows an
      // arrow when section tabs run past the edge. A static board has to say so itself.
      const drift = await win.webContents.executeJavaScript(LAYOUT_DRIFT).catch(() => []);
      for (const d of drift) layoutDrift.push(`${board} ${view} ${theme}: ${d}`);
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ tool: 'tools/design-reference', animations: 'off', fonts: 'vendored', captures: manifest, layoutDrift }, null, 2));
  if (layoutDrift.length) console.warn(`Boards that do not show the app's own layout for these controls:\n  ${layoutDrift.join('\n  ')}`);
  console.log(`${manifest.length} reference captures in ${outDir}`);
}

app.whenReady().then(async () => {
  protocol.handle('dcref', (req) => {
    const u = new URL(req.url);
    if (u.host === 'index') return index();
    if (u.host === 'fonts') return send(inside(path.join(root, 'assets', 'fonts'), u.pathname.slice(1)) || '');
    if (u.host !== 'board') return new Response('Not found', { status: 404 });
    if (u.pathname === '/support.js') return send(path.join(__dirname, 'dc-shim.js'));
    if (u.pathname.startsWith('/_blob/')) return send(blobs[u.pathname] ? path.join(canvasDir, blobs[u.pathname]) : '');
    return send(inside(canvasDir, decodeURIComponent(u.pathname.slice(1))) || '');
  });
  // Remote font stylesheets in a board map to the vendored fonts; nothing leaves the machine.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (d.url.startsWith('https://fonts.googleapis.com/')) return cb({ redirectURL: 'dcref://fonts/fonts.css' });
    cb({ cancel: true });
  });
  const win = new BrowserWindow({ width: tuple.width, height: tuple.height, useContentSize: true, show: !capture, backgroundColor: '#0b0f1a', webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  win.webContents.on('did-finish-load', () => win.webContents.insertCSS('*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'));
  const all = arg('all', '');
  if (all) { await captureAll(win, path.resolve(all)); app.exit(0); return; }
  if (!capture && !arg('board', '')) { await win.loadURL('dcref://index/'); return; }
  const q = new URLSearchParams({ theme: tuple.theme }); if (tuple.view) q.set('view', tuple.view);
  await win.loadURL(`dcref://board/${tuple.board}?${q}`);
  if (!capture) return;
  try { await settle(win); } catch (e) { console.error(e.message); app.exit(3); return; }
  const img = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(path.resolve(capture)), { recursive: true });
  fs.writeFileSync(path.resolve(capture), img.toPNG());
  console.log(JSON.stringify({ captured: capture, ...tuple, size: img.getSize() }));
  app.exit(0);
});
