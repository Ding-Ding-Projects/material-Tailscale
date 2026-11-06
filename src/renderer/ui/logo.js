import * as store from '../core/store.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/** Logo presets: mesh (default), orbit, knot, plus a locally converted custom image. */
export function logoSvg(size = 24, which) {
  const kind = which || store.get('logo');
  if (kind === 'custom' && store.get('logoCustom')) {
    const img = document.createElement('img');
    img.src = store.get('logoCustom'); img.width = size; img.height = size; img.alt = ''; img.style.borderRadius = '6px';
    return img;
  }
  const svg = el('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  const c = ['var(--primary)', 'var(--secondary)', 'var(--tertiary)'];
  if (kind === 'orbit') {
    svg.append(el('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: c[0], 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }), el('circle', { cx: 12, cy: 12, r: 3.4, fill: c[1] }), el('circle', { cx: 21, cy: 12, r: 2.2, fill: c[2] }), el('circle', { cx: 5.6, cy: 5.6, r: 1.8, fill: c[0] }));
  } else if (kind === 'knot') {
    svg.append(el('path', { d: 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0', fill: 'none', stroke: c[0], 'stroke-width': 2 }), el('path', { d: 'M12 5v14M5 12h14', stroke: c[1], 'stroke-width': 2, 'stroke-linecap': 'round' }), el('circle', { cx: 12, cy: 12, r: 2.4, fill: c[2] }));
  } else {
    const pos = [5, 12, 19];
    pos.forEach((y, r) => pos.forEach((x, col) => {
      const lit = r === 1 || (r === 2 && col === 1) || (r === 0 && col === 0);
      svg.append(el('circle', { cx: x, cy: y, r: 2.6, fill: r === 2 && col === 1 ? c[2] : r === 1 ? c[1] : c[0], opacity: lit ? 1 : 0.4 }));
    }));
  }
  return svg;
}
