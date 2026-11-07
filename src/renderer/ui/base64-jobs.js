// File conversions for the Base64 toolkit. On the desktop the main process converts each file
// beside its source (src/main/base64-files.js). The website cannot write next to a file, so it
// runs the same conversion in the page and downloads the result under the same name. Either
// way a job reports progress, can be paused, resumed or cancelled, and is only "done" after a
// SHA-256 round trip; a failed or cancelled job keeps no output.
import B from '../../shared/base64.js';
import { crc32 } from '../../shared/zip-store.js';

const CHUNK = 3 * 256 * 1024;
const TEXT_CHUNK = 1024 * 1024;

export const isSite = () => !!window.mt?.site;

/** Starts a browser download of a Blob under the given name. */
export function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/** In-page conversion for the website: same naming, same verification, a download at the end. */
async function convertInPage(job, file, opts, report) {
  const o = B.options(opts);
  const gate = async () => {
    while (job.paused && !job.cancelled) await new Promise((r) => { job.wake = r; });
    if (job.cancelled) throw Object.assign(new Error('Cancelled.'), { code: 'cancelled' });
  };
  const parts = [];
  let crc = 0, size = 0;
  const emit = (data) => { if (!data.length) return; const bytes = typeof data === 'string' ? latin1Bytes(data) : data; crc = crc32(bytes, crc); size += bytes.length; parts.push(bytes); };
  if (job.kind === 'encode') {
    const hashIn = B.createSha256();
    const enc = B.createEncoder(o);
    for (let off = 0; off < file.size; off += CHUNK) {
      await gate();
      const chunk = new Uint8Array(await file.slice(off, off + CHUNK).arrayBuffer());
      hashIn.update(chunk);
      emit(enc.push(chunk));
      report({ phase: 'encode', done: Math.min(file.size, off + CHUNK), total: file.size });
    }
    emit(enc.end());
    const blob = new Blob(parts, { type: 'text/plain' });
    const want = hashIn.hex();
    const got = await hashOfDecodedBlob(blob, { ...o, strict: true }, gate, (n) => report({ phase: 'verify', done: n, total: blob.size }));
    if (got !== want) throw Object.assign(new Error('The Base64 did not decode back to the same bytes, so nothing was kept.'), { code: 'verify-failed' });
    const name = B.encodedName(file.name);
    downloadBlob(name, blob);
    return { kind: 'encode', name, bytes: file.size, chars: enc.chars, written: blob.size, sha256: want, verified: true, roundTrip: true, options: o, blob, crc, downloaded: true };
  }
  // decode
  const dec = B.createDataAwareDecoder(o);
  const hashOut = B.createSha256();
  const hashChars = B.createSha256();
  const td = new TextDecoder('utf-8');
  let head = new Uint8Array(0);
  let inHeader = true;
  let pending = '';
  const normal = (text) => {
    if (inHeader && dec.dataUrl) { const c = text.indexOf(','); if (c >= 0) text = text.slice(c + 1); inHeader = false; }
    return text.replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  };
  const take = (bytes, text) => {
    if (bytes.length) {
      hashOut.update(bytes);
      if (head.length < B.SNIFF_WINDOW) { const m = new Uint8Array(Math.min(B.SNIFF_WINDOW, head.length + bytes.length)); m.set(head); m.set(bytes.subarray(0, m.length - head.length), head.length); head = m; }
      emit(bytes);
    }
    if (text) hashChars.update(latin1Bytes(normal(text)));
  };
  for (let off = 0; off < file.size; off += TEXT_CHUNK) {
    await gate();
    const text = td.decode(new Uint8Array(await file.slice(off, off + TEXT_CHUNK).arrayBuffer()), { stream: true });
    const bytes = dec.push(text);
    pending += text;
    if (bytes.length || pending.length > 8192) { take(bytes, pending); pending = ''; }
    report({ phase: 'decode', done: Math.min(file.size, off + TEXT_CHUNK), total: file.size });
  }
  const rest = td.decode();
  take(dec.push(rest), pending + rest);
  take(dec.end(), '');
  const sniffed = B.sniff(head);
  const restored = B.restoredName(file.name, { dataMime: dec.dataUrl?.mime, sniffed });
  const type = dec.dataUrl?.mime || sniffed.mime;
  const blob = new Blob(parts, { type });
  // Read the result back: same bytes, and the same characters when encoded again.
  const back = B.createSha256();
  const again = B.createSha256();
  const reenc = B.createEncoder({ variant: 'std', pad: false });
  for (let off = 0; off < blob.size; off += CHUNK) {
    await gate();
    const chunk = new Uint8Array(await blob.slice(off, off + CHUNK).arrayBuffer());
    back.update(chunk); again.update(latin1Bytes(reenc.push(chunk)));
    report({ phase: 'verify', done: Math.min(blob.size, off + CHUNK), total: blob.size });
  }
  again.update(latin1Bytes(reenc.end()));
  const want = hashOut.hex();
  if (back.hex() !== want) throw Object.assign(new Error('The decoded file did not read back the same, so nothing was kept.'), { code: 'verify-failed' });
  const name = B.safeName(restored.name);
  downloadBlob(name, blob);
  return { kind: 'decode', name, bytes: blob.size, chars: file.size, written: blob.size, sha256: want, verified: true, roundTrip: again.hex() === hashChars.hex(), nameSource: restored.source, type: { mime: type, how: dec.dataUrl ? 'data: URL' : sniffed.how }, options: o, blob, crc, downloaded: true, head };
}

async function hashOfDecodedBlob(blob, opts, gate, step) {
  const dec = B.createDataAwareDecoder(opts);
  const hash = B.createSha256();
  for (let off = 0; off < blob.size; off += TEXT_CHUNK) {
    await gate();
    hash.update(dec.push(await blob.slice(off, off + TEXT_CHUNK).text()));
    step(Math.min(blob.size, off + TEXT_CHUNK));
  }
  hash.update(dec.end());
  return hash.hex();
}

function latin1Bytes(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }

/**
 * The job list. `onChange(list)` runs after every change. start(kind, { file, path }, options)
 * queues one conversion; jobs run one after another so progress stays readable.
 */
export function createJobs(onChange, { onFinished } = {}) {
  const list = [];
  let running = null;
  let off = null;
  const changed = () => onChange(list);
  const pump = async () => {
    if (running) return;
    const job = list.findLast((j) => j.state === 'queued'); // the list is newest first; run the oldest
    if (!job) return;
    running = job;
    job.state = 'running'; job.phase = job.kind; changed();
    const report = (p) => { job.phase = p.phase; job.done = p.done; job.total = p.total; changed(); };
    try {
      let r;
      if (job.path && !isSite()) {
        off = off || window.mt.b64.onProgress((p) => { const j = list.find((x) => x.id === p.id); if (j) { j.phase = p.phase; j.done = p.done; j.total = p.total; changed(); } });
        r = await window.mt.b64.convert(job.kind, job.path, job.options, job.id);
      } else {
        r = await convertInPage(job, job.file, job.options, report).catch((e) => ({ failed: { code: e.code || 'error', offset: e.offset, detail: e.detail, message: e.message } }));
      }
      if (r.failed) { job.state = r.failed.code === 'cancelled' ? 'cancelled' : 'failed'; job.error = r.failed; }
      else { job.state = 'done'; job.result = r; }
    } catch (e) {
      job.state = 'failed'; job.error = { code: e.code || 'error', message: e.message };
    }
    running = null;
    changed();
    onFinished?.(job);
    pump();
  };
  return {
    list,
    start(kind, src, options) {
      const job = { id: 'b64-' + Math.random().toString(36).slice(2, 10), kind, name: src.file?.name || src.path.split(/[\\/]/).pop(), size: src.file?.size ?? src.size ?? null, path: src.path || null, file: src.file || null, options: { ...options }, state: 'queued', done: 0, total: src.file?.size || 0, paused: false, cancelled: false, at: Date.now() };
      list.unshift(job);
      changed();
      pump();
      return job;
    },
    pause(job) { job.paused = true; if (job.path && !isSite()) window.mt.b64.control(job.id, 'pause'); job.state = job.state === 'running' ? 'paused' : job.state; changed(); },
    resume(job) { job.paused = false; if (job.path && !isSite()) window.mt.b64.control(job.id, 'resume'); job.wake?.(); if (job.state === 'paused') job.state = 'running'; changed(); },
    cancel(job) {
      job.cancelled = true;
      if (job.state === 'queued') { job.state = 'cancelled'; changed(); return; }
      if (job.path && !isSite()) window.mt.b64.control(job.id, 'cancel');
      job.wake?.();
    },
    remove(job) { const i = list.indexOf(job); if (i >= 0 && !['running', 'paused'].includes(job.state)) { list.splice(i, 1); changed(); } },
    clearFinished() { for (let i = list.length - 1; i >= 0; i--) if (['done', 'failed', 'cancelled'].includes(list[i].state)) list.splice(i, 1); changed(); },
    dispose() { off?.(); off = null; }
  };
}

