import { h } from '../core/dom.js';

/** Collapsible, colour-coded JSON viewer. Values are text nodes, never HTML. */
export function jsonTree(value, { open = 1 } = {}) {
  const node = (v, depth, key) => {
    const k = key !== undefined ? [h('span.k', JSON.stringify(key)), ': '] : [];
    if (v === null) return h('div', k, h('span.z', 'null'));
    if (typeof v === 'string') return h('div', k, h('span.s', JSON.stringify(v)));
    if (typeof v === 'number') return h('div', k, h('span.n', String(v)));
    if (typeof v === 'boolean') return h('div', k, h('span.b', String(v)));
    const isArr = Array.isArray(v);
    const entries = isArr ? v.map((x, i) => [i, x]) : Object.entries(v);
    const d = h('details', { open: depth < open }, h('summary', k, isArr ? `[${entries.length}]` : `{${entries.length}}`));
    let rendered = false;
    const fill = () => { if (rendered) return; rendered = true; for (const [kk, vv] of entries.slice(0, 2000)) d.append(node(vv, depth + 1, isArr ? undefined : kk)); if (entries.length > 2000) d.append(h('div.z', `… ${entries.length - 2000} more`)); };
    if (depth < open) fill(); else d.addEventListener('toggle', fill, { once: true });
    return d;
  };
  return h('div.json-tree', node(value, 0));
}
