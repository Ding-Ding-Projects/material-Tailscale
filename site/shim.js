// Browser stand-in for the desktop bridge so the website can reuse the app's
// own UI modules. Everything stays in this browser: files download as blobs,
// secrets live in this browser's storage, nothing is sent anywhere.
const pickFile = (accept) => new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
const files = new Map();
const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const hist = () => JSON.parse(localStorage.getItem('mt.site.history') || '[]');

window.mt = {
  site: true,
  info: async () => ({ product: 'Material Tailscale', version: window.__SITE__?.version || 'site', build: window.__SITE__ || null, platform: 'web', arch: '', electron: '—', userData: '(this browser\'s local storage)', packaged: false }),
  apiCatalog: async () => (await fetch('api-catalog.json')).json(),
  ts: { run: async () => ({ missing: true, searched: [], stderr: 'The website cannot run Tailscale. Download the app.' }), onStream: () => () => {} },
  secret: {
    set: async (n, o) => { localStorage.setItem('mt.site.secret.' + n, JSON.stringify(o)); return { present: true }; },
    presence: async (n) => ({ present: !!localStorage.getItem('mt.site.secret.' + n) }),
    clear: async (n) => { localStorage.removeItem('mt.site.secret.' + n); return true; },
    available: async () => true
  },
  authLoad: async () => { const r = JSON.parse(localStorage.getItem('mt.site.secret.authenticator:secrets') || 'null'); return r?.value ? JSON.parse(r.value) : {}; },
  lockVerify: async (n, a) => {
    const r = JSON.parse(localStorage.getItem('mt.site.secret.' + n) || 'null'); if (!r) return { ok: false };
    const all = JSON.parse(localStorage.getItem('mt.site.lockstate') || '{}'); const st = all[n] || { attempts: 0, until: 0 };
    if (st.until > Date.now()) return { ok: false, waitMs: st.until - Date.now() };
    const totp = (await import('../src/shared/totp.js')).default; let ok = true;
    if (r.pin !== undefined) ok = ok && r.pin === a.pin; if (r.password !== undefined) ok = ok && r.password === a.password; if (r.totpSecret) ok = ok && (await totp.verifyAsync(r.totpSecret, a.totp || ''));
    if (ok) { delete all[n]; } else { st.attempts++; st.until = Date.now() + (st.attempts < 3 ? 0 : Math.min(3600, 2 ** (st.attempts - 2) * 15) * 1000); all[n] = st; }
    localStorage.setItem('mt.site.lockstate', JSON.stringify(all)); return ok ? { ok } : { ok, attempts: st.attempts, waitMs: Math.max(0, st.until - Date.now()) };
  },
  lockStatus: async (n) => { const st = JSON.parse(localStorage.getItem('mt.site.lockstate') || '{}')[n] || { attempts: 0, until: 0 }; return { attempts: st.attempts, waitMs: Math.max(0, st.until - Date.now()) }; },
  lockClearState: async (n) => { const all = JSON.parse(localStorage.getItem('mt.site.lockstate') || '{}'); delete all[n]; localStorage.setItem('mt.site.lockstate', JSON.stringify(all)); },
  ladder: (() => {
    const pend = new Map(); const passed = new Set();
    const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    return {
      start: async (n, rung) => { const id = crypto.randomUUID(); if (rung === 'sums') { const qs = Array.from({ length: 10 }, () => [2 + rnd(18), 2 + rnd(18)]); pend.set(id, { rung, ans: qs.map(([a, b]) => a + b) }); return { ok: true, nonce: id, questions: qs }; } if (rung === 'mole') { const seq = Array.from({ length: 40 }, () => rnd(9)); pend.set(id, { rung, seq, at: Date.now(), hits: new Set() }); return { ok: true, nonce: id, tickMs: 900, seconds: 20, seq }; } return { ok: false, skip: true }; },
      answer: async (id, p) => { const x = pend.get(id); if (!x) return { ok: false }; if (x.rung === 'sums') { pend.delete(id); const ok = p.every((v, i) => v === x.ans[i]); if (ok) passed.add('sums'); return { ok }; } const el = Date.now() - x.at; if (p.finish) { pend.delete(id); const ok = el >= 20000 && x.hits.size >= 10; if (ok) passed.add('mole'); return { ok, hits: x.hits.size }; } const tick = Math.floor(el / 900); if (x.seq[tick] !== p.hole) return { ok: false, hits: x.hits.size }; x.hits.add(tick); return { ok: true, hits: x.hits.size }; },
      complete: async (n) => { if (!passed.has('sums') || !passed.has('mole')) return { ok: false }; passed.clear(); const all = JSON.parse(localStorage.getItem('mt.site.lockstate') || '{}'); if (all[n]) all[n].until = 0; localStorage.setItem('mt.site.lockstate', JSON.stringify(all)); return { ok: true }; }
    };
  })(),
  history: {
    record: async (message, f) => { const h = hist(); h.unshift({ oid: Math.random().toString(16).slice(2).padEnd(40, '0'), message, time: Date.now(), files: f }); localStorage.setItem('mt.site.history', JSON.stringify(h.slice(0, 200))); },
    list: async () => hist(),
    files: async (oid) => Object.fromEntries(Object.entries(hist().find((x) => x.oid === oid)?.files || {}).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v, null, 2)])),
    restore: async (oid) => ({ content: await window.mt.history.files(oid) })
  },
  shared: { get: async () => JSON.parse(localStorage.getItem('mt.site.school') || '{}'), set: async (r) => { const c = { ...JSON.parse(localStorage.getItem('mt.site.school') || '{}'), ...r }; localStorage.setItem('mt.site.school', JSON.stringify(c)); window.dispatchEvent(new CustomEvent('mt:school', { detail: c })); return c; }, onChange: (fn) => { const h = (e) => fn(e.detail); window.addEventListener('mt:school', h); window.addEventListener('storage', (e) => { if (e.key === 'mt.site.school') fn(JSON.parse(e.newValue || '{}')); }); return () => window.removeEventListener('mt:school', h); } },
  dialog: {
    open: async (o) => { const f = await pickFile(o?.filters?.[0]?.extensions?.map((e) => '.' + e).join(',')); if (!f) return null; const id = 'browser-file:' + f.name; files.set(id, f); return [id]; },
    save: async (o) => o?.defaultPath || 'download'
  },
  fs: {
    writeText: async (p, text) => { download(p.split(/[\\/]/).pop(), new Blob([text])); return p; },
    writeBytes: async (p, b64) => { download(p.split(/[\\/]/).pop(), new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))])); return p; },
    readText: async (p) => files.get(p).text(),
    readBytes: async (p) => { const b = new Uint8Array(await files.get(p).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
  },
  shell: { external: async (u) => { window.open(u, '_blank', 'noopener'); }, openPath: async () => {}, showItem: async () => {} },
  editor: { detect: async () => [], open: async () => {} },
  clipboardImage: async () => null,
  notify: async () => true,
  update: { install: async () => {}, check: async () => 'The website is always current.', onState: () => () => {} },
  win: { minimize: async () => {}, maximize: async () => {}, close: async () => {}, title: async (t) => { document.title = t; }, capture: async () => '', onState: () => () => {} },
  onTray: () => () => {},
  pathForFile: (f) => { const id = 'browser-file:' + f.name; files.set(id, f); return id; }
};
