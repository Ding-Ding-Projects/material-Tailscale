'use strict';
// Same-folder Base64 conversions for the toolkit. Encoding writes "name.ext.base64.txt" beside
// the source; decoding writes the original file back beside its Base64 text with the name and
// extension restored (name pattern, then data: MIME type, then byte signature, then .bin).
//
// Every conversion streams in fixed-size chunks with progress, pause, resume and cancel, so
// memory stays flat for any file size. Output goes to a hidden ".partial" file in the same
// folder and only takes its final name once complete and verified, through an exclusive link
// or copy that fails rather than replace anything: a taken name gets " (1)", " (2)" and so on
// before the extension. Verification re-reads what was written and compares SHA-256 hashes.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const B = require('../shared/base64.js');

const CHUNK = 3 * 256 * 1024;   // bytes per encode step: a multiple of 3, so only the end pads
const TEXT_CHUNK = 1024 * 1024; // bytes of Base64 text per decode step

class Cancelled extends Error { constructor() { super('Cancelled.'); this.code = 'cancelled'; } }

const jobs = new Map();
function register(id) {
  const job = { id, paused: false, cancelled: false, wake: null };
  job.gate = async () => {
    while (job.paused && !job.cancelled) await new Promise((r) => { job.wake = r; });
    if (job.cancelled) throw new Cancelled();
  };
  if (id) jobs.set(id, job);
  return job;
}
function control(id, what) {
  const job = jobs.get(id);
  if (!job) return false;
  if (what === 'pause') job.paused = true;
  if (what === 'resume') { job.paused = false; job.wake?.(); }
  if (what === 'cancel') { job.cancelled = true; job.wake?.(); }
  return true;
}

const partialName = (dir, name, kind) => path.join(dir, `.${name}.${kind}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.partial`);

/**
 * Gives `tmp` the first free name among wanted, "stem (1).ext", "stem (2).ext"... without ever
 * replacing a file: a hard link fails when the name exists; where links are not supported
 * (FAT, exFAT, some network shares) an exclusive copy does the same job.
 */
async function claimName(dir, wanted, tmp) {
  for (let n = 0; n < 10000; n++) {
    const target = path.join(dir, B.numbered(wanted, n));
    try {
      await fsp.link(tmp, target);
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      if (!['EPERM', 'ENOTSUP', 'EXDEV', 'ENOSYS', 'EINVAL', 'EOPNOTSUPP'].includes(e.code)) throw e;
      try { await fsp.copyFile(tmp, target, fs.constants.COPYFILE_EXCL); } catch (e2) { if (e2.code === 'EEXIST') continue; throw e2; }
    }
    await fsp.unlink(tmp).catch(() => {});
    return target;
  }
  throw new Error('Could not find a free name for the result in that folder.');
}

/** SHA-256 of the bytes a Base64 text file decodes to, streamed. */
async function hashOfDecoded(file, opts, job, onStep) {
  const dec = B.createDataAwareDecoder(opts);
  const hash = crypto.createHash('sha256');
  const td = new TextDecoder('utf-8');
  const fh = await fsp.open(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(TEXT_CHUNK);
    let done = 0;
    for (;;) {
      await job.gate();
      const { bytesRead } = await fh.read(buf, 0, TEXT_CHUNK, null);
      if (!bytesRead) break;
      hash.update(dec.push(td.decode(buf.subarray(0, bytesRead), { stream: true })));
      done += bytesRead; onStep?.(done);
    }
    hash.update(dec.push(td.decode()));
    hash.update(dec.end());
  } finally { await fh.close(); }
  return hash.digest('hex');
}

/** Encodes `src` to "name.ext.base64.txt" in the same folder. */
async function encodeBeside(src, opts = {}, { id, onProgress } = {}) {
  const o = B.options(opts);
  const job = register(id);
  const dir = path.dirname(src);
  const name = path.basename(src);
  const st = await fsp.stat(src);
  if (!st.isFile()) throw new Error('Only files can be encoded.');
  const total = st.size;
  const tmp = partialName(dir, name, 'base64');
  const out = await fsp.open(tmp, 'wx');
  let keep = false;
  try {
    const fin = await fsp.open(src, 'r');
    const hashIn = crypto.createHash('sha256');
    const enc = B.createEncoder(o);
    let done = 0;
    try {
      const buf = Buffer.allocUnsafe(CHUNK);
      for (;;) {
        await job.gate();
        const { bytesRead } = await fin.read(buf, 0, CHUNK, null);
        if (!bytesRead) break;
        const chunk = buf.subarray(0, bytesRead);
        hashIn.update(chunk);
        const text = enc.push(chunk);
        if (text) await out.write(text, null, 'latin1');
        done += bytesRead;
        onProgress?.({ id, phase: 'encode', done, total });
      }
      const tail = enc.end();
      if (tail) await out.write(tail, null, 'latin1');
    } finally { await fin.close(); }
    await out.close();
    const want = hashIn.digest('hex');
    const written = (await fsp.stat(tmp)).size;
    const got = await hashOfDecoded(tmp, { ...o, strict: true }, job, (n) => onProgress?.({ id, phase: 'verify', done: n, total: written }));
    if (got !== want) throw Object.assign(new Error('The written Base64 did not decode back to the same bytes, so nothing was kept.'), { code: 'verify-failed' });
    await job.gate();
    const final = await claimName(dir, B.encodedName(name), tmp);
    keep = true;
    return { kind: 'encode', source: src, path: final, name: path.basename(final), bytes: total, chars: enc.chars, written, sha256: want, verified: true, roundTrip: true, options: o };
  } finally {
    if (!keep) { await out.close().catch(() => {}); await fsp.unlink(tmp).catch(() => {}); }
    jobs.delete(id);
  }
}

/**
 * Decodes a Base64 text file (plain, wrapped or a data: URL) to the original file in the same
 * folder. Verification: the file on disk hashes the same as the decoded bytes, and encoding it
 * again gives the same Base64 characters as the input (when the input was in canonical form).
 */
async function decodeBeside(src, opts = {}, { id, onProgress } = {}) {
  const o = B.options(opts);
  const job = register(id);
  const dir = path.dirname(src);
  const name = path.basename(src);
  const st = await fsp.stat(src);
  if (!st.isFile()) throw new Error('Only files can be decoded.');
  const total = st.size;
  const tmp = partialName(dir, name, 'decoded');
  const out = await fsp.open(tmp, 'wx');
  let keep = false;
  try {
    const dec = B.createDataAwareDecoder(o);
    const hashOut = crypto.createHash('sha256');
    const hashChars = crypto.createHash('sha256'); // the input's Base64 characters, normalised
    let head = new Uint8Array(0);
    let decoded = 0;
    let inHeader = true;
    const td = new TextDecoder('utf-8');
    const normal = (text) => {
      if (inHeader && dec.dataUrl) { const c = text.indexOf(','); if (c >= 0) { text = text.slice(c + 1); } inHeader = false; }
      return text.replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    };
    const take = async (bytes, text) => {
      if (bytes.length) {
        hashOut.update(bytes);
        if (head.length < B.SNIFF_WINDOW) { const m = new Uint8Array(Math.min(B.SNIFF_WINDOW, head.length + bytes.length)); m.set(head); m.set(bytes.subarray(0, m.length - head.length), head.length); head = m; }
        await out.write(bytes);
        decoded += bytes.length;
      }
      if (text) hashChars.update(normal(text), 'latin1');
    };
    const fin = await fsp.open(src, 'r');
    let done = 0;
    let pending = ''; // text read before the decoder knew whether a data: header was there
    try {
      const buf = Buffer.allocUnsafe(TEXT_CHUNK);
      for (;;) {
        await job.gate();
        const { bytesRead } = await fin.read(buf, 0, TEXT_CHUNK, null);
        if (!bytesRead) break;
        const text = td.decode(buf.subarray(0, bytesRead), { stream: true });
        const bytes = dec.push(text);
        pending += text;
        if (bytes.length || pending.length > 8192) { await take(bytes, pending); pending = ''; }
        done += bytesRead;
        onProgress?.({ id, phase: 'decode', done, total });
      }
      const rest = td.decode();
      await take(dec.push(rest), pending + rest);
      await take(dec.end(), '');
    } finally { await fin.close(); }
    await out.close();
    const sniffed = B.sniff(head);
    const restored = B.restoredName(name, { dataMime: dec.dataUrl?.mime, sniffed });
    const want = hashOut.digest('hex');
    const wantChars = hashChars.digest('hex');
    // Read the result back: its bytes must hash the same, and encoding them again must give
    // the same characters as the input (canonical input; padding and line breaks aside).
    const back = crypto.createHash('sha256');
    const again = crypto.createHash('sha256');
    const reenc = B.createEncoder({ variant: 'std', pad: false });
    const fh = await fsp.open(tmp, 'r');
    try {
      const buf = Buffer.allocUnsafe(CHUNK);
      let n = 0;
      for (;;) {
        await job.gate();
        const { bytesRead } = await fh.read(buf, 0, CHUNK, null);
        if (!bytesRead) break;
        back.update(buf.subarray(0, bytesRead));
        again.update(reenc.push(buf.subarray(0, bytesRead)), 'latin1');
        n += bytesRead; onProgress?.({ id, phase: 'verify', done: n, total: decoded });
      }
      again.update(reenc.end(), 'latin1');
    } finally { await fh.close(); }
    const got = back.digest('hex');
    if (got !== want) throw Object.assign(new Error('The written file did not read back the same, so nothing was kept.'), { code: 'verify-failed' });
    await job.gate();
    const final = await claimName(dir, B.safeName(restored.name), tmp);
    keep = true;
    return {
      kind: 'decode', source: src, path: final, name: path.basename(final), bytes: decoded, chars: total, written: decoded, sha256: want,
      verified: true, roundTrip: again.digest('hex') === wantChars, nameSource: restored.source, type: { mime: dec.dataUrl?.mime || sniffed.mime, how: dec.dataUrl ? 'data: URL' : sniffed.how }, options: o
    };
  } finally {
    if (!keep) { await out.close().catch(() => {}); await fsp.unlink(tmp).catch(() => {}); }
    jobs.delete(id);
  }
}

/** Runs one conversion and turns expected failures into a result the page can explain. */
async function run(kind, src, opts, ctx) {
  try {
    return await (kind === 'decode' ? decodeBeside : encodeBeside)(src, opts, ctx);
  } catch (e) {
    if (e instanceof B.Base64Error || e.code === 'cancelled' || e.code === 'verify-failed' || e.code === 'ENOENT' || e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'ENOSPC' || e.code === 'EROFS') {
      return { kind, source: src, failed: { code: e.code || 'error', offset: e.offset, detail: e.detail, message: e.message } };
    }
    throw e;
  }
}

module.exports = { encodeBeside, decodeBeside, run, control, claimName, CHUNK, TEXT_CHUNK };
