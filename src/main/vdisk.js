'use strict';
// Main-process side of the virtual disk manager. Validates every request, then runs
// src/main/vdisk/vdisk.ps1 with a JSON request file. Anything that changes a disk runs elevated
// through Start-Process -Verb RunAs, so Windows itself asks for permission; cancelling that
// prompt changes nothing and is reported as cancelled, never as success. Read-only questions run
// without elevation. On other systems every call reports that the feature is Windows-only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const EXT = /\.(vhd|vhdx|vhds|iso)$/i;
const SCRIPT = path.join(__dirname, 'vdisk', 'vdisk.ps1');
let dataDir = () => '';
function setup({ userData }) { dataDir = typeof userData === 'function' ? userData : () => userData; }

const windowsOnly = () => { const e = new Error('Virtual disks are a Windows feature, and this computer is not running Windows.'); e.code = 'WINDOWS_ONLY'; return e; };
function diskPath(p, { exists = true, ext = EXT } = {}) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || /[\0*?"<>|]/.test(p) || p.length > 1000) throw new Error('Choose the disk file with the file picker.');
  if (!ext.test(p)) throw new Error('A virtual disk ends in .vhd, .vhdx, .vhds or .iso.');
  if (exists === true && !fs.statSync(p, { throwIfNoEntry: false })?.isFile()) throw new Error(`There is no file at ${p}.`);
  if (exists === false && fs.existsSync(p)) throw new Error(`A file already exists at ${p}; nothing is ever overwritten. Choose another name.`);
  return p;
}
const mb = (n, min, max) => { const v = Math.round(Number(n)); if (!Number.isFinite(v) || v < min || v > max) throw new Error(`The size must be between ${min} MB and ${max.toLocaleString('en-US')} MB.`); return v; };

/** Checks a request and returns the clean object handed to the script. */
function validate(op, r = {}) {
  switch (op) {
    case 'probe': return { op };
    case 'info': if (!Array.isArray(r.paths) || r.paths.length > 200) throw new Error('At most 200 disks at a time.'); return { op, paths: r.paths.map((p) => diskPath(p, { exists: null })) };
    case 'create': {
      const vhd = /\.vhd$/i.test(r.path);
      const out = { op, path: diskPath(r.path, { exists: false, ext: /\.(vhd|vhdx)$/i }), type: r.type };
      if (!['dynamic', 'fixed', 'differencing'].includes(r.type)) throw new Error('Choose dynamic, fixed or differencing.');
      if (r.type === 'differencing') out.parent = diskPath(r.parent, { ext: /\.(vhd|vhdx)$/i });
      else out.sizeMB = mb(r.sizeMB, 3, vhd ? 2040 * 1024 : 64 * 1024 * 1024);
      if (r.prepare) {
        if (!['GPT', 'MBR'].includes(r.prepare.style) || !['NTFS', 'exFAT', 'FAT32', 'ReFS'].includes(r.prepare.fs)) throw new Error('Choose GPT or MBR and NTFS, exFAT, FAT32 or ReFS.');
        out.prepare = { style: r.prepare.style, fs: r.prepare.fs, label: String(r.prepare.label || 'New volume').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 32) || 'New volume' };
      }
      out.attach = !!r.attach;
      return out;
    }
    case 'attach': return { op, path: diskPath(r.path), readOnly: !!r.readOnly || /\.iso$/i.test(r.path), noLetter: !!r.noLetter };
    case 'detach': case 'compact': case 'detail': return { op, path: diskPath(r.path) };
    case 'expand': return { op, path: diskPath(r.path, { ext: /\.(vhd|vhdx)$/i }), sizeMB: mb(r.sizeMB, 3, /\.vhd$/i.test(r.path) ? 2040 * 1024 : 64 * 1024 * 1024), extend: !!r.extend };
    case 'shrink': return { op, path: diskPath(r.path, { ext: /\.vhdx$/i }), sizeMB: r.sizeMB ? mb(r.sizeMB, 3, 64 * 1024 * 1024) : 0 };
    case 'convert': {
      if (!['dynamic', 'fixed'].includes(r.type)) throw new Error('Choose dynamic or fixed for the copy.');
      return { op, path: diskPath(r.path, { ext: /\.(vhd|vhdx)$/i }), dest: diskPath(r.dest, { exists: false, ext: /\.(vhd|vhdx)$/i }), type: r.type };
    }
    case 'merge': { const d = Math.round(Number(r.depth)); if (!(d >= 1 && d <= 16)) throw new Error('Merge between 1 and 16 parent levels.'); return { op, path: diskPath(r.path, { ext: /\.(vhd|vhdx)$/i }), depth: d }; }
    case 'pack': {
      if (!Array.isArray(r.items) || !r.items.length || r.items.length > 500) throw new Error('Drop between 1 and 500 files or folders.');
      const items = r.items.map((p) => { if (typeof p !== 'string' || !path.isAbsolute(p) || !fs.existsSync(p)) throw new Error(`${p} is not there any more.`); return p; });
      const parents = new Set(items.map((p) => path.dirname(p)));
      if (parents.size > 1) throw new Error('Drop items from one folder at a time, so the new disk can sit beside them.');
      return { op, items };
    }
  }
  throw new Error(`${op} is not a virtual disk operation.`);
}
const ELEVATED = new Set(['create', 'attach', 'detach', 'expand', 'shrink', 'compact', 'convert', 'merge', 'detail', 'pack']);

const stripBom = (s) => s.replace(/^﻿/, '');
/** Runs one operation. onProgress receives each progress line the script writes. */
async function run(op, request, onProgress) {
  if (process.platform !== 'win32') throw windowsOnly();
  const clean = validate(op, request);
  const job = path.join(dataDir(), 'vdisk-jobs', `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
  fs.mkdirSync(job, { recursive: true });
  // PowerShell cannot read inside the app archive, so the script is copied out first.
  const script = path.join(dataDir(), 'vdisk-jobs', 'vdisk.ps1');
  const body = fs.readFileSync(SCRIPT);
  if (!fs.existsSync(script) || !fs.readFileSync(script).equals(body)) fs.writeFileSync(script, body);
  const req = path.join(job, 'request.json'), res = path.join(job, 'result.json'), prog = path.join(job, 'progress.jsonl');
  fs.writeFileSync(req, JSON.stringify(clean));
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const inner = `-NoProfile -ExecutionPolicy Bypass -File "${script}" -Request "${req}" -Result "${res}" -Progress "${prog}"`;
  const command = ELEVATED.has(op)
    ? `$p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList ${q(inner)}; exit $p.ExitCode`
    : `& powershell.exe ${inner}`;
  let seen = 0;
  const poll = setInterval(() => {
    try {
      const lines = stripBom(fs.readFileSync(prog, 'utf8')).split(/\r?\n/).filter(Boolean);
      for (const l of lines.slice(seen)) { try { onProgress?.(JSON.parse(stripBom(l))); } catch { /* partial line */ } }
      seen = lines.length;
    } catch { /* not written yet */ }
  }, 400);
  const exit = await new Promise((resolve) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, err }));
    p.on('error', (e) => resolve({ code: -1, err: e.message }));
  });
  clearInterval(poll);
  if (!fs.existsSync(res)) {
    if (/cancel/i.test(exit.err)) { const e = new Error('Windows did not get permission, so nothing was changed.'); e.code = 'CANCELLED'; throw e; }
    throw new Error(`The disk helper stopped before it wrote a result (exit ${exit.code}). ${exit.err.trim().split(/\r?\n/).slice(-2).join(' ')}`);
  }
  const out = JSON.parse(stripBom(fs.readFileSync(res, 'utf8')));
  try { fs.rmSync(job, { recursive: true, force: true }); } catch { /* left for the next start */ }
  if (!out.ok) { const e = new Error(out.error); e.steps = out.steps; throw Object.assign(e, { code: 'FAILED' }); }
  return out;
}

/** Sizes of what was dropped, read here without elevation, for the Quick pack plan. */
function measure(items) {
  let files = 0, bytes = 0;
  const walk = (p) => {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const e of fs.readdirSync(p)) walk(path.join(p, e)); return; }
    files++; bytes += st.size;
  };
  for (const p of items) walk(p);
  const sizeMB = Math.max(64, Math.ceil(((bytes + files * 4096 + Math.max(64 * 1024 * 1024, bytes * 0.03)) * 1.1) / (1024 * 1024)));
  const first = items[0];
  const base = fs.statSync(first).isDirectory() ? path.basename(first) : path.parse(first).name;
  let dest = path.join(path.dirname(first), `${base}.vhdx`), n = 2;
  while (fs.existsSync(dest)) dest = path.join(path.dirname(first), `${base} (${n++}).vhdx`);
  return { files, bytes, sizeMB, dest };
}

module.exports = { setup, run, validate, measure, windowsOnly, SCRIPT };
