'use strict';
// Tailscale admin API client. Requests are only allowed for method and path
// pairs that exist in the generated catalogue, the host is fixed, and the
// credential never leaves the main process.
const catalog = require('../shared/api-catalog.json');
const secrets = require('./secrets');

const BASE = 'https://api.tailscale.com/api/v2';

const routes = catalog.operations.map((op) => ({
  op,
  re: new RegExp('^' + op.path.split(/\{[^}]+\}/).map((s) => s.replace(/[.*+?^$()|[\]\\-]/g, '\\$&')).join('[^/?#]+') + '$')
}));

function match(method, p) {
  return routes.find((r) => r.op.method === method && r.re.test(p))?.op || null;
}

let cachedToken = null;

async function bearer() {
  const cred = secrets.get('admin');
  if (!cred) throw Object.assign(new Error('No admin API credential is saved yet. Add an API access token or OAuth client in Admin > Connection.'), { code: 'NO_CREDENTIAL' });
  if (cred.kind === 'apiKey') return cred.value;
  if (cred.kind === 'oauth') {
    if (cachedToken && cachedToken.expires > Date.now() + 30000) return cachedToken.token;
    const body = new URLSearchParams({ client_id: cred.clientId, client_secret: cred.value });
    if (cred.scopes) body.set('scope', cred.scopes);
    const res = await fetch(`${BASE}/oauth/token`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OAuth token request failed (HTTP ${res.status}): ${json.message || json.error || 'no detail'}`);
    cachedToken = { token: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
    return cachedToken.token;
  }
  throw new Error('Unknown credential type.');
}

function tailnetName() {
  const cred = secrets.get('admin');
  return cred?.tailnet || '-';
}

async function request({ method, path: p, query, body, accept }) {
  method = String(method || 'GET').toUpperCase();
  if (typeof p !== 'string' || !p.startsWith('/') || p.includes('..') || /[\s#]/.test(p)) throw new Error('Invalid API path.');
  const resolved = p.replace('{tailnet}', encodeURIComponent(tailnetName()));
  const op = match(method, resolved);
  if (!op) throw new Error(`${method} ${resolved} is not a documented Tailscale API operation.`);
  const url = new URL(BASE + resolved);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  const headers = { Authorization: `Bearer ${await bearer()}`, Accept: accept || 'application/json' };
  let payload;
  if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
    if (typeof body === 'string') { payload = body; headers['Content-Type'] = op.bodyMediaType || 'application/hujson'; }
    else { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  }
  const started = Date.now();
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = undefined; }
  return { ok: res.ok, status: res.status, json, text, etag: res.headers.get('etag'), ms: Date.now() - started, operation: op.id, url: url.toString() };
}

module.exports = { request, match, tailnetName };
