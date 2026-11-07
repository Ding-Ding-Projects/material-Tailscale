// Generates a Postman v2.1 collection of every Tailscale admin API operation
// from the vendored OpenAPI document. The token lives in a collection
// variable left empty on purpose; nothing secret is written to the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { docAddresses } from './doc-addresses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = yaml.load(fs.readFileSync(path.join(root, 'vendor/tailscale-openapi/openapi.yaml'), 'utf8'));
const resolve = (n) => (n?.$ref ? n.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], spec) : n);

function example(schema, depth = 0) {
  const s = resolve(schema) || {};
  if (s.example !== undefined) return s.example;
  if (depth > 5) return undefined;
  if (s.allOf) return Object.assign({}, ...s.allOf.map((x) => example(x, depth + 1)).filter((x) => x && typeof x === 'object'));
  if (s.oneOf || s.anyOf) return example((s.oneOf || s.anyOf)[0], depth + 1);
  if (s.type === 'object' || s.properties) { const o = {}; for (const [k, v] of Object.entries(s.properties || {})) { const e = example(v, depth + 1); if (e !== undefined) o[k] = e; } return o; }
  if (s.type === 'array') { const e = example(s.items, depth + 1); return e === undefined ? [] : [e]; }
  if (s.enum) return s.enum[0];
  return { string: '', integer: 0, number: 0, boolean: false }[s.type];
}

const folders = new Map();
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const tag = op.tags?.[0] || 'Other';
    const params = [...(ops.parameters || []), ...(op.parameters || [])].map(resolve);
    const pathParts = p.replace(/^\//, '').split('/').map((seg) => seg.replace(/\{(\w+)\}/, ':$1'));
    const query = params.filter((x) => x.in === 'query').map((x) => ({ key: x.name, value: '', description: x.description || '', disabled: !x.required }));
    const variable = params.filter((x) => x.in === 'path').map((x) => ({ key: x.name, value: x.name === 'tailnet' ? '{{tailnet}}' : '', description: x.description || '' }));
    const bodySchema = resolve(op.requestBody)?.content?.['application/json']?.schema;
    const item = {
      name: op.summary || `${method.toUpperCase()} ${p}`,
      request: {
        method: method.toUpperCase(),
        header: bodySchema ? [{ key: 'Content-Type', value: 'application/json' }] : [],
        url: { raw: `{{baseUrl}}/${pathParts.join('/')}`, host: ['{{baseUrl}}'], path: pathParts, query, variable },
        description: [op.description, op.operationId && `Operation: ${op.operationId}`].filter(Boolean).join('\n\n')
      }
    };
    if (bodySchema) item.request.body = { mode: 'raw', raw: JSON.stringify(example(bodySchema) ?? {}, null, 2), options: { raw: { language: 'json' } } };
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push(item);
  }
}
const collection = {
  info: { name: 'Tailscale API (from Material Tailscale)', description: `Generated from the Tailscale OpenAPI document (${spec.info?.version || 'unversioned'}), BSD-3-Clause. Set the token variable to an API access token; it is sent as a Bearer token.`, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [{ key: 'baseUrl', value: 'https://api.tailscale.com/api/v2' }, { key: 'tailnet', value: '-' }, { key: 'token', value: '' }],
  item: [...folders].sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => ({ name, item }))
};
const out = path.join(root, 'docs/api/tailscale.postman_collection.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, docAddresses(JSON.stringify(collection, null, 2)) + '\n');
console.log(`${collection.item.reduce((n, f) => n + f.item.length, 0)} requests in ${collection.item.length} folders -> ${path.relative(root, out)}`);
