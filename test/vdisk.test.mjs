import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vdisk = require('../src/main/vdisk.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mt-vd-'));

test('requests are checked before anything runs', () => {
  const dir = tmp();
  const exists = path.join(dir, 'old.vhdx'); fs.writeFileSync(exists, 'x');
  assert.throws(() => vdisk.validate('create', { path: 'relative.vhdx', type: 'dynamic', sizeMB: 64 }), /file picker/);
  assert.throws(() => vdisk.validate('create', { path: path.join(dir, 'a.img'), type: 'dynamic', sizeMB: 64 }), /\.vhd, \.vhdx/);
  assert.throws(() => vdisk.validate('create', { path: exists, type: 'dynamic', sizeMB: 64 }), /is ever overwritten/);
  assert.throws(() => vdisk.validate('create', { path: path.join(dir, 'big.vhd'), type: 'dynamic', sizeMB: 2041 * 1024 }), /between 3 MB/);
  assert.equal(vdisk.validate('create', { path: path.join(dir, 'big.vhdx'), type: 'dynamic', sizeMB: 2041 * 1024 }).sizeMB, 2041 * 1024);
  assert.throws(() => vdisk.validate('create', { path: path.join(dir, 'n.vhdx'), type: 'sparse', sizeMB: 64 }), /dynamic, fixed or differencing/);
  assert.throws(() => vdisk.validate('create', { path: path.join(dir, 'n.vhdx'), type: 'dynamic', sizeMB: 64, prepare: { style: 'GPT', fs: 'ext4' } }), /NTFS/);
  assert.equal(vdisk.validate('create', { path: path.join(dir, 'n.vhdx'), type: 'dynamic', sizeMB: 64, prepare: { style: 'GPT', fs: 'NTFS', label: 'A "quoted" label;' } }).prepare.label, 'A quoted label');
  assert.throws(() => vdisk.validate('convert', { path: exists, dest: exists, type: 'dynamic' }), /is ever overwritten/);
  assert.throws(() => vdisk.validate('merge', { path: exists, depth: 40 }), /between 1 and 16/);
  assert.throws(() => vdisk.validate('shrink', { path: path.join(dir, 'x.vhd') }), /\.vhd, \.vhdx/);
  assert.equal(vdisk.validate('attach', { path: exists }).readOnly, false);
  assert.throws(() => vdisk.validate('format', {}), /not a virtual disk operation/);
  const a = path.join(dir, 'a'); const b = path.join(dir, 'sub', 'b'); fs.mkdirSync(path.dirname(b), { recursive: true }); fs.writeFileSync(a, '1'); fs.writeFileSync(b, '2');
  assert.throws(() => vdisk.validate('pack', { items: [a, b] }), /one folder at a time/);
});

test('Quick pack sizes the disk to fit and never takes a name that exists', () => {
  const dir = tmp();
  const photos = path.join(dir, 'Holiday photos'); fs.mkdirSync(photos);
  for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(photos, `p${i}.jpg`), Buffer.alloc(100000 + i));
  const m = vdisk.measure([photos]);
  assert.equal(m.files, 20);
  assert.equal(m.bytes, 20 * 100000 + 190);
  assert.equal(m.dest, path.join(dir, 'Holiday photos.vhdx'));
  assert.ok(m.sizeMB >= 64);
  fs.writeFileSync(m.dest, 'already here');
  fs.writeFileSync(path.join(dir, 'Holiday photos (2).vhdx'), 'and this one');
  assert.equal(vdisk.measure([photos]).dest, path.join(dir, 'Holiday photos (3).vhdx'));
});

test('on systems other than Windows every operation says so instead of pretending', async () => {
  if (process.platform === 'win32') return;
  await assert.rejects(vdisk.run('probe', {}), (e) => e.code === 'WINDOWS_ONLY');
});

test('the disk script checks before it writes and never overwrites or deletes a disk', () => {
  const ps = fs.readFileSync(vdisk.SCRIPT, 'utf8');
  for (const [op, guard] of [['create', 'NeedNew $req.path'], ['convert', 'NeedNew $req.dest'], ['expand', 'NeedDetached $req.path'], ['merge', 'NeedDetached $req.path'], ['shrink', 'NeedDetached $req.path']]) {
    const body = ps.slice(ps.indexOf(`'${op}' {`), ps.indexOf("\n    '", ps.indexOf(`'${op}' {`) + 5));
    assert.ok(body.includes(guard), `${op} must call ${guard}`);
  }
  assert.match(ps, /while \(Test-Path -LiteralPath \$dest\)/, 'Quick pack must step past names that exist');
  assert.match(ps, /Get-FileHash -LiteralPath \$f\.Src -Algorithm SHA256/, 'Quick pack must hash every source file');
  assert.match(ps, /\$a -ne \$b/, 'Quick pack must compare every copy with its source');
  // The only file the script ever removes is its own temporary DiskPart script.
  const removes = [...ps.matchAll(/Remove-Item[^\n]*/g)].map((m) => m[0]);
  assert.deepEqual(removes, ['Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue }']);
  assert.doesNotMatch(ps, /\bdelete vdisk\b|\bclean\b/i);
});

test('anything that changes a disk goes through Windows permission', () => {
  const src = fs.readFileSync(path.join(path.dirname(vdisk.SCRIPT), '..', 'vdisk.js'), 'utf8');
  const set = src.match(/const ELEVATED = new Set\(\[([^\]]*)\]\)/)[1];
  for (const op of ['create', 'attach', 'detach', 'expand', 'shrink', 'compact', 'convert', 'merge', 'pack']) assert.ok(set.includes(`'${op}'`), `${op} must be elevated`);
  assert.match(src, /Start-Process -FilePath powershell\.exe -Verb RunAs/);
  assert.match(src, /Windows did not get permission, so nothing was changed\./);
});
