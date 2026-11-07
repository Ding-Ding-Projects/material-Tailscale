// In-page tabs (Midnight Mesh 2): a scrollable tab list with an animated indicator,
// roving focus and Left/Right/Home/End keys. items: [{ value, label, icon }].
import { h, icon } from '../core/dom.js';

export function mtabs(items, selected, { label = 'Sections', onChange } = {}) {
  let cur = selected;
  const listeners = new Set(onChange ? [onChange] : []);
  const el = h('div.mtabs', { role: 'tablist', 'aria-label': label });
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
  return { el, get: () => cur, set: (v) => pick(v, false), onChange: (fn) => listeners.add(fn) };
}
