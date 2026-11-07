// Rich, typed controls. Each returns { el, get(), set(v), onChange } and never
// falls back to a bare textbox when a richer control fits the value.
import { h, icon, clear, uid } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import * as ts from '../core/tsdata.js';
import { popover } from './overlay.js';
import { sound } from '../core/feedback.js';

const emitter = () => { const fns = new Set(); return { on: (f) => fns.add(f), fire: (v) => fns.forEach((f) => f(v)) }; };

export function switchCtl(value, { label, triState } = {}) {
  const ev = emitter();
  let v = value;
  if (triState) {
    const seg = segmented([{ value: undefined, label: t('leaveUnchanged') }, { value: true, label: t('on') }, { value: false, label: t('off') }], v, { label });
    seg.onChange(ev.fire);
    return { el: seg.el, get: seg.get, set: seg.set, onChange: ev.on };
  }
  v = !!v;
  const el = h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(!!v), 'aria-label': label || 'Toggle', on: { click: () => { v = !v; el.setAttribute('aria-checked', String(v)); sound('click'); ev.fire(v); } } });
  return { el, get: () => v, set: (x) => { v = !!x; el.setAttribute('aria-checked', String(v)); }, onChange: ev.on };
}

export function segmented(options, value, { label } = {}) {
  const ev = emitter();
  let v = value;
  const el = h('div.seg', { role: 'radiogroup', 'aria-label': label || 'Choice' });
  const btns = options.map((o) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(o.value === v), on: { click: () => { v = o.value; sync(); sound('click'); ev.fire(v); } } }, o.icon ? icon(o.icon) : null, o.label ?? String(o.value)));
  const sync = () => btns.forEach((b, i) => b.setAttribute('aria-checked', String(options[i].value === v)));
  el.addEventListener('keydown', (e) => {
    const i = options.findIndex((o) => o.value === v);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); v = options[(i + d + options.length) % options.length].value; sync(); btns[options.findIndex((o) => o.value === v)].focus(); ev.fire(v);
  });
  el.append(...btns);
  return { el, get: () => v, set: (x) => { v = x; sync(); }, onChange: ev.on };
}

export function stepper(value, { min = 0, max = 1e9, step = 1, label, allowEmpty, chips = [] } = {}) {
  const ev = emitter();
  const input = h('input', { type: 'text', inputmode: 'numeric', value: value ?? '', 'aria-label': label || 'Number' });
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const get = () => (input.value === '' ? (allowEmpty ? '' : undefined) : Number(input.value));
  const bump = (d) => { const n = Number(input.value || min); input.value = clamp((Number.isFinite(n) ? n : min) + d); ev.fire(get()); };
  input.addEventListener('input', () => { input.value = input.value.replace(/[^\d-]/g, ''); ev.fire(get()); });
  input.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); bump(step); } if (e.key === 'ArrowDown') { e.preventDefault(); bump(-step); } });
  const el = h('div.row', h('div.stepper', h('button', { type: 'button', 'aria-label': 'Decrease', on: { click: () => bump(-step) } }, '−'), input, h('button', { type: 'button', 'aria-label': 'Increase', on: { click: () => bump(step) } }, '+')),
    chips.length ? h('div.suggest', chips.map((c) => h('button.chip.choice', { type: 'button', on: { click: () => { input.value = c.value; ev.fire(get()); } } }, c.label || c.value))) : null);
  return { el, get, set: (x) => { input.value = x ?? ''; }, onChange: ev.on };
}

export const portStepper = (value, opts = {}) => stepper(value, { min: opts.allowZero ? 0 : 1, max: 65535, allowEmpty: true, label: opts.label, chips: [{ value: 443 }, { value: 80 }, { value: 8443 }, { value: 3000 }, { value: 8080 }, { value: 10000 }] });

const UNITS = [['ms', 1], ['s', 1000], ['m', 60000], ['h', 3600000]];
export function duration(value, { label } = {}) {
  const ev = emitter();
  const parse = (s) => { const m = String(s || '').match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/); return m ? { n: Number(m[1]), u: m[2] } : null; };
  let cur = parse(value) || { n: 0, u: 's' };
  let touched = !!parse(value);
  const range = h('input.slider', { type: 'range', min: 0, max: 120, step: 1, 'aria-label': (label || 'Duration') + ' amount' });
  const num = h('input.input', { type: 'text', inputmode: 'decimal', style: { width: '90px', textAlign: 'center' }, 'aria-label': (label || 'Duration') + ' value' });
  const unit = segmented(UNITS.map(([u]) => ({ value: u, label: u })), cur.u, { label: 'Unit' });
  const sync = () => { range.value = Math.min(120, cur.n); range.style.setProperty('--p', `${(Math.min(120, cur.n) / 120) * 100}%`); num.value = touched ? cur.n : ''; unit.set(cur.u); };
  const fire = () => { touched = true; sync(); ev.fire(get()); };
  range.addEventListener('input', () => { cur.n = Number(range.value); fire(); });
  num.addEventListener('input', () => { const n = Number(num.value); if (Number.isFinite(n) && n >= 0) { cur.n = n; touched = true; range.value = Math.min(120, n); ev.fire(get()); } });
  unit.onChange((u) => { cur.u = u; fire(); });
  const get = () => (touched ? `${cur.n}${cur.u}` : undefined);
  sync();
  const el = h('div.stack', h('div.row.nowrap', range, num), unit.el);
  return { el, get, set: (s) => { const p = parse(s); touched = !!p; cur = p || { n: 0, u: 's' }; sync(); }, onChange: ev.on };
}

const CIDR_RE = /^([0-9]{1,3}(\.[0-9]{1,3}){3}\/\d{1,2}|[0-9a-fA-F:]+\/\d{1,3})$/;
export function chips(values = [], { kind = 'cidrs', label, suggestions = [] } = {}) {
  const ev = emitter();
  let list = [...values];
  const validate = { cidrs: (s) => CIDR_RE.test(s), tags: (s) => /^tag:[A-Za-z0-9-]+$/.test(s), keys: (s) => /^(tlpub:|nlpub:)?[0-9a-f]{32,}$/i.test(s) || s.startsWith('tlpub:'), caps: (s) => s.length > 2, any: () => true }[kind] || (() => true);
  const placeholder = { cidrs: '198.51.100.0/24', tags: 'tag:server', keys: 'tlpub:…', caps: 'example.com/cap/foo' }[kind] || '';
  const input = h('input', { placeholder, 'aria-label': label || 'Add item' });
  const box = h('div.chips-editor', { on: { click: () => input.focus() } });
  const err = h('div.err-text', { 'aria-live': 'polite' });
  const render = () => {
    clear(box);
    for (const v of list) box.append(h('span.chip.mono', v, h('button', { type: 'button', 'aria-label': `Remove ${v}`, on: { click: () => { list = list.filter((x) => x !== v); render(); ev.fire(list); } } }, icon('close'))));
    box.append(input);
  };
  const add = (raw) => {
    let s = raw.trim().replace(/,$/, '');
    if (!s) return;
    if (kind === 'tags' && !s.startsWith('tag:')) s = 'tag:' + s;
    if (!validate(s)) { err.textContent = pair(`"${s}" is not valid here.`, `「${s}」唔啱格式。`); input.classList.add('invalid'); return; }
    err.textContent = '';
    if (!list.includes(s)) list.push(s);
    input.value = ''; render(); ev.fire(list); sound('click');
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); add(input.value); }
    if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); render(); ev.fire(list); }
  });
  input.addEventListener('blur', () => add(input.value));
  input.addEventListener('paste', (e) => { const txt = e.clipboardData.getData('text'); if (/[,\s]/.test(txt)) { e.preventDefault(); txt.split(/[,\s]+/).forEach(add); } });
  render();
  const sugg = h('div.suggest', suggestions.map((s) => h('button.chip.choice', { type: 'button', on: { click: () => add(s) } }, '+ ' + s)));
  return { el: h('div.stack', box, sugg, err), get: () => [...list], set: (v) => { list = [...(v || [])]; render(); }, onChange: ev.on };
}

export function text(value = '', { label, placeholder, type = 'text', validate, mono, multiline } = {}) {
  const ev = emitter();
  const el = h(multiline ? 'textarea.input' : 'input.input', { type, value, placeholder: placeholder || '', 'aria-label': label || 'Value', style: mono ? { fontFamily: 'var(--font-mono)' } : null, spellcheck: !mono });
  if (multiline) el.value = value;
  const err = h('div.err-text');
  el.addEventListener('input', () => {
    const msg = validate?.(el.value);
    err.textContent = msg || ''; el.classList.toggle('invalid', !!msg);
    ev.fire(el.value);
  });
  return { el: h('div.stack', el, err), input: el, get: () => (el.value === '' ? undefined : el.value), set: (v) => { el.value = v ?? ''; }, onChange: ev.on };
}

export function secret(value = '', { label, allowFile = true } = {}) {
  const ev = emitter();
  const inp = h('input', { type: 'password', value, 'aria-label': label || 'Secret', autocomplete: 'off', spellcheck: false });
  const eye = h('button.icon-btn.sm', { type: 'button', 'aria-label': 'Show or hide', on: { click: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; eye.firstChild.textContent = inp.type === 'password' ? 'visibility' : 'visibility_off'; } } }, icon('visibility'));
  const file = allowFile ? h('button.icon-btn.sm', { type: 'button', 'aria-label': 'Read from a file (file: prefix)', title: 'Read from file', on: { click: async () => { const p = await window.mt.dialog.open({ title: 'Choose the file that holds the secret' }); if (p?.[0]) { inp.value = 'file:' + p[0]; inp.type = 'text'; ev.fire(inp.value); } } } }, icon('description')) : null;
  inp.addEventListener('input', () => ev.fire(inp.value));
  return { el: h('div.input-wrap', icon('key'), inp, eye, file), get: () => inp.value || undefined, set: (v) => { inp.value = v || ''; }, onChange: ev.on };
}

export function pathPick(value = '', { mode = 'file', label, filters } = {}) {
  const ev = emitter();
  let v = value;
  const shown = h('span.mono.small', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } });
  const sync = () => { shown.textContent = Array.isArray(v) ? (v.length ? `${v.length} file(s): ${v.map((x) => x.split(/[\\/]/).pop()).join(', ')}` : pair('Nothing chosen', '未揀')) : (v || pair('Nothing chosen', '未揀')); };
  const browse = async () => {
    if (mode === 'save') { const p = await window.mt.dialog.save({ defaultPath: v || undefined, filters }); if (p) v = p; }
    else {
      const props = mode === 'dir' ? ['openDirectory', 'createDirectory'] : mode === 'files' ? ['openFile', 'multiSelections'] : ['openFile'];
      const p = await window.mt.dialog.open({ properties: props, filters });
      if (p) v = mode === 'files' ? [...new Set([...(Array.isArray(v) ? v : []), ...p])] : p[0];
    }
    sync(); ev.fire(v);
  };
  const el = h('div.input-wrap', { 'aria-label': label }, icon(mode === 'dir' ? 'folder' : mode === 'save' ? 'save' : 'description'), shown,
    h('button.btn.small.tonal', { type: 'button', on: { click: browse } }, pair('Browse…', '瀏覽…')),
    h('button.icon-btn.sm', { type: 'button', 'aria-label': 'Clear', on: { click: () => { v = mode === 'files' ? [] : ''; sync(); ev.fire(v); } } }, icon('backspace')));
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const fs = [...e.dataTransfer.files].map((f) => window.mt.pathForFile(f)); if (!fs.length) return; v = mode === 'files' ? [...(v || []), ...fs] : fs[0]; sync(); ev.fire(v); });
  sync();
  return { el, get: () => (Array.isArray(v) ? (v.length ? v : undefined) : v || undefined), set: (x) => { v = x; sync(); }, onChange: ev.on };
}

/** Live peer picker: a searchable list of real peers with status, plus typed entry. */
export function peerPick(value = '', { label, preferIp, allowUser, includeSelf } = {}) {
  const ev = emitter();
  let v = value;
  let user = '';
  const btn = h('button.pick-row', { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': label || 'Choose a device' });
  const userIn = allowUser ? h('input.input', { placeholder: pair('user (optional)', '用戶（可選）'), style: { maxWidth: '160px' }, 'aria-label': 'User name', on: { input: () => { user = userIn.value.trim(); ev.fire(get()); } } }) : null;
  const sync = () => {
    clear(btn);
    const p = ts.peers().find((x) => ts.peerName(x) === v || ts.peerIp(x) === v || x.DNSName === v);
    btn.append(h('span.ava', icon(p ? ts.peerIcon(p) : 'devices')), h('span.meta', h('b', v || pair('Choose a device…', '揀裝置…')), h('span', p ? `${ts.peerIp(p)} · ${p.OS || ''} · ${ts.peerPath(p)}` : pair('Pick from your tailnet or type a name or IP', '喺 tailnet 揀或者打名／IP'))), icon('unfold_more'));
  };
  const get = () => (v ? (user ? `${user}@${v}` : v) : undefined);
  btn.addEventListener('click', () => {
    const q = h('input.input', { placeholder: pair('Search devices, or type a name or IP and press Enter', '搜尋裝置，或者打名／IP 再撳 Enter'), 'aria-label': 'Search devices' });
    const list = h('div.picker-list', { role: 'listbox' });
    const all = [...(includeSelf && ts.self() ? [{ ...ts.self(), Online: true, isSelf: true }] : []), ...ts.peers()];
    const draw = () => {
      clear(list);
      const s = q.value.toLowerCase();
      const items = all.filter((p) => !s || `${ts.peerName(p)} ${ts.peerIp(p)} ${p.OS} ${(p.Tags || []).join(' ')}`.toLowerCase().includes(s));
      if (!items.length) list.append(h('div.empty.small', all.length ? pair('No device matches. Press Enter to use what you typed.', '冇符合嘅裝置。撳 Enter 用你打嘅字。') : pair('No peers loaded. Is Tailscale running? You can still type a name.', '未載入裝置。Tailscale 開咗未？都可以直接打名。')));
      for (const p of items.slice(0, 300)) {
        const val = preferIp ? ts.peerIp(p) : ts.peerName(p);
        const st = ts.peerPath(p);
        list.append(h('button.pick-row', { type: 'button', role: 'option', 'aria-checked': String(val === v), on: { click: () => { v = val; sync(); ev.fire(get()); pop.close(); } } },
          h('span.ava', icon(ts.peerIcon(p))), h('span.meta', h('b', ts.peerName(p) + (p.isSelf ? ' (this device)' : '')), h('span', `${ts.peerIp(p)} · ${p.OS || ''}`)),
          h('span.badge.' + (st === 'direct' ? 'ok' : st === 'relay' ? 'warn' : st === 'offline' ? 'err' : 'info'), t(st === 'idle' ? 'idle' : st)), h('span.radio-dot')));
      }
    };
    q.addEventListener('input', draw);
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && q.value.trim()) { v = q.value.trim(); sync(); ev.fire(get()); pop.close(); } });
    draw();
    const pop = popover(btn, h('div.stack', q, list), { width: 460 });
    setTimeout(() => q.focus(), 20);
  });
  sync();
  return { el: allowUser ? h('div.row.nowrap', userIn, btn) : btn, get, set: (x) => { v = x || ''; sync(); }, onChange: ev.on };
}

export function exitNodePick(value, { label } = {}) {
  const ev = emitter();
  let v = value;
  const list = h('div.picker-list', { role: 'radiogroup', 'aria-label': label || 'Exit node' });
  const filter = h('input.input', { placeholder: pair('Filter by name, country or city', '按名、國家或城市篩選'), 'aria-label': 'Filter exit nodes' });
  const draw = () => {
    clear(list);
    const opts = [{ ip: '', name: pair('None: route traffic normally', '無：正常上網'), country: '', ico: 'block' }, { ip: 'auto:any', name: pair('Automatic (best available)', '自動（最佳）'), country: '', ico: 'auto_awesome' }, ...(ts.data.exitNodes || []).map((x) => ({ ...x, ico: 'travel_explore' }))];
    const s = filter.value.toLowerCase();
    for (const o of opts.filter((o) => !s || `${o.name} ${o.country} ${o.city} ${o.ip}`.toLowerCase().includes(s))) {
      list.append(h('button.pick-row', { type: 'button', role: 'radio', 'aria-checked': String((v ?? null) === (o.ip ?? null) || (v === o.name && !!o.name)), on: { click: () => { v = o.ip; draw(); ev.fire(v); sound('click'); } } },
        h('span.ava', icon(o.ico)), h('span.meta', h('b', o.name || o.ip), h('span', [o.ip, o.country, o.city, o.status].filter(Boolean).join(' · ') || ' ')), h('span.radio-dot')));
    }
  };
  filter.addEventListener('input', draw);
  const refresh = h('button.btn.small.outline', { type: 'button', on: { click: async () => { refresh.disabled = true; await ts.loadExitNodes().catch(() => {}); refresh.disabled = false; draw(); } } }, icon('refresh'), t('refresh'));
  draw();
  if (!ts.data.exitNodes) ts.loadExitNodes().then(draw).catch(() => {});
  return { el: h('div.stack', h('div.row.nowrap', filter, refresh), list), get: () => v, set: (x) => { v = x; draw(); }, onChange: ev.on };
}

export function accountPick(value, { label } = {}) {
  const ev = emitter();
  let v = value;
  const list = h('div.picker-list', { role: 'radiogroup', 'aria-label': label || 'Account' });
  const draw = () => {
    clear(list);
    const accts = ts.data.accounts || [];
    if (!accts.length) list.append(h('div.empty.small', pair('No accounts listed yet.', '未有帳戶。')));
    for (const a of accts) {
      const id = a.ID || a.id || a.Account || a.account;
      const name = a.Account || a.account || a.Name || id;
      list.append(h('button.pick-row', { type: 'button', role: 'radio', 'aria-checked': String(v === name || v === id), on: { click: () => { v = name; draw(); ev.fire(v); } } },
        h('span.ava', icon('account_circle')), h('span.meta', h('b', name), h('span', `${a.Tailnet || a.tailnet || ''} · id ${id}${a.Selected || a.selected ? ' · current' : ''}`)), h('span.radio-dot')));
    }
  };
  ts.loadAccounts().then(draw).catch(draw);
  draw();
  return { el: list, get: () => v, set: (x) => { v = x; draw(); }, onChange: ev.on };
}

/** Serve/Funnel target builder: port, local URL, file or folder, or static text. */
export function serveTarget(value = '', { label } = {}) {
  const ev = emitter();
  let kind = 'port';
  const port = portStepper(3000, { label: 'Local port' });
  const scheme = segmented([{ value: 'http', label: 'http' }, { value: 'https', label: 'https' }, { value: 'https+insecure', label: 'https (self-signed)' }, { value: 'tcp', label: 'tcp' }], 'http', { label: 'Backend scheme' });
  const host = text('127.0.0.1', { label: 'Backend host', mono: true });
  const pathIn = text('', { label: 'Backend path', placeholder: '/', mono: true });
  const fp = pathPick('', { mode: 'file', label: 'File' });
  const dp = pathPick('', { mode: 'dir', label: 'Folder' });
  const txt = text('Hello from Tailscale!', { label: 'Text', multiline: true });
  const panes = {
    port: h('div.stack', h('span.small.muted', pair('Forward to a port on this computer.', '轉發去本機一個 port。')), port.el),
    url: h('div.stack', scheme.el, h('div.row.nowrap', host.el, port.el), pathIn.el),
    file: h('div.stack', fp.el), dir: h('div.stack', dp.el), text: h('div.stack', txt.el)
  };
  const pick = segmented([{ value: 'port', label: 'Port', icon: 'settings_ethernet' }, { value: 'url', label: 'URL', icon: 'link' }, { value: 'file', label: pair('File', '檔案'), icon: 'description' }, { value: 'dir', label: pair('Folder', '資料夾'), icon: 'folder' }, { value: 'text', label: pair('Text', '文字'), icon: 'notes' }], kind, { label: 'Target type' });
  const holder = h('div');
  const show = () => { clear(holder).append(panes[kind]); };
  pick.onChange((k) => { kind = k; show(); ev.fire(get()); });
  [port, scheme, host, pathIn, fp, dp, txt].forEach((c) => c.onChange(() => ev.fire(get())));
  const get = () => {
    if (kind === 'port') return port.get() ? String(port.get()) : undefined;
    if (kind === 'url') return `${scheme.get()}://${host.get() || '127.0.0.1'}${port.get() ? ':' + port.get() : ''}${pathIn.get() || ''}`;
    if (kind === 'file') return fp.get();
    if (kind === 'dir') return dp.get();
    return txt.get() ? `text:${txt.get()}` : undefined;
  };
  show();
  if (value) { kind = 'url'; pick.set('url'); show(); }
  return { el: h('div.stack', pick.el, holder), get, set: () => {}, onChange: ev.on };
}

export function certHost(value = '', { label } = {}) {
  const self = ts.self();
  const sugg = self?.DNSName ? [self.DNSName.replace(/\.$/, '')] : [];
  const c = text(value || sugg[0] || '', { label, mono: true, placeholder: 'machine.tailnet-name.ts.net' });
  if (sugg.length) c.el.append(h('div.suggest', sugg.map((s) => h('button.chip.choice', { type: 'button', on: { click: () => { c.set(s); c.input.dispatchEvent(new Event('input')); } } }, s))));
  return c;
}

export function enumSelect(options, value, { label, labels } = {}) {
  if (options.length <= 6) return segmented(options.map((o, i) => ({ value: o, label: labels?.[i] || (o === '' ? t('none') : o) })), value, { label });
  const ev = emitter();
  const sel = h('select.input', { 'aria-label': label || 'Choice' }, options.map((o, i) => h('option', { value: o, selected: o === value }, labels?.[i] || o || '—')));
  sel.addEventListener('change', () => ev.fire(sel.value));
  return { el: sel, get: () => sel.value, set: (v) => { sel.value = v; }, onChange: ev.on };
}

/** Pick the right rich control for a catalogue flag or positional. */
export function forSpec(spec, { triState, value } = {}) {
  const label = spec.name;
  const v = value ?? spec.default;
  switch (spec.type) {
    case 'bool': return switchCtl(triState ? value : v, { label, triState });
    case 'enum': return enumSelect(spec.options, v ?? spec.options[0], { label, labels: spec.optionLabels });
    case 'int': return stepper(v, { min: spec.min ?? 0, max: spec.max ?? 1e9, label, allowEmpty: true });
    case 'port': return portStepper(v, { label, allowZero: spec.allowZero });
    case 'duration': return duration(v, { label });
    case 'cidrs': return chips([], { kind: 'cidrs', label, suggestions: ['198.51.100.0/24', '203.0.113.0/24', '192.0.2.0/24', '0.0.0.0/0', '::/0'] });
    case 'tags': return chips([], { kind: 'tags', label, suggestions: ['tag:server', 'tag:ci', 'tag:prod', 'tag:dev'] });
    case 'keys': return chips([], { kind: 'keys', label });
    case 'caps': return chips([], { kind: 'caps', label });
    case 'peer': return peerPick(v, { label, preferIp: spec.preferIp, allowUser: spec.allowUser, includeSelf: true });
    case 'exitnode': return exitNodePick(value, { label });
    case 'account': return accountPick(v, { label });
    case 'path': return pathPick(v, { mode: 'file', label });
    case 'savepath': return pathPick(v, { mode: 'save', label });
    case 'dir': return pathPick(v, { mode: 'dir', label });
    case 'files': return pathPick(Array.isArray(v) ? v : [], { mode: 'files', label });
    case 'secret': return secret(v, { label });
    case 'servetarget': return serveTarget('', { label });
    case 'certhost': return certHost(v, { label });
    case 'url': return text(v, { label, mono: true, type: 'url', validate: (s) => (s && !/^https?:\/\//.test(s) ? pair('Must start with http:// or https://', '要用 http:// 或 https:// 開頭') : null) });
    case 'ip': return text(v, { label, mono: true, placeholder: '100.64.0.1', validate: (s) => (s && !/^[0-9a-fA-F:.]+$/.test(s) ? pair('Not an IP address', '唔係 IP 位址') : null) });
    default: return text(v, { label, placeholder: spec.placeholder, mono: true });
  }
}

export function field(labelNode, control, { help, flag, info, wide, prov } = {}) {
  return h(`div.field${wide ? '.span2' : ''}`, { dataset: { el: 'field-' + (flag || uid()) } },
    h('div.lbl', info || null, labelNode, flag ? h('code.flag', flag) : null), control.el || control, help ? h('div.help', help) : null, prov ? h('div.provline', prov) : null);
}
