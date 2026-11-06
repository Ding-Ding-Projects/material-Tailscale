// Infinite colour picker: saturation/value field, hue and alpha sliders,
// numeric entry, and a translator across HEX, HEX8, RGB, HSL, HSV, HWB,
// CIELAB, LCH, OKLab, OKLCH and CMYK, with contrast, gamut notes and the
// animated rainbow option.
import { h, icon, clear } from '../core/dom.js';
import { pair } from '../core/i18n.js';
import { toast } from './overlay.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export function hexToRgb(hex) {
  let s = hex.replace('#', '');
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: s.length === 8 ? parseInt(s.slice(6), 16) / 255 : 1 };
}
const hex2 = (x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0');
export const rgbToHex = ({ r, g, b, a = 1 }, withA) => `#${hex2(r)}${hex2(g)}${hex2(b)}${withA || a < 1 ? hex2(a * 255) : ''}`;
function rgbToHsv({ r, g, b }) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let hh = 0; if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx }; }
function hsvToRgb({ h: hh, s, v }) { const f = (n) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 }; }
function rgbToHsl({ r, g, b }) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0; return { h: rgbToHsv({ r: r * 255, g: g * 255, b: b * 255 }).h, s, l }; }
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function rgbToXyz({ r, g, b }) { const R = lin(r), G = lin(g), B = lin(b); return { x: R * 0.4124 + G * 0.3576 + B * 0.1805, y: R * 0.2126 + G * 0.7152 + B * 0.0722, z: R * 0.0193 + G * 0.1192 + B * 0.9505 }; }
function xyzToLab({ x, y, z }) { const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116); const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883); return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }; }
function rgbToOklab({ r, g, b }) { const R = lin(r), G = lin(g), B = lin(b); const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B); return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s }; }
const polar = (a, b) => ({ C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 });
export function luminance(rgb) { return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b); }
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', teal: '#008080', navy: '#000080', gray: '#808080', coral: '#ff7f50', gold: '#ffd700', indigo: '#4b0082', lime: '#00ff00', maroon: '#800000', olive: '#808000', salmon: '#fa8072', violet: '#ee82ee', turquoise: '#40e0d0', crimson: '#dc143c' };

export function translate(rgb) {
  const f = (n, d = 1) => Number(n.toFixed(d));
  const hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb), lab = xyzToLab(rgbToXyz(rgb)), ok = rgbToOklab(rgb), lch = polar(lab.a, lab.b), oklch = polar(ok.a, ok.b);
  const k = 1 - Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const cm = (c) => (k >= 1 ? 0 : (1 - c / 255 - k) / (1 - k));
  const near = Object.entries(NAMED).sort(([, a], [, b]) => dist(hexToRgb(a), rgb) - dist(hexToRgb(b), rgb))[0];
  const a = rgb.a ?? 1;
  return [
    ['Name (nearest)', near[0] + (dist(hexToRgb(near[1]), rgb) < 1 ? '' : ' (approx.)')],
    ['HEX', rgbToHex(rgb).slice(0, 7)], ['HEX8', rgbToHex(rgb, true)],
    ['RGB', `rgb(${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)} / ${f(a, 2)})`],
    ['HSL', `hsl(${f(hsl.h)} ${f(hsl.s * 100)}% ${f(hsl.l * 100)}% / ${f(a, 2)})`],
    ['HSV', `hsv(${f(hsv.h)} ${f(hsv.s * 100)}% ${f(hsv.v * 100)}%)`],
    ['HWB', `hwb(${f(hsv.h)} ${f((1 - hsv.s) * hsv.v * 100)}% ${f((1 - hsv.v) * 100)}% / ${f(a, 2)})`],
    ['CIELAB', `lab(${f(lab.L)}% ${f(lab.a)} ${f(lab.b)} / ${f(a, 2)})`], ['LCH', `lch(${f(lab.L)}% ${f(lch.C)} ${f(lch.H)} / ${f(a, 2)})`],
    ['OKLab', `oklab(${f(ok.L, 3)} ${f(ok.a, 3)} ${f(ok.b, 3)} / ${f(a, 2)})`], ['OKLCH', `oklch(${f(ok.L, 3)} ${f(oklch.C, 3)} ${f(oklch.H)} / ${f(a, 2)})`],
    ['CMYK', `cmyk(${f(cm(rgb.r) * 100)}% ${f(cm(rgb.g) * 100)}% ${f(cm(rgb.b) * 100)}% ${f(k * 100)}%)`]
  ];
}
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

export function parseAny(s) {
  s = s.trim().toLowerCase();
  if (NAMED[s]) return hexToRgb(NAMED[s]);
  if (/^#?[0-9a-f]{3,8}$/.test(s)) return hexToRgb(s);
  const el = document.createElement('div'); el.style.color = s; if (!el.style.color) return null;
  document.body.append(el); const c = getComputedStyle(el).color; el.remove();
  const m = c.match(/[\d.]+/g); if (!m) return null;
  return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
}

export function colorPicker(value = '#a9b8ff', { onChange, allowRainbow = true, rainbow = false } = {}) {
  let rgb = hexToRgb(value), hsv = rgbToHsv(rgb), a = rgb.a ?? 1, rb = rainbow;
  const field = h('div.colorfield', { tabindex: '0', role: 'slider', 'aria-label': pair('Saturation and brightness', '飽和度同亮度') });
  const knob = h('div.knob'); field.append(knob);
  const hue = h('input.hue', { type: 'range', min: 0, max: 360, 'aria-label': pair('Hue', '色相') });
  const alpha = h('input.slider', { type: 'range', min: 0, max: 100, 'aria-label': pair('Opacity', '透明度') });
  const entry = h('input.input', { 'aria-label': pair('Type any colour (name, hex, rgb, hsl, lab, oklch…)', '輸入任何顏色'), style: { fontFamily: 'var(--font-mono)' } });
  const table = h('div.stack.small');
  const cbox = h('div.row.small');
  const sync = (fromEntry) => {
    rgb = { ...hsvToRgb(hsv), a };
    field.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`;
    knob.style.left = hsv.s * 100 + '%'; knob.style.top = (1 - hsv.v) * 100 + '%';
    hue.value = hsv.h; alpha.value = Math.round(a * 100); alpha.style.setProperty('--p', a * 100 + '%');
    if (!fromEntry) entry.value = rgbToHex(rgb);
    clear(table).append(...translate(rgb).map(([k, v]) => h('div.row.nowrap', h('b', { style: { width: '110px' } }, k), h('code', { style: { flex: 1 } }, v), h('button.icon-btn.sm', { type: 'button', 'aria-label': `Copy ${k}`, on: { click: () => { navigator.clipboard.writeText(v); toast(pair(`${k} copied.`, `已複製 ${k}。`), { kind: 'ok' }); } } }, icon('content_copy')))));
    const w = contrast(rgb, { r: 255, g: 255, b: 255 }), bl = contrast(rgb, { r: 0, g: 0, b: 0 });
    clear(cbox).append(h('span.chip', { style: { background: rgbToHex(rgb), color: '#fff' } }, `${w.toFixed(2)}:1 ${w >= 4.5 ? 'AA' : '✕'}`), h('span.chip', { style: { background: rgbToHex(rgb), color: '#000' } }, `${bl.toFixed(2)}:1 ${bl >= 4.5 ? 'AA' : '✕'}`), h('span.small.muted', pair('Active space: sRGB. Values outside sRGB are clipped and you are warned first.', '使用中色彩空間：sRGB。超出範圍會先警告再裁剪。')));
    onChange?.(rb ? 'rainbow' : rgbToHex(rgb), rgb);
  };
  const setFromPoint = (e) => { const r = field.getBoundingClientRect(); hsv.s = clamp((e.clientX - r.left) / r.width); hsv.v = 1 - clamp((e.clientY - r.top) / r.height); rb = false; sync(); };
  field.addEventListener('pointerdown', (e) => { field.setPointerCapture(e.pointerId); setFromPoint(e); field.onpointermove = setFromPoint; });
  field.addEventListener('pointerup', () => { field.onpointermove = null; });
  field.addEventListener('keydown', (e) => { const d = e.shiftKey ? 0.1 : 0.02; if (e.key === 'ArrowRight') hsv.s = clamp(hsv.s + d); else if (e.key === 'ArrowLeft') hsv.s = clamp(hsv.s - d); else if (e.key === 'ArrowUp') hsv.v = clamp(hsv.v + d); else if (e.key === 'ArrowDown') hsv.v = clamp(hsv.v - d); else return; e.preventDefault(); rb = false; sync(); });
  hue.addEventListener('input', () => { hsv.h = Number(hue.value); rb = false; sync(); });
  alpha.addEventListener('input', () => { a = Number(alpha.value) / 100; sync(); });
  entry.addEventListener('change', () => {
    const p = parseAny(entry.value);
    if (!p) { toast(pair('That is not a colour this picker understands.', '認唔到呢個顏色。'), { kind: 'warn' }); return; }
    if ([p.r, p.g, p.b].some((x) => x < 0 || x > 255)) toast(pair('That colour is outside sRGB and will be clipped.', '呢個顏色超出 sRGB，會被裁剪。'), { kind: 'warn' });
    hsv = rgbToHsv(p); a = p.a ?? 1; rb = false; sync(true);
  });
  sync();
  const rbBtn = allowRainbow ? h('button.btn.small.outline', { type: 'button', on: { click: () => { rb = true; onChange?.('rainbow', rgb); toast(pair('Animated rainbow on. It settles on one hue when motion is reduced.', '動態彩虹已開，減少動畫時會停喺一個色。'), { kind: 'ok' }); } } }, '🌈 ' + pair('Animated rainbow', '動態彩虹')) : null;
  return { el: h('div.stack', field, hue, h('div.row.nowrap', h('span.small', pair('Opacity', '透明度')), alpha), entry, rbBtn, cbox, table), get: () => (rb ? 'rainbow' : rgbToHex(rgb)) };
}
