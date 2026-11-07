// Tiny DOM builder. h('div.card#id', { attrs, on: {click}, style }, ...children)
export function h(sel, props, ...kids) {
  if (props == null || typeof props !== 'object' || Array.isArray(props) || props instanceof Node) { if (props != null) kids.unshift(props); props = {}; }
  const [, tag = 'div', rest = ''] = sel.match(/^([a-z0-9-]*)(.*)$/i) || [];
  const el = document.createElement(tag || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  // Icon-font glyphs are ligature words ("content_copy"); a screen reader must never read them.
  if (el.classList.contains('msr') && !el.hasAttribute('aria-hidden')) el.setAttribute('aria-hidden', 'true');
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const icon = (name, extra = '') => h('span.msr' + extra, { 'aria-hidden': 'true', text: name });

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a view swap with the View Transitions API when motion is allowed. */
export function transition(fn) {
  if (!reducedMotion() && document.startViewTransition) return document.startViewTransition(fn);
  fn();
  return null;
}

export function uid(prefix = 'id') { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; while (Math.abs(n) >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtAgo(date) {
  const d = new Date(date);
  if (!+d || d.getFullYear() < 2000) return '—';
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function fmtDateTime(d) {
  const date = new Date(d);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const p = (n) => String(n).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())} (${tz}, UTC${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)})`;
}
