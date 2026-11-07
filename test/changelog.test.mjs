import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseChangelog } from '../scripts/lib/changelog.mjs';

const src = `# Changelog

## Unreleased: Big Polish

- Polished.

## v1.0.12 · 2026-11-07 · Crab Roe Siu Mai · 蟹籽燒賣 · cd93523

- Fixed.

## v1.0.4 · 2026-11-06

- First.
`;

test('release headings keep a code name that contains the separator', () => {
  const [, r12, r4] = parseChangelog(src);
  assert.deepEqual([r12.version, r12.date, r12.codeName, r12.sha], ['1.0.12', '2026-11-07', 'Crab Roe Siu Mai · 蟹籽燒賣', 'cd93523']);
  assert.deepEqual([r4.version, r4.date, r4.codeName, r4.sha], ['1.0.4', '2026-11-06', '', '']);
});

test('an unreleased section is not mistaken for a version, and a release build stamps it', () => {
  const [u] = parseChangelog(src);
  assert.equal(u.unreleased, true);
  assert.equal(u.version, '');
  assert.equal(u.title, 'Big Polish');
  const [s] = parseChangelog(src, { MT_VERSION: '1.0.15', MT_CODENAME: 'Scallop Siu Mai', GITHUB_SHA: 'abc1234', MT_RELEASE_DATE: '2026-11-08T00:00:00Z' });
  assert.deepEqual([s.unreleased, s.version, s.date, s.codeName, s.sha, s.title], [undefined, '1.0.15', '2026-11-08', 'Scallop Siu Mai', 'abc1234', 'Big Polish']);
});

test('every heading in the real changelog parses to a version or an unreleased section', () => {
  for (const e of parseChangelog(fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'))) {
    assert.ok(e.unreleased || /^\d+(\.\d+)+$/.test(e.version), `bad heading: ${JSON.stringify(e).slice(0, 120)}`);
    if (!e.unreleased) assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});
