// Generates src/shared/api-catalog.json from the vendored Tailscale OpenAPI
// document. Every operation keeps its method, path, summary, description,
// parameters and a fully dereferenced request-body schema so the renderer can
// draw a typed control for every field. Pass --fetch to refresh the spec first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { docAddresses } from './doc-addresses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPath = path.join(root, 'vendor/tailscale-openapi/openapi.yaml');

if (process.argv.includes('--fetch')) {
  const res = await fetch('https://api.tailscale.com/api/v2?outputOpenapiSchema=true');
  if (!res.ok) throw new Error(`Spec fetch failed: HTTP ${res.status}`);
  fs.writeFileSync(specPath, await res.text());
}

const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));

function deref(node, seen = new Set(), depth = 0) {
  if (!node || typeof node !== 'object') return node;
  if (depth > 12) return { type: 'object', description: '(nested too deeply to render; edit as JSON)' };
  if (Array.isArray(node)) return node.map((n) => deref(n, seen, depth + 1));
  if (node.$ref) {
    const ref = node.$ref;
    if (seen.has(ref)) return { type: 'object', description: `(recursive ${ref.split('/').pop()}; edit as JSON)` };
    const target = ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], spec);
    const next = new Set(seen); next.add(ref);
    return deref({ ...target, ...Object.fromEntries(Object.entries(node).filter(([k]) => k !== '$ref')) }, next, depth + 1);
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'example' || k === 'examples' || k === 'x-codeSamples') continue;
    out[k] = deref(v, seen, depth + 1);
  }
  return out;
}

const ops = [];
for (const [p, item] of Object.entries(spec.paths)) {
  const shared = item.parameters || [];
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const op = item[method];
    if (!op) continue;
    const params = deref([...shared, ...(op.parameters || [])]).map((x) => ({
      name: x.name, in: x.in, required: !!x.required, description: x.description || '', schema: x.schema || { type: 'string' }
    }));
    const content = op.requestBody?.content || {};
    const mediaType = Object.keys(content)[0] || null;
    const body = mediaType ? deref(content[mediaType].schema || {}) : null;
    ops.push({
      id: op.operationId || `${method}-${p}`,
      method: method.toUpperCase(),
      path: p,
      tag: (op.tags || ['Other'])[0],
      summary: op.summary || '',
      description: op.description || '',
      params,
      body,
      bodyMediaType: mediaType,
      bodyRequired: !!op.requestBody?.required,
      destructive: method === 'delete' || /\/(delete|expire|suspend|rotate)$/.test(p)
    });
  }
}

const out = {
  source: 'vendor/tailscale-openapi/openapi.yaml',
  specVersion: spec.info?.version,
  generated: new Date().toISOString(),
  servers: spec.servers,
  count: ops.length,
  operations: ops
};
fs.writeFileSync(path.join(root, 'src/shared/api-catalog.json'), docAddresses(JSON.stringify(out)));
console.log(`api-catalog.json: ${ops.length} operations`);
