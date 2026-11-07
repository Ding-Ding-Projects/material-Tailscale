import { h, icon, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { t, tl, emoji, pair } from '../core/i18n.js';
import { sound } from '../core/feedback.js';

// ---------------- toasts + notification centre ----------------
let toastHost;
const live = h('div.sr-only', { 'aria-live': 'polite', role: 'status' });

export function mountOverlays() {
  toastHost = h('div.toasts', { role: 'region', 'aria-label': 'Notifications' });
  document.body.append(toastHost, live);
}

export function announce(text) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }

export function toast(message, { kind = 'info', title, actions = [], sticky, emojiChar } = {}) {
  const decor = emojiChar ? emoji(emojiChar) : emoji({ ok: '✅', err: '🚨', warn: '⚠️', info: '💬' }[kind]);
  const el = h(`div.toast.${kind}`, { role: kind === 'err' ? 'alert' : 'status', tabindex: '0' },
    icon({ ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' }[kind], '.fill'),
    h('div.body', title ? h('b', decor + title) : null, h('div', title ? message : decor + message),
      actions.length ? h('div.row', { style: { marginTop: '8px' } }, actions.map((a) => h('button.btn.small.tonal', { on: { click: () => { a.run(); dismiss(); } } }, a.label))) : null),
    h('button.icon-btn.sm', { 'aria-label': t('close'), on: { click: () => dismiss() } }, icon('close')));
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
  toastHost.append(el);
  announce((title ? title + '. ' : '') + message);
  if (kind === 'err' || kind === 'ok') sound(kind === 'err' ? 'error' : 'success');
  if (!(sticky || kind === 'err' || kind === 'warn')) setTimeout(dismiss, 5200);
  const hist = store.get('notifyHistory');
  store.set('notifyHistory', [{ id: Date.now() + Math.random(), at: Date.now(), kind, title: title || '', message }, ...hist].slice(0, 500), { record: false });
  return dismiss;
}

// ---------------- dialogs ----------------
export function dialog({ title, body, actions = [], wide, onClose, emojiChar, initialFocus }) {
  const prev = document.activeElement;
  const close = (v) => { scrim.remove(); document.removeEventListener('keydown', esc, true); prev?.focus?.(); onClose?.(v); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
  const btns = actions.map((a) => h(`button.btn${a.kind ? '.' + a.kind : ''}`, { on: { click: async () => { const r = a.run ? await a.run() : a.value; if (r !== false) close(r ?? a.value); } } }, a.label));
  const d = h(`div.dialog${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof title === 'string' ? title : 'Dialog' },
    h('div.row.nowrap', h('h2', { style: { flex: 1 } }, (emojiChar ? emoji(emojiChar) : '') , title), h('button.icon-btn', { 'aria-label': t('close'), on: { click: () => close(null) } }, icon('close'))),
    body, btns.length ? h('div.row', { style: { justifyContent: 'flex-end' } }, btns) : null);
  const scrim = h('div.scrim', { on: { mousedown: (e) => { if (e.target === scrim) close(null); } } }, d);
  document.body.append(scrim);
  document.addEventListener('keydown', esc, true);
  setTimeout(() => (initialFocus?.() || d.querySelector('input,button.btn,select,textarea'))?.focus(), 30);
  return { close, el: d };
}

export function confirmDialog(title, message, { okLabel = t('apply'), danger } = {}) {
  return new Promise((res) => {
    dialog({ title, body: h('p', message), emojiChar: danger ? '⚠️' : '💬', onClose: (v) => res(!!v), actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: okLabel, kind: danger ? 'danger' : '', value: true }] });
  });
}

// ---------------- popovers ----------------
let openPop = null;
export function closePopover() { openPop?.close(); }

export function popover(anchorOrPoint, content, { onClose, width } = {}) {
  closePopover();
  const prev = document.activeElement;
  const el = h('div.popover', { role: 'dialog' }, content);
  if (width) el.style.width = width + 'px';
  document.body.append(el);
  place(el, anchorOrPoint);
  const close = () => { el.remove(); document.removeEventListener('mousedown', out, true); document.removeEventListener('keydown', key, true); openPop = null; prev?.focus?.(); onClose?.(); };
  const out = (e) => { if (!el.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  setTimeout(() => { document.addEventListener('mousedown', out, true); document.addEventListener('keydown', key, true); }, 0);
  openPop = { close, el };
  return openPop;
}

export function place(el, anchor) {
  const vw = innerWidth, vh = innerHeight;
  const r = anchor instanceof Element ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const w = el.offsetWidth, ht = el.offsetHeight;
  let x = r.left, y = r.bottom + 6;
  if (x + w > vw - 8) x = Math.max(8, vw - w - 8);
  if (y + ht > vh - 8) y = r.top - ht - 6 >= 8 ? r.top - ht - 6 : Math.max(8, vh - ht - 8);
  el.style.left = x + 'px'; el.style.top = y + 'px';
}

// ---------------- context menus with filter + regex ----------------
export function menu(at, items, { title } = {}) {
  const list = h('div', { role: 'menu', 'aria-label': title || 'Menu' });
  const input = h('input', { placeholder: t('filter'), 'aria-label': t('filter') });
  let regex = false;
  const reBtn = h('button.icon-btn.sm', { 'aria-label': 'Regular expression filter', 'aria-pressed': 'false', title: 'Regex', on: { click: () => { regex = !regex; reBtn.setAttribute('aria-pressed', String(regex)); reBtn.style.color = regex ? 'var(--primary)' : ''; render(); } } }, h('span.mono', '.*'));
  const render = () => {
    clear(list);
    const q = input.value.trim();
    let test = () => true;
    if (q) {
      if (regex) { try { const re = new RegExp(q, 'i'); test = (s) => re.test(s); input.classList.remove('invalid'); } catch { input.classList.add('invalid'); } }
      else test = (s) => s.toLowerCase().includes(q.toLowerCase());
    }
    for (const it of items) {
      if (it === '-') { if (!q) list.append(h('div.menu-sep')); continue; }
      if (!test(it.label)) continue;
      if (it.control) { list.append(h('div', { style: { padding: '6px 10px' } }, it.control())); continue; }
      list.append(h(`button.menu-item${it.danger ? '.danger' : ''}`, { role: 'menuitem', 'aria-keyshortcuts': it.kbd || null, on: { click: () => { pop.close(); it.run(); } } }, it.icon ? icon(it.icon) : null, h('span', it.label), it.kbd ? h('span.kbd', it.kbd) : null));
    }
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('.menu-item')?.focus(); }
    if (e.key === 'Enter') { list.querySelector('.menu-item')?.click(); }
  });
  list.addEventListener('keydown', (e) => {
    const all = [...list.querySelectorAll('.menu-item')];
    const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) input.focus(); else all[i - 1]?.focus(); }
  });
  render();
  const pop = popover(at, [h('div.menu-filter', input, reBtn), list]);
  setTimeout(() => input.focus(), 20);
  return pop;
}

// ---------------- floating, resizable, draggable panels ----------------
export function floatPanel(id, title, content, { width = 420, height = 520, anchor } = {}) {
  const sizes = store.get('panelSizes')[id];
  const panel = h('div.panel-float', { role: 'dialog', 'aria-label': title });
  const head = h('header', h('span', { style: { flex: 1 } }, title),
    h('button.icon-btn.sm', { 'aria-label': 'Reset size and position', title: 'Reset size', on: { click: () => { const s = { ...store.get('panelSizes') }; delete s[id]; store.set('panelSizes', s, { record: false }); panel.style.width = width + 'px'; panel.style.height = height + 'px'; } } }, icon('fit_screen')),
    h('button.icon-btn.sm', { 'aria-label': t('close'), on: { click: () => close() } }, icon('close')));
  panel.append(head, h('div.content', content));
  panel.style.width = (sizes?.w || width) + 'px'; panel.style.height = (sizes?.h || height) + 'px';
  document.body.append(panel);
  if (sizes?.x !== undefined) { panel.style.left = Math.min(sizes.x, innerWidth - 100) + 'px'; panel.style.top = Math.min(sizes.y, innerHeight - 60) + 'px'; }
  else if (anchor) place(panel, anchor);
  else { panel.style.left = Math.max(8, innerWidth - panel.offsetWidth - 24) + 'px'; panel.style.top = '64px'; }
  const save = () => store.set('panelSizes', { ...store.get('panelSizes'), [id]: { x: panel.offsetLeft, y: panel.offsetTop, w: panel.offsetWidth, h: panel.offsetHeight } }, { record: false });
  let drag = null;
  head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', (e) => { if (!drag) return; panel.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - drag.dx)) + 'px'; panel.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - drag.dy)) + 'px'; });
  head.addEventListener('pointerup', () => { drag = null; save(); });
  head.tabIndex = 0;
  head.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 40 : 10;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    if (e.altKey) { panel.style.width = panel.offsetWidth + mv[0] + 'px'; panel.style.height = panel.offsetHeight + mv[1] + 'px'; }
    else { panel.style.left = panel.offsetLeft + mv[0] + 'px'; panel.style.top = panel.offsetTop + mv[1] + 'px'; }
    save();
  });
  new ResizeObserver(() => save()).observe(panel);
  const prev = document.activeElement;
  const close = () => { panel.remove(); prev?.focus?.(); };
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  setTimeout(() => panel.querySelector('input,button,select,textarea')?.focus(), 30);
  return { close, el: panel };
}

/** Collapsible section whose open state persists. */
export function collapsible(id, title, body, { startCollapsed = false, badge } = {}) {
  const saved = store.get('collapsed')[id];
  const open = saved === undefined ? !startCollapsed : !saved;
  const content = h('div', { hidden: !open }, body);
  const btn = h('button.collapser', { 'aria-expanded': String(open), on: { click: () => {
    const now = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(now)); content.hidden = !now;
    store.set('collapsed', { ...store.get('collapsed'), [id]: !now }, { record: false });
  } } }, icon('expand_more'), title, badge ? h('span.badge.warn', badge) : null);
  return h('div.stack', btn, content);
}

export function notificationCentre() {
  const box = h('div.stack');
  const sel = new Set();
  const q = h('input.input', { placeholder: t('filter'), 'aria-label': t('filter') });
  const render = () => {
    clear(box);
    const items = store.get('notifyHistory').filter((n) => !q.value || (n.title + n.message).toLowerCase().includes(q.value.toLowerCase()));
    if (!items.length) { box.append(h('div.empty', icon('notifications_off'), pair('No notifications yet.', '未有通知。'))); return; }
    box.append(h('div.row', h('button.btn.small.outline', { on: { click: () => { items.forEach((n) => sel.add(n.id)); render(); } } }, pair('Select all matches', '全選')),
      h('button.btn.small.outline', { on: { click: () => { items.forEach((n) => (sel.has(n.id) ? sel.delete(n.id) : sel.add(n.id))); render(); } } }, pair('Invert', '反選')),
      h('button.btn.small.danger', { disabled: !sel.size, on: { click: () => { store.set('notifyHistory', store.get('notifyHistory').filter((n) => !sel.has(n.id)), { record: false }); toast(pair(`Removed ${sel.size} notifications.`, `刪咗 ${sel.size} 個通知。`), { kind: 'ok' }); sel.clear(); render(); } } }, pair(`Delete ${sel.size} selected`, `刪除已選 ${sel.size} 個`))));
    for (const n of items) {
      const cb = h('input', { type: 'checkbox', checked: sel.has(n.id), 'aria-label': 'Select notification', on: { change: () => { cb.checked ? sel.add(n.id) : sel.delete(n.id); render(); } } });
      box.append(h('div.row.nowrap', { style: { padding: '8px', borderRadius: '12px', background: 'var(--surface-2)' } }, cb, h('span.badge.' + ({ err: 'err', ok: 'ok', warn: 'warn' }[n.kind] || 'info'), n.kind), h('div', { style: { flex: 1, minWidth: 0 } }, n.title ? h('b', n.title) : null, h('div.small', n.message)), h('span.small.muted', new Date(n.at).toLocaleTimeString())));
    }
  };
  q.addEventListener('input', render);
  render();
  return h('div.stack', q, box);
}
