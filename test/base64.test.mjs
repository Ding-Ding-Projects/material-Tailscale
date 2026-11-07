// Base64 toolkit: every variant and option round-trips, strict decoding reports exact offsets,
// data: URLs, bounded type detection, file naming, the incremental SHA-256 and ZIP writer, and
// real same-folder conversions on disk (never overwriting, cancel and pause, constant memory).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import v8 from 'node:v8';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const B = require('../src/shared/base64.js');
const Z = require('../src/shared/zip-store.js');
const F = require('../src/main/base64-files.js');

const bytesOf = (s) => new Uint8Array(Buffer.from(s));
const decodeAll = (text, o) => Buffer.from(B.decode(text, o).bytes);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mt-b64-test-'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

test('every variant, padding, line length and line ending round-trips, in chunks of any size', () => {
  const rnd = (n) => Math.floor(Math.random() * n);
  for (let len = 1; len < 70; len++) {
    const data = crypto.randomBytes(len);
    for (const variant of ['std', 'url', 'mime']) for (const pad of [true, false]) for (const lineLength of [0, 4, 10, 64, 76]) for (const eol of ['\r\n', '\n']) for (const strict of [true, false]) {
      const o = { variant, pad, lineLength, eol, strict };
      const enc = B.createEncoder(o);
      let text = '';
      for (let i = 0; i < len;) { const n = 1 + rnd(9); text += enc.push(data.subarray(i, i + n)); i += n; }
      text += enc.end();
      const dec = B.createDecoder(o);
      const parts = [];
      for (let i = 0; i < text.length;) { const n = 1 + rnd(11); parts.push(dec.push(text.slice(i, i + n))); i += n; }
      parts.push(dec.end());
      assert.deepEqual(Buffer.concat(parts.map((p) => Buffer.from(p))), data, JSON.stringify(o));
    }
  }
});

test('output matches the RFC 4648 test vectors and each variant has its own shape', () => {
  const vectors = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg=='], ['fooba', 'Zm9vYmE='], ['foobar', 'Zm9vYmFy']];
  for (const [plain, want] of vectors) assert.equal(B.encode(bytesOf(plain), {}), want);
  assert.equal(B.encode(Uint8Array.from([0xfb, 0xff]), { variant: 'url' }), '-_8=');
  assert.equal(B.encode(Uint8Array.from([0xfb, 0xff]), { variant: 'url', pad: false }), '-_8');
  const long = B.encode(new Uint8Array(100), { variant: 'mime' });
  assert.deepEqual(long.split('\r\n').map((l) => l.length), [76, 60]);
  assert.equal(B.encode(new Uint8Array(30), { lineLength: 16, eol: '\n' }).split('\n').map((l) => l.length).join(','), '16,16,8');
  assert.equal(B.options({ variant: 'mime', pad: false }).pad, true, 'MIME always pads');
});

test('strict decoding reports the exact offset and the reason for each problem', () => {
  const fail = (text, o, code, offset, detail) => {
    assert.throws(() => B.decode(text, o), (e) => e instanceof B.Base64Error && e.code === code && e.offset === offset && (detail === undefined || e.detail === detail), `${JSON.stringify(text)} -> ${code}@${offset}`);
  };
  fail('QUJD*RA==', {}, 'invalid-char', 4, '*');
  fail('QUJD RA==', {}, 'invalid-char', 4, ' ');
  fail('QUJDRA', {}, 'wrong-padding', 6, 'missing');
  fail('QUJDRA===', {}, 'wrong-padding', 8, 'too-many');
  fail('QUJD=', {}, 'wrong-padding', 4, 'misplaced');
  fail('QUJDRA==QQ==', {}, 'wrong-padding', 8, 'data-after');
  fail('QUJDRA==', { pad: false }, 'wrong-padding', 6, 'unexpected');
  fail('QUJD\nRA==', {}, 'invalid-char', 4, '\n');
  fail('QUJD-_==', {}, 'invalid-char', 4, '-');
  fail('QUJD+/==', { variant: 'url' }, 'invalid-char', 4, '+');
  fail('QUJDR', {}, 'truncated', 4);
  fail('', {}, 'empty', 0);
  fail('data:text/plain,hi', {}, 'data-url', 0, 'not-base64');
  fail('QUJDÄ', {}, 'invalid-char', 4, 'Ä');
  // The offset counts everything before it, across chunks.
  const d = B.createDecoder({});
  d.push('QUJD'); d.push('QUJD');
  assert.throws(() => d.push('QU*D'), (e) => e.offset === 10);
});

test('strict decoding accepts line breaks where the format puts them and a final newline', () => {
  assert.equal(decodeAll('QUJDRA==\n', {}).toString(), 'ABCD');
  assert.equal(decodeAll('QUJDRA==\r\n', {}).toString(), 'ABCD');
  const words = 'Material Tailscale makes Base64 boring again, one seventy-six character line at a time.';
  const wrapped = B.encode(bytesOf(words), { variant: 'mime' });
  assert.match(wrapped, /\r\n/);
  assert.equal(decodeAll(wrapped, { variant: 'mime' }).toString(), words);
  assert.equal(decodeAll(B.encode(new Uint8Array(40), { lineLength: 8 }), { lineLength: 8 }).length, 40);
});

test('lenient decoding skips whitespace, mixes alphabets, accepts missing padding and joined blocks', () => {
  const o = { strict: false };
  assert.equal(decodeAll(' QU JD\tRA\r\n', o).toString(), 'ABCD');
  assert.equal(decodeAll('QUJDRA', o).toString(), 'ABCD');
  assert.equal(decodeAll('QUJDRA=', o).toString(), 'ABCD');
  assert.deepEqual([...decodeAll('-_8', o)], [0xfb, 0xff]);
  assert.equal(decodeAll('QQ==QQ==', o).toString(), 'AA');
  assert.throws(() => B.decode('QUJD*', o), (e) => e.code === 'invalid-char' && e.offset === 4);
});

test('padding must matter: dropping it on encode or ignoring it on decode turns this red', () => {
  // Red-then-green guard: these hold only while padding is written and checked.
  assert.equal(B.encode(bytesOf('ab'), {}), 'YWI=');
  assert.equal(B.encode(bytesOf('ab'), { pad: false }), 'YWI');
  assert.throws(() => B.decode('YWI', {}), (e) => e.code === 'wrong-padding' && e.detail === 'missing');
  assert.equal(decodeAll('YWI=', {}).toString(), 'ab');
});

test('data: URLs are built and read back with their type and parameters', () => {
  const url = B.buildDataUrl('text/plain', B.encode(bytesOf('hi there'), {}), { charset: 'UTF-8' });
  assert.equal(url, 'data:text/plain;charset=UTF-8;base64,aGkgdGhlcmU=');
  const r = B.dataUrlBytes(url, {});
  assert.equal(r.mime, 'text/plain');
  assert.equal(r.params.charset, 'UTF-8');
  assert.equal(Buffer.from(r.bytes).toString(), 'hi there');
  const plain = B.dataUrlBytes('data:,A%20brief%20note', {});
  assert.equal(plain.mime, 'text/plain');
  assert.equal(plain.base64, false);
  assert.equal(Buffer.from(plain.bytes).toString(), 'A brief note');
  const png = B.decode('data:image/png;base64,iVBORw0KGgo=', {});
  assert.equal(png.dataUrl.mime, 'image/png');
  // A data: header in a stream, split across pushes.
  const d = B.createDataAwareDecoder({});
  const out = [d.push('da'), d.push('ta:image/gif;bas'), d.push('e64,R0lGODlh'), d.end()];
  assert.equal(Buffer.concat(out.map((x) => Buffer.from(x))).toString(), 'GIF89a');
  assert.equal(d.dataUrl.mime, 'image/gif');
});

test('type detection looks at no more than the first 4 KiB and names common formats', () => {
  const cases = [
    [Buffer.from('89504e470d0a1a0a', 'hex'), 'png'], [Buffer.from('ffd8ffe0', 'hex'), 'jpg'], [Buffer.from('GIF89a'), 'gif'],
    [Buffer.from('%PDF-1.7\n'), 'pdf'], [Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(26), Buffer.from('word/document.xml')]), 'docx'],
    [Buffer.from('504b030414', 'hex'), 'zip'], [Buffer.from('1f8b08', 'hex'), 'gz'], [Buffer.from('ID3\x03'), 'mp3'], [Buffer.from('OggS'), 'ogg'],
    [Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')]), 'mp4'], [Buffer.from('1a45dfa3', 'hex'), 'mkv'], [Buffer.from('MZ\x90\x00'), 'exe'],
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'svg'], [Buffer.from('<!DOCTYPE html><title>x</title>'), 'html'], [Buffer.from('{"a":1}'), 'json'],
    [Buffer.from('Plain words.\n'), 'txt'], [Buffer.from([0, 1, 2, 3, 250]), 'bin']
  ];
  for (const [b, ext] of cases) assert.equal(B.sniff(new Uint8Array(b)).ext, ext, ext);
  // A ZIP marker past the window is not seen: the inspection is bounded.
  const late = Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(5000), Buffer.from('word/')]);
  assert.equal(B.sniff(new Uint8Array(late)).ext, 'zip');
});

test('names: full name plus .base64.txt out, the original name back, numbered when taken', () => {
  assert.equal(B.encodedName('report.pdf'), 'report.pdf.base64.txt');
  assert.deepEqual(B.restoredName('report.pdf.base64.txt'), { name: 'report.pdf', source: 'name' });
  assert.deepEqual(B.restoredName('report.pdf.base64 (2).txt'), { name: 'report.pdf', source: 'name' });
  assert.deepEqual(B.restoredName('Makefile.base64.txt'), { name: 'Makefile', source: 'name' });
  assert.deepEqual(B.restoredName('photo.jpg.b64'), { name: 'photo.jpg', source: 'name' });
  assert.deepEqual(B.restoredName('notes.txt', { dataMime: 'image/webp' }), { name: 'notes.webp', source: 'data-url' });
  assert.deepEqual(B.restoredName('blob.b64', { sniffed: { ext: 'png' } }), { name: 'blob.png', source: 'signature' });
  assert.deepEqual(B.restoredName('mystery.txt', { sniffed: { ext: 'bin' } }), { name: 'mystery.bin', source: 'fallback' });
  assert.equal(B.numbered('report.pdf', 1), 'report (1).pdf');
  assert.equal(B.numbered('report.pdf.base64.txt', 2), 'report.pdf.base64 (2).txt');
  assert.equal(B.numbered('README', 3), 'README (3)');
  assert.equal(B.safeName('CON.txt'), '_CON.txt');
  assert.equal(B.safeName('a:b?.txt'), 'a_b_.txt');
});

test('the incremental SHA-256 matches Node for any chunking', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 100003]) {
    const data = crypto.randomBytes(n);
    const h = B.createSha256();
    for (let i = 0; i < n; i += 37) h.update(data.subarray(i, i + 37));
    assert.equal(h.hex(), sha(data), String(n));
  }
});

test('text encodings: UTF-8, UTF-16 both ways and Latin-1, with an honest refusal', () => {
  assert.deepEqual([...B.textToBytes('é', 'utf-8')], [0xc3, 0xa9]);
  assert.deepEqual([...B.textToBytes('é', 'utf-16le')], [0xe9, 0x00]);
  assert.deepEqual([...B.textToBytes('é', 'utf-16be')], [0x00, 0xe9]);
  assert.deepEqual([...B.textToBytes('é', 'latin1')], [0xe9]);
  assert.throws(() => B.textToBytes('😀', 'latin1'), (e) => e.code === 'unsupported-encoding' && e.offset === 0);
  for (const enc of ['utf-8', 'utf-16le', 'utf-16be']) assert.equal(B.bytesToText(B.textToBytes('Tailnet 你好', enc), enc), 'Tailnet 你好');
  assert.throws(() => B.bytesToText(Uint8Array.from([0xff, 0xfe, 0xfd]), 'utf-8'), (e) => e.code === 'unsupported-encoding');
});

test('the ZIP writer produces an archive 7-Zip lists and extracts byte for byte', () => {
  const dir = tmp();
  const files = [['report.pdf.base64.txt', Buffer.from('JVBERi0x')], ['route (1).png', crypto.randomBytes(3000)], ['筆記.txt', Buffer.from('hello')]];
  const parts = Z.zipParts(files.map(([name, data]) => ({ name, data: new Uint8Array(data), size: data.length, crc: Z.crc32(data), date: new Date(2026, 10, 7, 9, 30) })));
  const zip = path.join(dir, 'out.zip');
  fs.writeFileSync(zip, Buffer.concat(parts.map((p) => Buffer.from(p))));
  const bin = require('7zip-bin').path7za;
  const env = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }; // so 7-Zip writes UTF-8 names on Linux
  const t = spawnSync(bin, ['t', zip], { encoding: 'utf8', env });
  assert.equal(t.status, 0, t.stdout + t.stderr);
  const x = spawnSync(bin, ['x', zip, `-o${path.join(dir, 'x')}`, '-y'], { encoding: 'utf8', env });
  assert.equal(x.status, 0, x.stdout + x.stderr);
  for (const [name, data] of files) assert.deepEqual(fs.readFileSync(path.join(dir, 'x', name)), data, name);
  assert.equal(Z.crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('same folder: encoding writes name.ext.base64.txt beside the file and never overwrites', async () => {
  const dir = tmp();
  const src = path.join(dir, 'report.pdf');
  const data = Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(5000)]);
  fs.writeFileSync(src, data);
  const a = await F.encodeBeside(src, {}, { id: 'enc-a' });
  assert.equal(a.path, path.join(dir, 'report.pdf.base64.txt'));
  assert.equal(fs.readFileSync(a.path, 'latin1'), data.toString('base64'));
  assert.equal(a.sha256, sha(data));
  assert.equal(a.verified && a.roundTrip, true);
  const b = await F.encodeBeside(src, { variant: 'mime' }, { id: 'enc-b' });
  assert.equal(path.basename(b.path), 'report.pdf.base64 (1).txt');
  assert.equal(fs.readFileSync(a.path, 'latin1'), data.toString('base64'), 'the first result is untouched');
  assert.deepEqual(fs.readFileSync(src), data, 'the source is untouched');
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.partial')), [], 'no partial files are left');
});

test('same folder: decoding restores the name and extension, numbering instead of overwriting', async () => {
  const dir = tmp();
  const original = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(2000)]);
  fs.writeFileSync(path.join(dir, 'map.png'), original);
  const text = path.join(dir, 'map.png.base64.txt');
  fs.writeFileSync(text, original.toString('base64'));
  const r = await F.decodeBeside(text, {}, { id: 'dec-a' });
  assert.equal(path.basename(r.path), 'map (1).png', 'map.png exists, so the result is numbered');
  assert.deepEqual(fs.readFileSync(r.path), original);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'map.png')), original, 'the existing file is untouched');
  assert.equal(r.nameSource, 'name');
  assert.equal(r.verified && r.roundTrip, true);
  // A data: URL in a plain .txt gives the extension from its type.
  fs.writeFileSync(path.join(dir, 'pasted.txt'), 'data:image/gif;base64,R0lGODlhAQABAAAAACw=');
  const g = await F.decodeBeside(path.join(dir, 'pasted.txt'), {}, { id: 'dec-b' });
  assert.equal(path.basename(g.path), 'pasted.gif');
  assert.equal(g.nameSource, 'data-url');
  // No pattern and no data: header: the signature decides; nothing recognisable gives .bin.
  fs.writeFileSync(path.join(dir, 'clip.txt'), Buffer.from('%PDF-1.5 hello').toString('base64') + '\n');
  assert.equal(path.basename((await F.decodeBeside(path.join(dir, 'clip.txt'), {}, { id: 'dec-c' })).path), 'clip.pdf');
  fs.writeFileSync(path.join(dir, 'noise.b64'), Buffer.from([0, 1, 2, 3, 250, 251]).toString('base64'));
  const n = await F.decodeBeside(path.join(dir, 'noise.b64'), {}, { id: 'dec-d' });
  assert.equal(path.basename(n.path), 'noise.bin');
  assert.equal(n.nameSource, 'fallback');
});

test('same folder: a round trip through encode and decode gives back the identical file', async () => {
  const dir = tmp();
  const src = path.join(dir, 'archive.tar.gz');
  const data = Buffer.concat([Buffer.from('1f8b08', 'hex'), crypto.randomBytes(3 * 256 * 1024 + 17)]);
  fs.writeFileSync(src, data);
  for (const o of [{}, { variant: 'url', pad: false }, { variant: 'mime' }, { lineLength: 64, eol: '\n' }]) {
    const e = await F.encodeBeside(src, o, { id: 'rt-e' });
    fs.renameSync(src, src + '.moved');
    const d = await F.decodeBeside(e.path, o, { id: 'rt-d' });
    assert.equal(d.path, src, JSON.stringify(o));
    assert.deepEqual(fs.readFileSync(d.path), data);
    fs.rmSync(e.path); fs.rmSync(d.path); fs.renameSync(src + '.moved', src);
  }
});

test('same folder: a bad character fails with its offset and keeps nothing', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'broken.base64.txt'), 'SGVsbG8sIHRhaWxuZXQh*IQ==');
  const r = await F.run('decode', path.join(dir, 'broken.base64.txt'), {}, { id: 'bad' });
  assert.equal(r.failed.code, 'invalid-char');
  assert.equal(r.failed.offset, 20);
  assert.deepEqual(fs.readdirSync(dir), ['broken.base64.txt'], 'no output and no partial file');
});

test('same folder: cancel stops and removes the partial file; pause holds and resume finishes', async () => {
  const dir = tmp();
  const src = path.join(dir, 'big.bin');
  fs.writeFileSync(src, crypto.randomBytes(8 * F.CHUNK));
  let steps = 0;
  const cancelled = F.run('encode', src, {}, { id: 'cancel-me', onProgress: () => { if (++steps === 2) F.control('cancel-me', 'cancel'); } });
  const r = await cancelled;
  assert.equal(r.failed.code, 'cancelled');
  assert.deepEqual(fs.readdirSync(dir), ['big.bin']);
  let paused = false;
  let held = 0;
  const p = F.encodeBeside(src, {}, { id: 'pause-me', onProgress: () => { if (!paused) { paused = true; F.control('pause-me', 'pause'); setTimeout(() => F.control('pause-me', 'resume'), 150); } else held++; } });
  await new Promise((res) => setTimeout(res, 60));
  const atPause = held;
  await new Promise((res) => setTimeout(res, 60));
  assert.equal(held, atPause, 'no progress while paused');
  const done = await p;
  assert.equal(done.verified, true);
});

test('same folder: memory stays flat while a large file streams through both directions', async () => {
  const dir = tmp();
  const src = path.join(dir, 'large.bin');
  const fd = fs.openSync(src, 'w');
  const block = crypto.randomBytes(1024 * 1024);
  for (let i = 0; i < 96; i++) fs.writeSync(fd, block);
  fs.closeSync(fd);
  // Measure what stays alive, not garbage waiting for collection: collect, then measure.
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  gc();
  const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.external; };
  const base = used();
  let peak = 0, n = 0;
  const watch = () => { if (++n % 8) return; gc(); peak = Math.max(peak, used() - base); };
  const e = await F.encodeBeside(src, {}, { id: 'big-e', onProgress: watch });
  fs.renameSync(src, src + '.orig');
  const d = await F.decodeBeside(e.path, {}, { id: 'big-d', onProgress: watch });
  assert.equal(d.sha256, sha(fs.readFileSync(src + '.orig')));
  assert.ok(n > 100, 'progress was reported throughout');
  assert.ok(peak < 16 * 1024 * 1024, `live memory peaked ${Math.round(peak / 1048576)} MiB above the start for a 96 MiB file`);
});
