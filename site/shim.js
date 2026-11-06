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
  lockVerify: async (n, a) => { const r = JSON.parse(localStorage.getItem('mt.site.secret.' + n) || 'null'); if (!r) return { ok: false }; const totp = (await import('../src/shared/totp.js')).default; let ok = true; if (r.pin !== undefined) ok = ok && r.pin === a.pin; if (r.password !== undefined) ok = ok && r.password === a.password; if (r.totpSecret) ok = ok && (await totp.verifyAsync(r.totpSecret, a.totp || '')); return { ok }; },
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
