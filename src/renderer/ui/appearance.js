// Per-element appearance editor, anchored beside the element. Edits every
// interaction state (normal, hover, focus, active, disabled) with Word-style
// typography and Photoshop-style non-destructive layers (background image
// layer with opacity, blend mode and filters). Overrides persist per data-el.
import { h, icon, clear } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import * as store from '../core/store.js';
import { floatPanel, toast } from './overlay.js';
import { segmented, stepper, switchCtl } from './controls.js';
import { colorPicker } from './colorpicker.js';

const STATES = ['normal', 'hover', 'focus-visible', 'active', 'disabled'];
const FONTS = ['inherit', 'Outfit', 'Roboto Flex', 'JetBrains Mono', 'Georgia', 'Segoe UI', 'Arial', 'Times New Roman', 'Comic Sans MS'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
let sheet;

export function applyAppearance() {
  sheet ||= document.head.appendChild(document.createElement('style'));
  const all = store.get('appearance');
  let css = '';
  for (const [el, states] of Object.entries(all)) {
    for (const [st, p] of Object.entries(states)) {
      const sel = `[data-el="${CSS.escape(el)}"]${st === 'normal' ? '' : st === 'disabled' ? ':disabled' : ':' + st}`;
      const decl = [];
      if (p.color) decl.push(`color:${p.color}`);
      if (p.bg) decl.push(`background-color:${p.bg}`);
      if (p.font && p.font !== 'inherit') decl.push(`font-family:'${p.font}'`);
      if (p.size) decl.push(`font-size:${p.size}px`);
      if (p.weight) decl.push(`font-weight:${p.weight}`);
      if (p.italic) decl.push('font-style:italic');
      if (p.underline) decl.push('text-decoration:underline');
      if (p.strike) decl.push('text-decoration:line-through');
      if (p.transform && p.transform !== 'none') decl.push(`text-transform:${p.transform}`);
      if (p.tracking !== undefined) decl.push(`letter-spacing:${p.tracking / 10}px`);
      if (p.leading) decl.push(`line-height:${p.leading / 100}`);
      if (p.align) decl.push(`text-align:${p.align}`);
      if (p.radius !== undefined) decl.push(`border-radius:${p.radius}px`);
      if (p.pad !== undefined) decl.push(`padding:${p.pad}px`);
      if (p.border) decl.push(`border:${p.borderW || 1}px solid ${p.border}`);
      if (p.shadow) decl.push(`box-shadow:0 ${p.shadow / 2}px ${p.shadow * 2}px rgba(0,0,0,.4)`);
      if (p.img) decl.push(`background-image:linear-gradient(rgba(0,0,0,${1 - (p.imgOpacity ?? 100) / 100}),rgba(0,0,0,${1 - (p.imgOpacity ?? 100) / 100})),url("${p.img}")`, 'background-size:cover', `background-blend-mode:${p.blend || 'normal'}`);
      const filters = [];
      if (p.blur) filters.push(`blur(${p.blur}px)`); if (p.bright !== undefined && p.bright !== 100) filters.push(`brightness(${p.bright}%)`); if (p.sat !== undefined && p.sat !== 100) filters.push(`saturate(${p.sat}%)`); if (p.hueRot) filters.push(`hue-rotate(${p.hueRot}deg)`); if (p.gray) filters.push(`grayscale(${p.gray}%)`);
      if (filters.length) decl.push(`filter:${filters.join(' ')}`);
      if (p.opacity !== undefined && p.opacity !== 100) decl.push(`opacity:${p.opacity / 100}`);
      if (decl.length) css += `${sel}{${decl.map((d) => d + ' !important').join(';')}}\n`;
    }
  }
  sheet.textContent = css;
}
store.on((k) => { if (k === 'appearance') applyAppearance(); });

export function editAppearance(target) {
  const id = target.closest('[data-el]')?.dataset.el;
  if (!id) { toast(pair('This element cannot be styled on its own; style its container instead.', '呢個元素唔可以單獨改，請改佢個容器。'), { kind: 'warn' }); return; }
  if (store.get('locks')[`appearance:${id}`]) { toast(t('locked'), { kind: 'warn' }); return; }
  let st = 'normal';
  const body = h('div.stack');
  const cur = () => (store.get('appearance')[id] || {})[st] || {};
  const put = (k, v) => {
    const all = { ...store.get('appearance') };
    const el = { ...(all[id] || {}) };
    el[st] = { ...(el[st] || {}), [k]: v };
    if (v === undefined || v === '' || v === null) delete el[st][k];
    all[id] = el; store.set('appearance', all, { label: `appearance ${id}` });
  };
  const draw = () => {
    clear(body);
    const p = cur();
    const row = (label, ctl) => h('div.stack', h('b.small', label), ctl.el || ctl);
    const step = (k, def, min, max, lbl) => { const s = stepper(p[k] ?? def, { min, max, label: lbl }); s.onChange((v) => put(k, v === '' ? undefined : v)); return row(lbl, s); };
    const sw = (k, lbl) => { const s = switchCtl(!!p[k], { label: lbl }); s.onChange((v) => put(k, v || undefined)); return h('div.switch-row', h('div.txt', h('b', lbl)), s.el); };
    const fontSel = h('select.input', { 'aria-label': 'Font', on: { change: (e) => put('font', e.target.value) } }, FONTS.map((f) => h('option', { value: f, selected: p.font === f }, f)));
    const tf = segmented(['none', 'uppercase', 'lowercase', 'capitalize'].map((v) => ({ value: v, label: v })), p.transform || 'none', { label: 'Text transform' }); tf.onChange((v) => put('transform', v));
    const al = segmented(['left', 'center', 'right', 'justify'].map((v) => ({ value: v, label: v })), p.align || 'left', { label: 'Alignment' }); al.onChange((v) => put('align', v));
    const blend = h('select.input', { 'aria-label': 'Blend mode', on: { change: (e) => put('blend', e.target.value) } }, BLENDS.map((b) => h('option', { value: b, selected: p.blend === b }, b)));
    const colorBtn = (k, lbl) => h('button.btn.small.outline', { type: 'button', on: { click: (e) => { const cp = colorPicker(p[k] || '#a9b8ff', { allowRainbow: false, onChange: (c) => put(k, c) }); floatPanel('cp-' + k, lbl, cp.el, { anchor: e.currentTarget, width: 340, height: 560 }); } } }, h('span', { style: { width: '16px', height: '16px', borderRadius: '4px', background: p[k] || 'transparent', border: '1px solid var(--outline)' } }), lbl);
    body.append(
      h('h3', pair('Typography', '字體排印')), row(pair('Font', '字型'), fontSel), step('size', '', 8, 96, pair('Size (px)', '大小')), step('weight', '', 100, 1000, pair('Weight', '粗幼')), step('tracking', '', -50, 200, pair('Letter spacing (0.1 px)', '字距')), step('leading', '', 80, 300, pair('Line height (%)', '行距')),
      sw('italic', pair('Italic', '斜體')), sw('underline', pair('Underline', '底線')), sw('strike', pair('Strikethrough', '刪除線')), row(pair('Case', '大小寫'), tf), row(pair('Alignment', '對齊'), al),
      h('h3', pair('Colour and shape', '顏色同形狀')), h('div.row', colorBtn('color', pair('Text colour', '文字顏色')), colorBtn('bg', pair('Fill', '填色')), colorBtn('border', pair('Border', '邊框'))),
      step('borderW', 1, 0, 20, pair('Border width', '邊框闊度')), step('radius', '', 0, 80, pair('Corner radius', '圓角')), step('pad', '', 0, 80, pair('Padding', '內距')), step('shadow', '', 0, 40, pair('Shadow', '陰影')), step('opacity', 100, 0, 100, pair('Opacity (%)', '不透明度')),
      h('h3', pair('Image layer', '圖片圖層')),
      h('div.row', h('button.btn.small.tonal', { type: 'button', on: { click: async () => { const f = await window.mt.dialog.open({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }] }); if (!f) return; const b64 = await window.mt.fs.readBytes(f[0]); const ext = f[0].split('.').pop().toLowerCase(); put('img', `data:image/${ext === 'svg' ? 'svg+xml' : ext === 'jpg' ? 'jpeg' : ext};base64,${b64}`); draw(); } } }, icon('image'), pair('Choose image', '揀圖片')), p.img ? h('button.btn.small.text', { type: 'button', on: { click: () => { put('img', undefined); draw(); } } }, pair('Remove layer', '移除圖層')) : null),
      step('imgOpacity', 100, 0, 100, pair('Layer opacity', '圖層透明度')), row(pair('Blend mode', '混合模式'), blend),
      h('h3', pair('Filters', '濾鏡')), step('blur', 0, 0, 20, pair('Blur', '模糊')), step('bright', 100, 0, 300, pair('Brightness', '亮度')), step('sat', 100, 0, 300, pair('Saturation', '飽和')), step('hueRot', 0, 0, 360, pair('Hue rotate', '色相旋轉')), step('gray', 0, 0, 100, pair('Greyscale', '灰階')),
      h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: () => { const all = { ...store.get('appearance') }; const el = { ...(all[id] || {}) }; delete el[st]; all[id] = el; store.set('appearance', all); draw(); } } }, icon('restart_alt'), pair(`Reset ${st}`, `重設 ${st}`)),
        h('button.btn.small.outline', { type: 'button', on: { click: () => { const all = { ...store.get('appearance') }; delete all[id]; store.set('appearance', all); draw(); } } }, icon('delete_sweep'), pair('Reset every state', '重設全部狀態'))));
  };
  const stSeg = segmented(STATES.map((s) => ({ value: s, label: s })), st, { label: 'State' });
  stSeg.onChange((v) => { st = v; draw(); });
  draw();
  floatPanel('appearance', pair(`Appearance: ${id}`, `外觀：${id}`), h('div.stack', stSeg.el, body), { anchor: target, width: 440, height: 620 });
}
