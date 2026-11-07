import { h, icon, clear } from '../core/dom.js';
import * as store from '../core/store.js';
import { t, tl, emoji, pair } from '../core/i18n.js';
import { sound } from '../core/feedback.js';
import { liveOption } from './live-options.js';

// ---------------- toasts + notification centre ----------------
let toastHost;
// At most three toasts stay on screen, and fewer when a short window cannot hold them; older
// ones leave (they stay in the notification centre), so a pile of errors never stacks past
// the top of the window where it could take focus unseen.
const MAX_TOASTS = 3;
const dismissers = new WeakMap();
function trimToasts() {
  const shown = [...toastHost.children].filter((x) => !x.classList.contains('out'));
  let height = shown.reduce((sum, x) => sum + x.offsetHeight + 10, 0);
  for (let i = 0; i < shown.length - 1 && (shown.length - i > MAX_TOASTS || height > innerHeight - 32); i++) {
    height -= shown[i].offsetHeight + 10;
    dismissers.get(shown[i])?.();
  }
}
const live = h('div.sr-only', { 'aria-live': 'polite', role: 'status' });

export function mountOverlays() {
  toastHost = h('div.toasts', { role: 'region', 'aria-label': t('notifications') });
  document.body.append(toastHost, live);
  store.on((k) => { if (k === 'lang') toastHost.setAttribute('aria-label', t('notifications')); });
  addEventListener('resize', trimToasts);
}

export function announce(text) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }

export function toast(message, { kind = 'info', title, actions = [], sticky, emojiChar } = {}) {
  const decor = emojiChar ? emoji(emojiChar) : emoji({ ok: '✅', err: '🚨', warn: '⚠️', info: '💬' }[kind]);
  const el = h(`div.toast.${kind}`, { role: kind === 'err' ? 'alert' : 'status', tabindex: '0' },
    icon({ ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' }[kind], '.fill'),
    h('div.body', title ? h('b', decor + title) : null, h('div', title ? message : decor + message),
      actions.length ? h('div.row', { style: { marginTop: '8px' } }, actions.map((a) => h('button.btn.small.tonal', { on: { click: () => { a.run(); dismiss(); } } }, a.label))) : null),
    h('button.icon-btn.sm', { 'aria-label': t('close'), on: { click: () => dismiss() } }, icon('close')));
  // Focus that came from elsewhere goes back there when the toast leaves, so it is never lost.
  let cameFrom = null;
  el.addEventListener('focusin', (e) => { if (e.relatedTarget && !el.contains(e.relatedTarget)) cameFrom = e.relatedTarget; });
  // A timed toast waits while it has focus or the pointer, then gets at least two more seconds.
  let timer = 0, left = 5200, since = 0;
  // A leaving toast stops taking focus at once, before its exit animation ends.
  const dismiss = () => {
    if (el.classList.contains('out')) return;
    clearTimeout(timer); timer = 0;
    if (el.contains(document.activeElement)) {
      const back = cameFrom?.isConnected && !cameFrom.closest('[inert], [hidden]') ? cameFrom : document.getElementById('outlet');
      back?.focus({ preventScroll: true });
    }
    el.classList.add('out'); el.inert = true; el.tabIndex = -1; setTimeout(() => el.remove(), 200);
  };
  const held = () => el.matches(':hover') || el.contains(document.activeElement);
  const run = () => { if (timer || el.classList.contains('out') || held()) return; since = Date.now(); timer = setTimeout(dismiss, Math.max(left, 2000)); };
  const hold = () => { if (!timer) return; clearTimeout(timer); timer = 0; left -= Date.now() - since; };
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
  toastHost.append(el);
  dismissers.set(el, dismiss);
  trimToasts();
  announce((title ? title + '. ' : '') + message);
  if (kind === 'err' || kind === 'ok') sound(kind === 'err' ? 'error' : 'success');
  if (!(sticky || kind === 'err' || kind === 'warn')) {
    run();
    el.addEventListener('focusin', hold); el.addEventListener('pointerenter', hold);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) setTimeout(run, 0); });
    el.addEventListener('pointerleave', () => setTimeout(run, 0));
  }
  const hist = store.get('notifyHistory');
  store.set('notifyHistory', [{ id: Date.now() + Math.random(), at: Date.now(), kind, title: title || '', message }, ...hist].slice(0, 500), { record: false });
  return dismiss;
}

// ---------------- dialogs ----------------
// ---------------- modal focus ----------------
// While a modal is open, Tab and Shift+Tab cycle inside it and focus that lands outside it is
// brought back. Modals stack: only the newest one holds focus. Returns a release function.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const modals = [];
const focusables = (box) => [...box.querySelectorAll(FOCUSABLE)].filter((x) => x.getClientRects().length && !x.closest('[inert], [hidden]'));
const top = () => { while (modals.length && !modals[modals.length - 1].isConnected) modals.pop(); return modals[modals.length - 1]; };
document.addEventListener('keydown', (e) => {
  const box = top();
  if (!box || e.key !== 'Tab') return;
  const f = focusables(box);
  if (!f.length) { e.preventDefault(); return; }
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
}, true);
document.addEventListener('focusin', (e) => {
  const box = top();
  if (box && !box.contains(e.target) && !e.target.closest?.('.toasts, .popover')) focusables(box)[0]?.focus();
});
export function holdFocus(box) {
  modals.push(box);
  return () => { const i = modals.lastIndexOf(box); if (i >= 0) modals.splice(i, 1); };
}

export function dialog({ title, body, actions = [], wide, onClose, emojiChar, initialFocus }) {
  const prev = document.activeElement;
  const close = (v) => { release(); scrim.remove(); document.removeEventListener('keydown', esc, true); prev?.focus?.(); onClose?.(v); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
  const btns = actions.map((a) => h(`button.btn${a.kind ? '.' + a.kind : ''}`, { on: { click: async () => { const r = a.run ? await a.run() : a.value; if (r !== false) close(r ?? a.value); } } }, a.label));
  const d = h(`div.dialog${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': typeof title === 'string' ? title : 'Dialog' },
    h('div.row.nowrap', h('h2', { style: { flex: 1 } }, (emojiChar ? emoji(emojiChar) : '') , title), h('button.icon-btn', { 'aria-label': t('close'), on: { click: () => close(null) } }, icon('close'))),
    body, btns.length ? h('div.row', { style: { justifyContent: 'flex-end' } }, btns) : null);
  const scrim = h('div.scrim', { on: { mousedown: (e) => { if (e.target === scrim) close(null); } } }, d);
  document.body.append(scrim);
  const release = holdFocus(d);
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

export function popover(anchorOrPoint, content, { onClose, width, label } = {}) {
  closePopover();
  const prev = document.activeElement;
  const el = h('div.popover', { role: 'dialog', 'aria-label': label || t('menu') }, content);
  // A popover is not modal: when keyboard focus moves outside it, it closes.
  el.addEventListener('focusout', (e) => { if (e.relatedTarget && !el.contains(e.relatedTarget) && openPop?.el === el) setTimeout(() => { if (!el.contains(document.activeElement)) close(); }, 0); });
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
// A filterable menu is a combobox (the filter) driving a listbox of options through
// aria-activedescendant. Focus stays in the filter: Up and Down move the active option, Enter
// runs it, Left and Right change a live value. A live value (live: { kind: 'switch'|'choice'|
// 'range'|'swatch', get(), set(v), options, min, max, step, format(v), disabled: reason,
// onSwatch() }) is drawn inside its option (src/renderer/ui/live-options.js); changes apply at
// once, the menu stays open, and every live option re-syncs when settings change.
let menuSeq = 0;
export function menu(at, items, { title } = {}) {
  const uid = 'mn' + (++menuSeq);
  const label = title || t('menu');
  const list = h('div.menu-list', { role: 'listbox', id: `${uid}-list`, 'aria-label': label });
  const input = h('input', { role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': `${uid}-list`, placeholder: t('filter'), 'aria-label': `${t('filter')} · ${label}` });
  let regex = false;
  const reBtn = h('button.icon-btn.sm', { type: 'button', 'aria-label': pair('Regular expression filter', '正則表達式篩選'), 'aria-pressed': 'false', title: 'Regex', on: { click: () => { regex = !regex; reBtn.setAttribute('aria-pressed', String(regex)); reBtn.style.color = regex ? 'var(--primary)' : ''; render(); input.focus(); } } }, h('span.mono', '.*'));
  let shown = [];
  let active = 0;
  const mark = () => {
    shown.forEach((s, i) => s.opt.setAttribute('aria-selected', String(i === active)));
    const cur = shown[active]?.opt;
    if (cur) { input.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  };
  const fire = (i) => {
    const s = shown[i];
    if (!s || s.it.live?.disabled) return;
    if (s.it.run) { pop.close(); s.it.run(); return; }
    s.live?.activate();
  };
  const render = () => {
    clear(list);
    shown = [];
    const q = input.value.trim();
    let test = () => true;
    if (q) {
      if (regex) { try { const re = new RegExp(q, 'i'); test = (x) => re.test(x); input.classList.remove('invalid'); } catch { input.classList.add('invalid'); } }
      else test = (x) => x.toLowerCase().includes(q.toLowerCase());
    }
    for (const it of items) {
      if (it === '-') { if (!q) list.append(h('div.menu-sep', { 'aria-hidden': 'true' })); continue; }
      if (!test(it.label)) continue;
      const i = shown.length;
      const live = it.live ? liveOption(it.live, { announce }) : null;
      const note = it.live?.disabled ? ` · ${it.live.disabled}` : '';
      const opt = h(`div.menu-item${it.danger ? '.danger' : ''}${live ? '.has-ctl' : ''}`, {
        role: 'option', id: `${uid}-o${i}`, 'aria-selected': 'false', 'aria-disabled': it.live?.disabled ? 'true' : null, 'aria-keyshortcuts': it.kbd || null, title: it.live?.disabled || null,
        on: { click: () => { active = i; mark(); fire(i); input.focus(); }, mousemove: () => { if (active !== i) { active = i; mark(); } } }
      }, it.icon ? icon(it.icon) : null, h('span.menu-label', it.label, note ? h('span.small.muted', note) : null), live?.visual, it.kbd ? h('span.kbd', { 'aria-hidden': 'true' }, it.kbd) : null);
      if (live) {
        // The option keeps its visible text as its name; the value and the keys go in its description.
        const desc = () => { opt.setAttribute('aria-description', `${live.state()}. ${live.hint()}`); if (live.checked() !== null) opt.setAttribute('aria-checked', String(live.checked())); };
        live.onChange(desc); desc();
      }
      shown.push({ it, live, opt });
      list.append(opt);
    }
    if (!shown.length) list.append(h('div.menu-empty', { 'aria-hidden': 'true' }, pair('Nothing matches.', '冇嘢符合。')));
    active = Math.min(active, Math.max(0, shown.length - 1));
    mark();
  };
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    const n = shown.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { active = (active + 1) % n; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { active = (active - 1 + n) % n; mark(); } }
    else if (e.key === 'PageDown' || e.key === 'PageUp') { e.preventDefault(); if (n) { active = e.key === 'PageDown' ? n - 1 : 0; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); fire(active); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && shown[active]?.live) { if (shown[active].live.key(e)) e.preventDefault(); }
  });
  render();
  const unlisten = store.on(() => shown.forEach((x) => x.live?.sync()));
  const pop = popover(at, [h('div.menu-filter', input, reBtn), list], { onClose: unlisten, label });
  setTimeout(() => input.focus(), 20);
  return pop;
}

// ---------------- floating, resizable, draggable panels ----------------
export function floatPanel(id, title, content, { width = 420, height = 520, anchor } = {}) {
  const sizes = store.get('panelSizes')[id];
  const panel = h('div.panel-float', { role: 'dialog', 'aria-label': title });
  const head = h('div.panel-head', h('h2.panel-title', { style: { flex: 1 } }, title),
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
