'use strict';
// Main-process tools: verified downloads, one-click installers for Tailscale,
// Ollama and a Java runtime, bundled ffmpeg and 7-Zip conversions, document
// conversion, and a bounded GREP across a folder.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { app, BrowserWindow } = require('electron');

const unpacked = (p) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
function ffmpegPath() { try { return unpacked(require('ffmpeg-static')); } catch { return null; } }
function sevenZipPath() { try { return unpacked(require('7zip-bin').path7za); } catch { return null; } }

const dataDir = (...p) => path.join(app.getPath('userData'), ...p);

// ---------------- verified downloads ----------------
async function download(url, dest, { sha256, onProgress, signal } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { signal, redirect: 'follow', headers: { 'User-Agent': 'MaterialTailscale' } });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  const tmp = dest + '.part';
  const out = fs.createWriteStream(tmp);
  let got = 0;
  for await (const chunk of res.body) {
    hash.update(chunk); out.write(chunk); got += chunk.length;
    onProgress?.({ got, total });
  }
  await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
  const digest = hash.digest('hex');
  if (!sha256) { fs.rmSync(tmp, { force: true }); throw new Error('No published checksum was available, so the file was not used.'); }
  if (digest.toLowerCase() !== sha256.toLowerCase()) { fs.rmSync(tmp, { force: true }); throw new Error(`Checksum mismatch: expected ${sha256}, got ${digest}. The file was deleted.`); }
  fs.renameSync(tmp, dest);
  return { path: dest, sha256: digest, bytes: got };
}

function runVisible(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: false });
    let err = '';
    p.stderr?.on('data', (d) => { err += d; });
    p.on('error', (e) => resolve({ code: -1, error: e.message }));
    p.on('close', (code) => resolve({ code, error: err.trim() }));
  });
}

// ---------------- one-click installers ----------------
async function installTailscale(onProgress) {
  if (process.platform !== 'win32') {
    return { ok: false, manual: true, message: process.platform === 'darwin' ? 'On macOS, install Tailscale from the App Store or tailscale.com; macOS requires that route.' : 'On Linux, install Tailscale with your distribution\'s package manager (the official repository is pkgs.tailscale.com).' };
  }
  onProgress?.({ phase: 'Finding the latest stable Tailscale for Windows' });
  const meta = await (await fetch('https://pkgs.tailscale.com/stable/?mode=json')).json();
  const msi = meta.MSIs?.[process.arch === 'arm64' ? 'arm64' : 'amd64'];
  if (!msi) throw new Error('The Tailscale package index did not list a Windows installer.');
  const url = `https://pkgs.tailscale.com/stable/${msi}`;
  const sha = (await (await fetch(url + '.sha256')).text()).trim().split(/\s+/)[0];
  const dest = dataDir('downloads', msi);
  await download(url, dest, { sha256: sha, onProgress: (p) => onProgress?.({ phase: `Downloading ${msi}`, ...p }) });
  onProgress?.({ phase: 'Installing (Windows will ask for permission)' });
  const r = await runVisible('msiexec.exe', ['/i', dest, '/passive', '/norestart']);
  if (r.code === 0 || r.code === 3010) return { ok: true, version: meta.TarballsVersion || msi, restartNeeded: r.code === 3010, sha256: sha };
  if (r.code === 1602) return { ok: false, cancelled: true, message: 'Installation was cancelled. Nothing was changed.' };
  return { ok: false, message: `The installer exited with code ${r.code}. ${r.error}` };
}

async function installOllama(onProgress) {
  if (process.platform !== 'win32') return { ok: false, manual: true, message: 'On macOS and Linux, install Ollama with the official package for your system.' };
  onProgress?.({ phase: 'Finding the latest Ollama release' });
  const rel = await (await fetch('https://api.github.com/repos/ollama/ollama/releases/latest', { headers: { 'User-Agent': 'MaterialTailscale' } })).json();
  const asset = rel.assets?.find((a) => a.name === 'OllamaSetup.exe');
  if (!asset) throw new Error('The latest Ollama release has no OllamaSetup.exe.');
  const sha = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : null;
  const dest = dataDir('downloads', `OllamaSetup-${rel.tag_name}.exe`);
  await download(asset.browser_download_url, dest, { sha256: sha, onProgress: (p) => onProgress?.({ phase: `Downloading Ollama ${rel.tag_name}`, ...p }) });
  onProgress?.({ phase: 'Installing Ollama' });
  const r = await runVisible(dest, ['/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES']);
  return r.code === 0 ? { ok: true, version: rel.tag_name, sha256: sha } : { ok: false, message: `The Ollama installer exited with code ${r.code}.` };
}

async function ensureJava(feature, onProgress) {
  const dir = dataDir('runtimes', `temurin-${feature}`);
  const exe = path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  const found = () => { if (fs.existsSync(exe)) return exe; if (!fs.existsSync(dir)) return null; for (const d of fs.readdirSync(dir)) { const e = path.join(dir, d, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'); if (fs.existsSync(e)) return e; } return null; };
  const have = found();
  if (have) return { java: have, cached: true };
  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  onProgress?.({ phase: `Finding Java ${feature}` });
  const list = await (await fetch(`https://api.adoptium.net/v3/assets/latest/${feature}/hotspot?os=${os}&architecture=${arch}&image_type=jre`)).json();
  const pkg = list?.[0]?.binary?.package;
  if (!pkg) throw new Error(`No Java ${feature} runtime is published for this system.`);
  const archive = dataDir('downloads', pkg.name);
  await download(pkg.link, archive, { sha256: pkg.checksum, onProgress: (p) => onProgress?.({ phase: `Downloading Java ${feature}`, ...p }) });
  onProgress?.({ phase: `Unpacking Java ${feature}` });
  fs.mkdirSync(dir, { recursive: true });
  await sevenZip(['x', archive, `-o${dir}`, '-y']);
  if (archive.endsWith('.tar.gz')) { const tar = path.join(dir, pkg.name.replace(/\.gz$/, '')); await sevenZip(['x', tar, `-o${dir}`, '-y']); fs.rmSync(tar, { force: true }); }
  const j = found();
  if (!j) throw new Error('Java was downloaded but its program was not found after unpacking.');
  if (process.platform !== 'win32') fs.chmodSync(j, 0o755);
  return { java: j, cached: false };
}

// ---------------- bundled 7-Zip ----------------
function sevenZip(args, onLine) {
  const bin = sevenZipPath();
  if (!bin || !fs.existsSync(bin)) return Promise.reject(new Error('The bundled 7-Zip program is missing from this installation.'));
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-bsp1', ...args], { windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; onLine?.(String(d)); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`7-Zip exited with code ${code}: ${err.trim() || out.trim().split('\n').pop()}`))));
  });
}

async function archiveCreate({ files, dest, format = 'zip', password, encryptHeaders, level = 5 }, onProgress) {
  const args = ['a', `-t${format}`, `-mx=${level}`, dest, ...files];
  if (password) { args.push(`-p${password}`); if (format === '7z' && encryptHeaders) args.push('-mhe=on'); if (format === 'zip') args.push('-mem=AES256'); }
  await sevenZip(args, (l) => { const m = l.match(/(\d+)%/); if (m) onProgress?.({ percent: Number(m[1]) }); });
  return { path: dest, bytes: fs.statSync(dest).size };
}
async function archiveExtract({ file, dest, password }, onProgress) {
  await sevenZip(['x', file, `-o${dest}`, '-y', ...(password ? [`-p${password}`] : ['-p'])], (l) => { const m = l.match(/(\d+)%/); if (m) onProgress?.({ percent: Number(m[1]) }); });
  return { path: dest };
}
async function archiveList(file) {
  const out = await sevenZip(['l', '-slt', file, '-p']);
  return out.split(/\r?\n\r?\n/).map((b) => Object.fromEntries(b.split(/\r?\n/).map((l) => l.split(' = ')).filter((x) => x.length === 2))).filter((e) => e.Path && e.Size !== undefined);
}

// ---------------- ffmpeg ----------------
function ffmpeg(args, onProgress, signal) {
  const bin = ffmpegPath();
  if (!bin || !fs.existsSync(bin)) return Promise.reject(new Error('The bundled ffmpeg program is missing from this installation.'));
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-y', ...args], { windowsHide: true });
    signal?.addEventListener('abort', () => p.kill());
    let dur = 0, err = '';
    p.stderr.on('data', (d) => {
      const s = String(d); err = (err + s).slice(-4000);
      const dm = s.match(/Duration: (\d+):(\d+):(\d+\.\d+)/); if (dm) dur = +dm[1] * 3600 + +dm[2] * 60 + +dm[3];
      const tm = s.match(/time=(\d+):(\d+):(\d+\.\d+)/); if (tm && dur) onProgress?.({ percent: Math.min(100, ((+tm[1] * 3600 + +tm[2] * 60 + +tm[3]) / dur) * 100) });
    });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve({ ok: true }) : reject(new Error(`ffmpeg exited with code ${code}: ${err.split('\n').slice(-3).join(' ')}`))));
  });
}
async function convertMedia({ input, output, options = {} }, onProgress) {
  const args = ['-i', input];
  if (options.audioOnly) args.push('-vn');
  if (options.bitrate) args.push('-b:a', options.bitrate);
  if (options.crf !== undefined) args.push('-crf', String(options.crf), '-preset', options.preset || 'veryfast');
  if (options.width) args.push('-vf', `scale=${options.width}:-2`);
  if (/\.gif$/i.test(output)) args.push('-vf', `fps=${options.fps || 12},scale=${options.width || 640}:-1:flags=lanczos`);
  args.push(output);
  await ffmpeg(args, onProgress);
  return { path: output, bytes: fs.statSync(output).size };
}

// ---------------- documents ----------------
async function htmlToPdf(html, dest) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    fs.writeFileSync(dest, pdf);
    return { path: dest, bytes: pdf.length };
  } finally { win.destroy(); }
}
async function convertDocument({ input, output }) {
  const ext = path.extname(input).toLowerCase().slice(1);
  const to = path.extname(output).toLowerCase().slice(1);
  let html;
  if (ext === 'docx') { const mammoth = require('mammoth'); html = (await mammoth.convertToHtml({ path: input })).value; }
  else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(input)), isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' '));
    const text = pages.join('\n\n');
    if (to === 'txt') { fs.writeFileSync(output, text); return { path: output, pages: doc.numPages }; }
    html = `<pre>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`;
  } else if (['md', 'markdown'].includes(ext)) { const { marked } = require('marked'); html = marked.parse(fs.readFileSync(input, 'utf8')); }
  else if (['html', 'htm'].includes(ext)) html = fs.readFileSync(input, 'utf8');
  else if (['txt', 'log', 'csv', 'json'].includes(ext)) html = `<pre>${fs.readFileSync(input, 'utf8').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`;
  else throw new Error(`Documents of type .${ext} are not supported.`);
  const page = `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.6 Segoe UI,Arial,sans-serif;margin:24px}pre{white-space:pre-wrap}</style>${html}`;
  if (to === 'pdf') return htmlToPdf(page, output);
  if (to === 'html') { fs.writeFileSync(output, page); return { path: output }; }
  if (to === 'txt') { fs.writeFileSync(output, html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')); return { path: output }; }
  throw new Error(`Cannot convert .${ext} to .${to}.`);
}

// ---------------- bounded GREP ----------------
async function grep({ folder, pattern, flags = 'i', include = '', maxFiles = 5000, maxBytes = 2 * 1024 * 1024, maxHits = 2000 }) {
  const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
  const inc = include ? new RegExp('(' + include.split(/[,;\s]+/).filter(Boolean).map((g) => g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')).join('|') + ')$', 'i') : null;
  const hits = [];
  let scanned = 0, skipped = 0;
  const started = Date.now();
  const walk = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (scanned >= maxFiles || hits.length >= maxHits || Date.now() - started > 20000) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(p); continue; }
      if (inc && !inc.test(e.name)) continue;
      let st; try { st = fs.statSync(p); } catch { continue; }
      if (st.size > maxBytes) { skipped++; continue; }
      scanned++;
      let text; try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
      if (text.includes('\u0000')) { skipped++; continue; }
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => { re.lastIndex = 0; if (line.length < 20000 && re.test(line) && hits.length < maxHits) hits.push({ file: p, line: i + 1, text: line.slice(0, 400) }); });
    }
  };
  walk(folder);
  return { hits, scanned, skipped, ms: Date.now() - started, truncated: hits.length >= maxHits || scanned >= maxFiles };
}

module.exports = { download, installTailscale, installOllama, ensureJava, sevenZip, archiveCreate, archiveExtract, archiveList, convertMedia, convertDocument, htmlToPdf, grep, ffmpegPath, sevenZipPath, dataDir };
