// Captures every design reference view and its real counterpart under one tuple, then
// writes raw captures (lossless WebP), a labelled side-by-side comparison and diff evidence
// for each inventory entry. Needs a display (xvfb-run on Linux) and a built app and site.
//   npm run build && node scripts/build-site.mjs && xvfb-run -a node scripts/design-parity.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import electron from 'electron';
import sharp from 'sharp';
import { validate, CANVASES } from './lib/design-parity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = JSON.parse(fs.readFileSync(path.join(root, 'docs/design-parity/inventory.json'), 'utf8'));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-parity-'));
const W = 1440, H = 960;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sanitize = (route) => route.replace(/[:>]/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];

// 1. Design reference captures (one process for every board view).
const refDir = path.join(work, 'reference');
let r;
for (const canvas of CANVASES) {
  r = spawnSync(electron, [path.join(root, 'tools/design-reference'), ...sandbox, '--canvas', canvas, '--all', path.join(refDir, path.basename(canvas)), '--width', String(W), '--height', String(H), '--scale', '1', '--themes', 'dark'], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}

// 2. Real app captures through the app's own capture mode, motion off.
const appDir = path.join(work, 'app');
const appRoutes = [...new Set(inv.screens.filter((s) => s.surface === 'app').map((s) => s.appRoute))];
r = spawnSync(electron, [root, '--disable-gpu', ...sandbox], { stdio: 'inherit', env: { ...process.env, MT_CAPTURE_DIR: appDir, MT_CAPTURE_DESTS: appRoutes.join(','), MT_CAPTURE_THEMES: 'dark', MT_CAPTURE_PALETTE: '0', MT_CAPTURE_W: String(W), MT_CAPTURE_H: String(H), MT_CAPTURE_SCALE: '1', MT_CAPTURE_MOTION: 'reduced' } });
if (r.status) process.exit(r.status);

// 3. Website captures in Chromium with animation off.
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.error('Playwright is needed for the website captures (it is preinstalled on the capture machine; otherwise npm i -g playwright).'); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const siteShots = {};
for (const s of inv.screens.filter((x) => x.surface === 'site')) {
  await page.goto(pathToFileURL(path.join(root, 'site-dist/index.html')).href + s.appRoute.replace(/^site/, ''));
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForTimeout(1500);
  siteShots[s.id] = await page.screenshot({ type: 'png' });
}
await browser.close();

// 3b. The portable companions, photographed from their staged folders with Playwright's Electron driver.
const companionShots = {};
const companions = inv.screens.filter((x) => x.surface === 'companion');
if (companions.length) {
  if (!fs.existsSync(path.join(root, 'out/companions/stage-build/main.js'))) spawnSync(process.execPath, [path.join(root, 'scripts/build-companions.mjs'), '--stage-only'], { stdio: 'inherit' });
  const { _electron } = createRequire(import.meta.url)('playwright');
  for (const s of companions) {
    const app = await _electron.launch({ executablePath: electron, args: [path.join(root, 'out/companions', s.appRoute === 'companion-build' ? 'stage-build' : 'stage-site'), ...sandbox, '--disable-gpu'], colorScheme: 'dark' });
    const win = await app.firstWindow();
    await win.setViewportSize({ width: W, height: H });
    await win.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await win.waitForTimeout(1500);
    companionShots[s.id] = await win.screenshot({ type: 'png' });
    await app.close();
  }
}

// A page caught before it was drawn once produced a blank app capture (entrance animations that
// never ticked). Capture mode now waits for an opaque page and records whether it got one;
// refuse to write evidence from any capture that never rendered.
const appManifest = JSON.parse(fs.readFileSync(path.join(appDir, 'capture-manifest.json'), 'utf8'));
const unrendered = appManifest.captures.filter((c) => c.rendered === false).map((c) => c.route);
if (unrendered.length) { console.error(`The app never finished drawing these routes, so no evidence was written: ${unrendered.join(', ')}`); process.exit(1); }

// 4. Evidence per inventory entry.
const label = (text, width) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="56"><rect width="100%" height="100%" fill="#10131f"/><text x="18" y="36" font-family="sans-serif" font-size="22" font-weight="700" fill="#e6e8f2">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
for (const s of inv.screens) {
  const board = path.basename(s.reference).replace('.dc.html', '');
  const refPng = fs.readFileSync(path.join(refDir, path.basename(path.dirname(s.reference)), `dark-${board}-${s.view}.png`));
  const appPng = s.surface === 'site' ? siteShots[s.id] : s.surface === 'companion' ? companionShots[s.id] : fs.readFileSync(path.join(appDir, `dark-${sanitize(s.appRoute)}.png`));
  const [ref, app] = await Promise.all([refPng, appPng].map((b) => sharp(b).resize(W, H, { fit: 'contain', position: 'left top', background: '#000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const out = path.join(root, path.dirname(s.diff));
  fs.mkdirSync(out, { recursive: true });
  const refWebp = await sharp(ref.data, { raw: ref.info }).webp({ lossless: true }).toBuffer();
  const appWebp = await sharp(app.data, { raw: app.info }).webp({ lossless: true }).toBuffer();
  fs.writeFileSync(path.join(root, s.captures.reference), refWebp);
  fs.writeFileSync(path.join(root, s.captures.app), appWebp);
  // Diff: a pixel counts as changed when any channel moves by more than 40 of 255.
  let changed = 0; const heat = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H * 4; i += 4) {
    const d = Math.max(Math.abs(ref.data[i] - app.data[i]), Math.abs(ref.data[i + 1] - app.data[i + 1]), Math.abs(ref.data[i + 2] - app.data[i + 2]));
    const g = Math.round((ref.data[i] + ref.data[i + 1] + ref.data[i + 2]) / 9);
    if (d > 40) { changed++; heat[i] = 255; heat[i + 1] = 60; heat[i + 2] = 60; } else { heat[i] = heat[i + 1] = heat[i + 2] = g; }
    heat[i + 3] = 255;
  }
  await sharp(heat, { raw: { width: W, height: H, channels: 4 } }).resize(720).webp({ quality: 70 }).toFile(path.join(out, 'diff.webp'));
  const half = [await sharp(ref.data, { raw: ref.info }).resize(720).png().toBuffer(), await sharp(app.data, { raw: app.info }).resize(720).png().toBuffer()];
  await sharp({ create: { width: 1452, height: 536, channels: 3, background: '#10131f' } }).composite([
    { input: label(`Design reference · ${path.basename(path.dirname(s.reference)) === 'additions' ? 'Everything added · ' : ''}${board} · ${s.view}`, 720), left: 0, top: 0 }, { input: half[0], left: 0, top: 56 },
    { input: label(`Real ${s.surface} · ${s.appRoute}`, 720), left: 732, top: 0 }, { input: half[1], left: 732, top: 56 }
  ]).webp({ quality: 78 }).toFile(path.join(root, s.comparison));
  const tuple = { ...s.tuple };
  fs.writeFileSync(path.join(root, s.diff), JSON.stringify({
    id: s.id, tuple, referenceTuple: tuple, appTuple: tuple,
    boardSha256: sha(fs.readFileSync(path.join(root, s.reference))),
    captureSha256: { reference: sha(refWebp), app: sha(appWebp) },
    changedPixels: changed, totalPixels: W * H, changedRatio: Number((changed / (W * H)).toFixed(4)), threshold: 'any channel delta above 40 of 255',
    heatmap: path.relative(root, path.join(out, 'diff.webp')).split(path.sep).join('/')
  }, null, 2) + '\n');
  console.log(`${s.id.padEnd(24)} ${(100 * changed / (W * H)).toFixed(1)}% changed`);
}
fs.rmSync(work, { recursive: true, force: true });
const errors = validate(inv, root);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Design parity evidence written for ${inv.screens.length} screens; inventory valid.`);
