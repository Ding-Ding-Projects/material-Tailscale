// Live values drawn inside a listbox option: a switch, a choice, a range or a colour swatch.
// The option is the only thing that takes focus (as the combobox's active descendant); the
// drawing is presentational, so assistive technology meets one option with a name, a state
// and a hint instead of controls nested inside it.
// Keyboard (forwarded by the combobox): Left and Right change the value; Enter toggles a
// switch, steps a choice or opens a swatch. Pointer: click a segment, the switch or the
// swatch, or press and drag along a range.
import { h, clear } from '../core/dom.js';
import { pair } from '../core/i18n.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * L: { kind: 'switch'|'choice'|'range'|'swatch', get, set, options?, min?, max?, step?, format?, disabled?, onSwatch? }
 * Returns { visual, state(), checked(), hint(), key(e), activate(), sync(), onChange(fn) }.
 */
export function liveOption(L, { announce } = {}) {
  const listeners = new Set();
  const visual = h('span.menu-ctl.lv', { 'aria-hidden': 'true' });
  const fmt = (v) => (L.format ? L.format(v) : String(v));
  const state = () => {
    const v = L.get();
    if (L.kind === 'switch') return v ? pair('on', '開') : pair('off', '關');
    if (L.kind === 'choice') return L.options.find((o) => o.value === v)?.label ?? String(v);
    if (L.kind === 'range') return fmt(v);
    return String(v);
  };
  const changed = () => { draw(); for (const fn of listeners) fn(); announce?.(state()); };
  const put = (v) => { if (L.disabled) return; L.set(v); changed(); };
  const stepChoice = (d) => { const i = L.options.findIndex((o) => o.value === L.get()); put(L.options[(i + d + L.options.length) % L.options.length].value); };
  const stepRange = (d) => { const s = L.step || 1; put(clamp(Math.round((Number(L.get()) + d * s) / s) * s, L.min, L.max)); };

  function draw() {
    clear(visual);
    const v = L.get();
    if (L.kind === 'switch') {
      visual.append(h('span.switch', { dataset: { checked: String(!!v) }, on: { click: (e) => { e.stopPropagation(); put(!L.get()); } } }));
    } else if (L.kind === 'choice') {
      visual.append(h('span.seg', L.options.map((o) => h('span.lv-seg', { dataset: { checked: String(o.value === v) }, on: { click: (e) => { e.stopPropagation(); put(o.value); } } }, o.label))));
    } else if (L.kind === 'range') {
      const p = ((Number(v) - L.min) / (L.max - L.min)) * 100;
      const track = h('span.lv-track', { style: { '--p': `${clamp(p, 0, 100)}%` } }, h('span.lv-fill'), h('span.lv-thumb'));
      const at = (e) => { const r = track.getBoundingClientRect(); const s = L.step || 1; put(clamp(Math.round((L.min + ((e.clientX - r.left) / r.width) * (L.max - L.min)) / s) * s, L.min, L.max)); };
      track.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); track.setPointerCapture(e.pointerId); at(e); const move = (m) => at(m); track.addEventListener('pointermove', move); track.addEventListener('pointerup', () => track.removeEventListener('pointermove', move), { once: true }); });
      track.addEventListener('click', (e) => e.stopPropagation());
      visual.append(track, h('span.lv-out', fmt(v)));
    } else if (L.kind === 'swatch') {
      visual.append(h('span.menu-swatch', { style: { background: v }, on: { click: (e) => { e.stopPropagation(); L.onSwatch?.(); } } }));
    }
  }
  draw();
  return {
    visual,
    state,
    checked: () => (L.kind === 'switch' ? !!L.get() : null),
    hint: () => (L.disabled ? String(L.disabled) : L.kind === 'switch' ? pair('Enter switches it', '撳 Enter 切換') : L.kind === 'swatch' ? pair('Enter opens the colour picker', '撳 Enter 開顏色選擇器') : pair('Left and right arrows change it', '左右箭嘴改佢')),
    key: (e) => {
      if (L.disabled) return false;
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return false;
      if (L.kind === 'switch') put(d > 0);
      else if (L.kind === 'choice') stepChoice(d);
      else if (L.kind === 'range') stepRange(d);
      else return false;
      return true;
    },
    activate: () => {
      if (L.disabled) return false;
      if (L.kind === 'switch') put(!L.get());
      else if (L.kind === 'choice') stepChoice(1);
      else if (L.kind === 'swatch') L.onSwatch?.();
      else return false;
      return true;
    },
    sync: () => { draw(); for (const fn of listeners) fn(); },
    onChange: (fn) => listeners.add(fn)
  };
}
