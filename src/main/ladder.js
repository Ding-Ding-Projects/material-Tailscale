'use strict';
// Lock attempt budget, exponential back-off and the unlock ladder, graded in
// the main process. Every challenge carries a single-use nonce; the renderer
// never sees answers. The ladder clears waiting only, never the credential,
// never refunds attempts, and is capped per rolling hour.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app } = require('electron');
const secrets = require('./secrets');
const totp = require('../shared/totp');

const file = () => path.join(app.getPath('userData'), 'lock-state.json');
const load = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return { locks: {}, ladder: [] }; } };
const save = (s) => fs.writeFileSync(file(), JSON.stringify(s));
const backoff = (n) => (n < 3 ? 0 : Math.min(3600, 2 ** (n - 2) * 15) * 1000);
const LADDER_PER_HOUR = 3;
const pending = new Map();
const passed = new Map(); // lock id -> Set of rungs passed this climb
const pass = (id, rung, ok) => { if (ok) { if (!passed.has(id)) passed.set(id, new Set()); passed.get(id).add(rung); } return ok; };

const same = (a, b) => { const x = crypto.createHash('sha256').update(String(a ?? '')).digest(); const y = crypto.createHash('sha256').update(String(b ?? '')).digest(); return crypto.timingSafeEqual(x, y); };

function status(id) {
  const s = load().locks[id] || { attempts: 0, until: 0 };
  return { attempts: s.attempts, waitMs: Math.max(0, s.until - Date.now()), ladderLeft: ladderLeft() };
}

function verify(id, attempt) {
  const rec = secrets.get('lock:' + id);
  if (!rec) return { ok: false, missing: true };
  const st = load();
  const cur = st.locks[id] || { attempts: 0, until: 0 };
  if (cur.until > Date.now()) return { ok: false, waitMs: cur.until - Date.now(), attempts: cur.attempts };
  let ok = true;
  if (rec.pin !== undefined) ok = same(rec.pin, attempt.pin) && ok;
  if (rec.password !== undefined) ok = same(rec.password, attempt.password) && ok;
  if (rec.totpSecret) ok = totp.verify(rec.totpSecret, String(attempt.totp || ''), rec.totp || {}) && ok;
  if (ok) { delete st.locks[id]; save(st); return { ok: true }; }
  cur.attempts += 1; cur.until = Date.now() + backoff(cur.attempts);
  st.locks[id] = cur; save(st);
  return { ok: false, attempts: cur.attempts, waitMs: Math.max(0, cur.until - Date.now()) };
}

function ladderLeft() {
  const st = load();
  const hourAgo = Date.now() - 3600000;
  return Math.max(0, LADDER_PER_HOUR - (st.ladder || []).filter((t) => t > hourAgo).length);
}

const nonce = () => crypto.randomBytes(16).toString('hex');

async function start(id, rung, { school } = {}) {
  if (!ladderLeft()) return { ok: false, capped: true };
  const n = nonce();
  if (rung === 'dimsum') {
    if (school) return { ok: false, skip: true };
    try {
      const cat = await (await fetch('https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json')).json();
      const rel = await (await fetch('https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases?per_page=100', { headers: { 'User-Agent': 'MaterialTailscale' } })).json();
      const assets = new Map();
      for (const r of rel) { if (r.draft || !/^catalog-v1(?:-part-\d+)?$/.test(r.tag_name)) continue; for (const a of r.assets || []) if (/\.png$/i.test(a.name)) assets.set(a.name, a.browser_download_url); }
      const pool = cat.dishes.filter((d) => assets.has(d.image?.path?.split('/').pop()));
      if (pool.length < 4) return { ok: false, skip: true };
      const pick = [];
      while (pick.length < 4) { const d = pool[crypto.randomInt(pool.length)]; if (!pick.includes(d)) pick.push(d); }
      const answer = pick[crypto.randomInt(4)];
      pending.set(n, { id, rung, answer: answer.id, at: Date.now() });
      return { ok: true, nonce: n, photo: assets.get(answer.image.path.split('/').pop()), alt: answer.image?.alt?.en || 'A dim sum dish', choices: pick.map((d) => ({ id: d.id, en: d.name.en, zh: d.name.zhHant })) };
    } catch { return { ok: false, skip: true }; }
  }
  if (rung === 'sums') {
    const qs = Array.from({ length: 10 }, () => [2 + crypto.randomInt(18), 2 + crypto.randomInt(18)]);
    pending.set(n, { id, rung, answer: qs.map(([a, b]) => a + b), at: Date.now() });
    return { ok: true, nonce: n, questions: qs };
  }
  if (rung === 'mole') {
    const seq = Array.from({ length: 40 }, () => crypto.randomInt(9));
    pending.set(n, { id, rung, seq, at: Date.now(), hits: new Set() });
    return { ok: true, nonce: n, tickMs: 900, seconds: 20, seq };
  }
  return { ok: false };
}

/** Grades an answer. The nonce is consumed by the final grading call. */
function answer(n, payload) {
  const p = pending.get(n);
  if (!p) return { ok: false, expired: true };
  if (p.rung === 'dimsum') { pending.delete(n); return { ok: pass(p.id, 'dimsum', payload === p.answer) }; }
  if (p.rung === 'sums') { pending.delete(n); return { ok: pass(p.id, 'sums', Array.isArray(payload) && payload.length === 10 && payload.every((v, i) => Number(v) === p.answer[i])) }; }
  if (p.rung === 'mole') {
    const elapsed = Date.now() - p.at;
    if (payload?.finish) {
      pending.delete(n);
      if (elapsed < 20000) return { ok: false, early: true };
      return { ok: pass(p.id, 'mole', p.hits.size >= 10), hits: p.hits.size };
    }
    const tick = Math.floor(elapsed / 900);
    if (elapsed > 20000 || p.seq[tick] !== payload?.hole) return { ok: false, hits: p.hits.size };
    p.hits.add(tick);
    return { ok: true, hits: p.hits.size };
  }
  return { ok: false };
}

/** Called after the last rung passes: clears the waiting, records the climb. */
function complete(id, { school, dimsumSkipped } = {}) {
  const got = passed.get(id) || new Set();
  const need = ['sums', 'mole', ...(school || dimsumSkipped ? [] : ['dimsum'])];
  if (!need.every((r) => got.has(r))) return { ok: false, incomplete: need.filter((r) => !got.has(r)) };
  passed.delete(id);
  const st = load();
  if (ladderLeft() <= 0) return { ok: false, capped: true };
  st.ladder = [...(st.ladder || []).filter((t) => t > Date.now() - 3600000), Date.now()];
  if (st.locks[id]) st.locks[id].until = 0;
  save(st);
  return { ok: true, ladderLeft: ladderLeft() };
}

function clear(id) { const st = load(); delete st.locks[id]; save(st); }

module.exports = { status, verify, start, answer, complete, clear };
