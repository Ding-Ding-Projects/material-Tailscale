import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_INDEX } from '../src/renderer/pages/settings-index.js';

test('every setting explains itself in both languages', () => {
  for (const s of SETTINGS_INDEX) {
    assert.ok(s.en && s.yue, `label ${s.key}`);
    assert.ok(s.explain && s.explain.length > 40, `explanation ${s.key}`);
    assert.notEqual(s.explain.trim().toLowerCase(), s.en.trim().toLowerCase(), `explanation restates label ${s.key}`);
  }
});
