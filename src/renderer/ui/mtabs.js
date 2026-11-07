// In-page tabs (Midnight Mesh 2): a scrollable tab list with an animated indicator,
// roving focus and Left/Right/Home/End keys. items: [{ value, label, icon }].
// When the tabs run past either edge, that edge fades and shows an arrow button, so a
// section that is out of view never looks like the end of the list. The arrows are for the
// mouse; the keyboard already reaches every tab with the arrow keys.
import { h, icon } from '../core/dom.js';
import { pair } from '../core/i18n.js';

const edgesSeen = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => requestAnimationFrame(() => entries.forEach((e) => e.target.__mtEdges?.())));

export function mtabs(items, selected, { label = 'Sections', onChange } = {}) {
  let cur = selected;
  const listeners = new Set(onChange ? [onChange] : []);
  const el = h('div.mtabs', { role: 'tablist', 'aria-label': label });
  const reduced = () => document.documentElement.classList.contains('reduce-motion');
  const nudge = (dir) => el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.6), behavior: reduced() ? 'auto' : 'smooth' });
  const arrow = (dir, name, text) => h(`button.icon-btn.sm.mtabs-arrow.${dir < 0 ? 'prev' : 'next'}`, { type: 'button', tabindex: '-1', 'aria-label': text, title: text, on: { click: () => nudge(dir) } }, icon(name));
  const wrap = h('div.mtabs-wrap', arrow(-1, 'chevron_left', pair('Show earlier sections', '睇前面嘅分區')), el, arrow(1, 'chevron_right', pair('Show more sections', '睇更多分區')));
  const edges = () => {
    if (!wrap.isConnected) { edgesSeen?.unobserve(el); return; }
    const max = el.scrollWidth - el.clientWidth;
    wrap.classList.toggle('can-left', el.scrollLeft > 2);
    wrap.classList.toggle('can-right', el.scrollLeft < max - 2);
  };
  el.__mtEdges = edges;
  el.addEventListener('scroll', edges, { passive: true });
  edgesSeen?.observe(el);
  const draw = () => {
    el.replaceChildren(...items.map((it, i) => h('button.mtab', {
      type: 'button', role: 'tab', 'aria-selected': String(it.value === cur), tabindex: it.value === cur ? '0' : '-1', dataset: { el: `mtab-${it.value}` },
      on: {
        click: () => pick(it.value, true),
        keydown: (e) => {
          const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 }[e.key];
          if (k === undefined) return;
          e.preventDefault(); pick(items[(k + items.length) % items.length].value, true);
        }
      }
    }, it.icon ? icon(it.icon) : null, it.label)));
  };
  const pick = (v, focus) => {
    if (v === cur) return;
    cur = v; draw();
    if (focus) el.querySelector('[aria-selected="true"]')?.focus();
    el.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    for (const fn of listeners) fn(v);
  };
  draw();
  return { el: wrap, get: () => cur, set: (v) => pick(v, false), onChange: (fn) => listeners.add(fn) };
}
