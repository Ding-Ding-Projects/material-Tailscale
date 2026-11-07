import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../src/shared/api-catalog.json');
const col = JSON.parse(fs.readFileSync(new URL('../docs/api/tailscale.postman_collection.json', import.meta.url)));

test('the Postman collection covers every admin API operation and holds no token', () => {
  const ops = (api.operations || api).length;
  assert.equal(col.item.reduce((n, f) => n + f.item.length, 0), ops);
  assert.equal(col.variable.find((v) => v.key === 'token').value, '');
  assert.ok(!/tskey-/.test(JSON.stringify(col)));
});
