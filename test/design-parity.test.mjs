import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, boardViews, TUPLE_FIELDS } from '../scripts/lib/design-parity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = JSON.parse(fs.readFileSync(path.join(root, 'docs/design-parity/inventory.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(inv));

test('every checked-in design view is in the hand-written inventory with fresh evidence', () => {
  assert.equal(inv.screens.length, boardViews(root).length);
  assert.deepEqual(validate(inv, root), []);
});

test('negative regression: each removed record turns the guard red, the intact inventory is green', () => {
  const cases = [
    ['a reference entry removed', (x) => { x.screens.splice(0, 1); }],
    ['the reference file removed', (x) => { delete x.screens[0].reference; }],
    ['a look-alike reference path', (x) => { x.screens[0].reference = 'design/canvas/Main.dc.html.bak'; }],
    ['the design-reference route removed', (x) => { delete x.screens[1].referenceRoute; }],
    ['the real-app route removed', (x) => { delete x.screens[2].appRoute; }],
    ...TUPLE_FIELDS.map((f) => [`tuple field ${f} removed`, (x) => { delete x.screens[3].tuple[f]; }]),
    ['a tuple that differs from the evidence', (x) => { x.screens[3].tuple.width = 1280; }],
    ['the Material Design 3 audit removed', (x) => { delete x.screens[4].m3; }],
    ['the reference capture removed', (x) => { delete x.screens[5].captures.reference; }],
    ['the app capture removed', (x) => { delete x.screens[5].captures.app; }],
    ['a capture pointing at a missing file', (x) => { x.screens[5].captures.app += '.missing'; }],
    ['the side-by-side comparison removed', (x) => { delete x.screens[6].comparison; }],
    ['the diff record removed', (x) => { delete x.screens[7].diff; }],
    ['a deviation without its reason', (x) => { x.screens[0].deviations = [{ what: 'Spacing', approved: 'yes' }]; }],
    ['a deviation without approval', (x) => { x.screens[0].deviations = [{ what: 'Spacing', reason: 'Content' }]; }],
    ['a reference view listed twice', (x) => { x.screens.push({ ...x.screens[0], id: 'copy' }); }]
  ];
  for (const [name, mutate] of cases) {
    const x = clone(); mutate(x);
    assert.ok(validate(x, root).length > 0, `${name} should fail the guard`);
  }
  assert.deepEqual(validate(clone(), root), []);
});
