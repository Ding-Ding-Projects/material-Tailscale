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
  assert.throws(() => vdisk.validate('shrink', { path: path.join(dir, 'x.vhd') }), /Only a VHDX file can be shrunk/);
  assert.deepEqual(vdisk.validate('shrink', { path: exists }), { op: 'shrink', path: exists, sizeMB: 0, partition: false });
  assert.deepEqual(vdisk.validate('shrink', { path: exists, partition: true, keepMB: '256' }), { op: 'shrink', path: exists, sizeMB: 0, partition: true, keepMB: 256 });
  assert.throws(() => vdisk.validate('shrink', { path: exists, partition: true, keepMB: -1 }), /between 0 MB/);
  assert.equal(vdisk.validate('shrink', { path: exists, partition: 'yes' }).partition, false, 'only a real true shrinks a partition');
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
  // The script removes nothing: no disk, no copy, not even a temporary file.
  assert.deepEqual([...ps.matchAll(/Remove-Item[^\n]*/g)].map((m) => m[0]), []);
  // DiskPart reads its script in the console code page, so a path in Chinese reached it as an
  // unknown command on a real Windows runner. Every disk change goes through the virtual disk API.
  assert.doesNotMatch(ps.replace(/^#.*$/gm, ''), /diskpart/i, 'DiskPart must not come back');
  assert.doesNotMatch(ps, /Split-Path -LiteralPath [^\n]*-Parent/, 'Windows PowerShell 5.1 cannot resolve -LiteralPath with -Parent');
  assert.doesNotMatch(ps, /\bdelete vdisk\b|\bclean\b/i);
});

test('anything that changes a disk goes through Windows permission', () => {
  const src = fs.readFileSync(path.join(path.dirname(vdisk.SCRIPT), '..', 'vdisk.js'), 'utf8');
  const set = src.match(/const ELEVATED = new Set\(\[([^\]]*)\]\)/)[1];
  for (const op of ['create', 'attach', 'detach', 'expand', 'shrink', 'compact', 'convert', 'merge', 'pack']) assert.ok(set.includes(`'${op}'`), `${op} must be elevated`);
  assert.match(src, /Start-Process -FilePath powershell\.exe -Verb RunAs/);
  assert.match(src, /Windows did not get permission, so nothing was changed\./);
});

test('advanced operations check their file type, IDs and text before anything runs', () => {
  const dir = tmp();
  const vhdx = path.join(dir, 'a.vhdx'); fs.writeFileSync(vhdx, 'x');
  const vhds = path.join(dir, 'b.vhds'); fs.writeFileSync(vhds, 'x');
  const id = '5BADF5B3-BE2C-4EE6-8AF6-B8B30A573A5F';
  assert.deepEqual(vdisk.validate('identity', { path: vhdx, which: 'identifier' }), { op: 'identity', path: vhdx, which: 'identifier' });
  assert.throws(() => vdisk.validate('identity', { path: vhdx, which: 'serial' }), /disk identifier or the virtual disk ID/);
  assert.throws(() => vdisk.validate('identity', { path: vhds, which: 'identifier' }), /VHD and VHDX/);
  assert.equal(vdisk.validate('meta-set', { path: vhdx, text: 'Owner: me' }).item, null);
  assert.equal(vdisk.validate('meta-set', { path: vhdx, text: 'x', item: id }).item, id.toLowerCase());
  assert.throws(() => vdisk.validate('meta-set', { path: vhdx, text: '' }), /between 1 and 32,768/);
  assert.throws(() => vdisk.validate('meta-set', { path: vhdx, text: 'x'.repeat(32769) }), /between 1 and 32,768/);
  assert.throws(() => vdisk.validate('meta-set', { path: vhdx, text: 'x', item: 'not-a-guid' }), /not a valid ID/);
  assert.throws(() => vdisk.validate('meta-delete', { path: vhds, item: id }), /VHDX files only/);
  assert.equal(vdisk.validate('rct', { path: vhdx, enabled: 'yes' }).enabled, false, 'only a real true turns tracking on');
  assert.equal(vdisk.validate('rct-changes', { path: vhdx, since: 'rctX:ad2dca13:c0cf:479c:9158:4f5fe2d29c92:00000000' }).since, 'rctX:ad2dca13:c0cf:479c:9158:4f5fe2d29c92:00000000');
  assert.throws(() => vdisk.validate('rct-changes', { path: vhdx, since: 'rctX:"; Remove-Item C:\\' }), /change-tracking point/);
  assert.equal(vdisk.validate('checkpoint', { path: vhds, action: 'apply', id }).keep, true, 'returning keeps the current state unless told otherwise');
  assert.equal(vdisk.validate('checkpoint', { path: vhds, action: 'apply', id, keep: false }).keep, false);
  assert.throws(() => vdisk.validate('checkpoint', { path: vhds, action: 'delete' }), /not a valid ID/);
  assert.throws(() => vdisk.validate('checkpoint', { path: vhdx, action: 'take' }), /VHD Set/);
  assert.throws(() => vdisk.validate('checkpoint', { path: vhds, action: 'erase', id }), /Take, return to or delete/);
  assert.equal(vdisk.validate('mirror', { path: vhdx, dest: path.join(dir, 'm.vhdx') }).dest, path.join(dir, 'm.vhdx'));
  assert.throws(() => vdisk.validate('mirror', { path: vhdx, dest: path.join(dir, 'm.vhd') }), /keeps the disk's format/);
  assert.throws(() => vdisk.validate('mirror', { path: vhdx, dest: vhdx }), /is ever overwritten/);
  assert.equal(vdisk.validate('create', { path: path.join(dir, 'set.vhds'), type: 'dynamic', sizeMB: 1024 }).path, path.join(dir, 'set.vhds'));
  assert.throws(() => vdisk.validate('create', { path: path.join(dir, 'set2.vhds'), type: 'differencing', parent: vhdx }), /VHD Set is dynamic or fixed/);
  for (const op of ['advanced', 'identity', 'meta-set', 'meta-delete', 'rct', 'rct-changes', 'checkpoint', 'mirror']) assert.ok(vdisk.ELEVATED.has(op), `${op} must run elevated`);
});

test('the disk script guards every advanced change and creates VHD Sets through the API with the backing storage flag', () => {
  const ps = fs.readFileSync(vdisk.SCRIPT, 'utf8');
  const body = (op) => ps.slice(ps.indexOf(`'${op}' {`), ps.indexOf("\n    '", ps.indexOf(`'${op}' {`) + 5));
  for (const op of ['identity', 'meta-set', 'meta-delete']) assert.ok(body(op).includes('NeedDetached $req.path'), `${op} must refuse an attached disk`);
  assert.ok(body('mirror').includes('NeedNew $req.dest'), 'a mirror never overwrites');
  assert.match(body('checkpoint'), /if \(\$req\.action -ne 'take'\) \{ NeedDetached \$req\.path \}/, 'returning to or deleting a checkpoint needs the set detached');
  // Without CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE (0x8) Windows refuses a VHD Set with
  // "The parameter is incorrect"; with it a hosted Windows runner created, checkpointed, attached
  // and detached the set. Creating one therefore needs no Hyper-V.
  const create = ps.slice(ps.indexOf('public static void Create('), ps.indexOf('public static void Grow('));
  assert.match(create, /\(set \? 8u : 0u\)/, 'a VHD Set is created with the backing storage flag');
  assert.match(create, /if \(set && \(parent != null \|\| source != null\)\) throw/, 'a VHD Set starts empty');
  assert.doesNotMatch(ps, /New-VHD/, 'creating a VHD Set needs no Hyper-V');
  assert.match(body('create'), /'\\\.vhds\$'[\s\S]*\[MtVirtDisk\]::Create\(/, 'a .vhds path goes to the virtual disk API');
  assert.match(ps, /MirrorFree\(\$mem\)/, 'the mirror frees its memory only after the copy is over');
  assert.equal(/[^\x00-\x7F]/.test(ps), false, 'Windows PowerShell 5.1 reads this script in the ANSI code page, so it stays ASCII');
});

test('disk result codes become plain words, and shrinking never cuts a partition', () => {
  const ps = fs.readFileSync(new URL('../src/main/vdisk/vdisk.ps1', import.meta.url), 'utf8');
  // The virtual disk codes start at 0xC03A0000 and do not fit an Int32; a cast in PowerShell
  // turned a refused shrink into a type error on a real Windows runner.
  assert.doesNotMatch(ps, /Win32Exception\(\[int\]/, 'no Int32 cast of a result code in PowerShell');
  assert.match(ps, /case 0xC03A0027u: return "The disk is already as small as it can safely be/);
  const body = ps.slice(ps.indexOf("'shrink' {"), ps.indexOf("\n    'compact' {"));
  assert.match(body, /Get-PartitionSupportedSize[\s\S]*SizeMin/, 'the partition shrinks only as far as Windows says is safe');
  assert.match(body, /finally \{ Step 'Detach'/, 'the disk is detached again even when the partition step fails');
  assert.match(body, /\[MtVirtDisk\]::Shrink/, 'the disk itself shrinks through the virtual disk API');
  const grow = ps.slice(ps.indexOf("'expand' {"), ps.indexOf("\n    'shrink' {"));
  assert.match(grow, /finally \{ Step 'Detach'/, 'growing detaches again even when extending fails');
});
