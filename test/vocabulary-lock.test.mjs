import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, section, lockPathFor } from '../scripts/check-vocabulary.mjs';

const RULES = '# Rules\n\nintro\n\n## Vocabulary and locations\n\n- a rule\n- another rule\n\n## Next part\n\nmore\n';
const setup = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-wl-')); const src = path.join(dir, 'SHARED_INSTRUCTIONS.md'); fs.writeFileSync(src, RULES); return { dir, src }; };

test('the rules section is cut from its heading to the next heading', () => {
  assert.equal(section(RULES), '## Vocabulary and locations\n\n- a rule\n- another rule\n');
  assert.equal(section('no rules here'), null);
});

test('no private source: skipped, never failed', () => {
  assert.deepEqual(check({ list: [path.join(os.tmpdir(), 'no-such-dir', 'x.md')] }).state, 'skipped');
  assert.equal(check({ list: [] }).code, 0);
});

test('a source must be locked, a stale lock fails, a current one passes', () => {
  const { src } = setup();
  assert.equal(check({ list: [src] }).state, 'unlocked');
  assert.equal(check({ list: [src] }).code, 1);
  assert.equal(check({ list: [src], lock: true }).state, 'locked');
  assert.ok(fs.existsSync(lockPathFor(src)));
  assert.equal(check({ list: [src] }).state, 'current');
  fs.writeFileSync(src, RULES.replace('- another rule', '- another rule\n- a new rule'));
  assert.equal(check({ list: [src] }).state, 'stale');
  assert.equal(check({ list: [src] }).code, 1);
  // A change outside the rules section does not matter.
  check({ list: [src], lock: true });
  fs.writeFileSync(src, fs.readFileSync(src, 'utf8').replace('more', 'more words'));
  assert.equal(check({ list: [src] }).state, 'current');
});

test('the lock lives beside the private source, never in this repository, and holds no rules', () => {
  const { src } = setup();
  check({ list: [src], lock: true });
  const lock = fs.readFileSync(lockPathFor(src), 'utf8');
  assert.match(lock, /"sha256": "[0-9a-f]{64}"/);
  assert.doesNotMatch(lock, /a rule/);
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const inside = path.join(repo, 'SHARED_INSTRUCTIONS.md');
  fs.writeFileSync(inside, RULES);
  try { assert.equal(check({ list: [inside], lock: true }).state, 'refused'); }
  finally { fs.rmSync(inside, { force: true }); }
  // The repository itself carries no lock value.
  const tracked = fs.readdirSync(repo).filter((f) => /\.wording\.lock$/.test(f));
  assert.deepEqual(tracked, []);
});
