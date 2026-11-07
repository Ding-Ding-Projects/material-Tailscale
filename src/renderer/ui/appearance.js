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
import { mtabs } from './mtabs.js';

const STATES = ['normal', 'hover', 'focus-visible', 'active', 'disabled'];
const FONTS = ['inherit', 'Outfit', 'Roboto Flex', 'JetBrains Mono', 'Georgia', 'Segoe UI', 'Arial', 'Times New Roman', 'Comic Sans MS'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
let sheet;


// ---------- Animation and transition ----------
export const EASINGS = { standard: [0.2, 0, 0, 1], emphasized: [0.05, 0.7, 0.1, 1], spring: [0.34, 1.56, 0.64, 1], decelerate: [0, 0, 0, 1], accelerate: [0.3, 0, 1, 1], linear: [0, 0, 1, 1] };
export const PRESETS = {
  fade: [{ at: 0, opacity: 0 }, { at: 100, opacity: 100 }],
  rise: [{ at: 0, opacity: 0, ty: 16 }, { at: 100, opacity: 100, ty: 0 }],
  scale: [{ at: 0, opacity: 0, scale: 92 }, { at: 100, opacity: 100, scale: 100 }],
  slide: [{ at: 0, opacity: 0, tx: -24 }, { at: 100, opacity: 100, tx: 0 }],
  pulse: [{ at: 0, scale: 100 }, { at: 50, scale: 106 }, { at: 100, scale: 100 }],
  spin: [{ at: 0, rotate: 0 }, { at: 100, rotate: 360 }]
};
const easeCss = (p, k = 'animEase', b = 'animBez') => (p[k] === 'steps' ? `steps(${p.animSteps || 6})` : p[k] === 'custom' ? `cubic-bezier(${(p[b] || EASINGS.standard).join(',')})` : `cubic-bezier(${(EASINGS[p[k]] || EASINGS.standard).join(',')})`);
const frameCss = (f) => { const tr = []; if (f.tx || f.ty) tr.push(`translate(${f.tx || 0}px,${f.ty || 0}px)`); if (f.scale !== undefined && f.scale !== 100) tr.push(`scale(${f.scale / 100})`); if (f.rotate) tr.push(`rotate(${f.rotate}deg)`); return `${f.at}%{${f.opacity !== undefined ? `opacity:${f.opacity / 100};` : ''}transform:${tr.join(' ') || 'none'}}`; };
export const keyframesOf = (p) => (p.anim === 'custom' ? (p.kf || PRESETS.rise) : PRESETS[p.anim] || []);
/** CSS for one element state's animation and transition, including the reduced-motion fallback. */
function motionCss(el, st, p, sel) {
  const out = { decl: [], before: '', after: '' };
  if (p.anim && p.anim !== 'none') {
    const name = `mta-${String(el).replace(/[^a-zA-Z0-9_-]/g, '_')}-${st.replace(/[^a-z]/g, '')}`;
    out.before += `@keyframes ${name}{${keyframesOf(p).map(frameCss).join('')}}\n`;
    out.decl.push(`animation:${name} ${p.animDur ?? 560}ms ${easeCss(p)} ${p.animDelay ?? 0}ms ${p.animLoop ? 'infinite' : (p.animIter ?? 1)} ${p.animDir || 'normal'} ${p.animFill || 'both'} ${p.animPlay || 'running'}`);
    const reduced = p.animReduce === 'fade' ? `animation:mta-fade ${Math.min(p.animDur ?? 560, 200)}ms linear both !important` : 'animation:none !important';
    out.after += `@keyframes mta-fade{from{opacity:0}}\n:root.reduce-motion ${sel}{${reduced}}\n@media (prefers-reduced-motion: reduce){${sel}{${reduced}}}\n`;
  }
  if (p.trProp && p.trProp !== 'none') {
    const prop = { colour: 'color, background-color, border-color', shadow: 'box-shadow', all: 'all', transform: 'transform', opacity: 'opacity' }[p.trProp] || 'all';
    out.decl.push(`transition:${prop.split(', ').map((x) => `${x} ${p.trDur ?? 320}ms ${easeCss(p, 'trEase', 'trBez')} ${p.trDelay ?? 0}ms`).join(', ')}`);
    out.after += `:root.reduce-motion ${sel}{transition:none !important}\n`;
  }
  return out;
}

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
      const motion = motionCss(el, st, p, sel);
      decl.push(...motion.decl);
      css += motion.before;
      if (decl.length) css += `${sel}{${decl.map((d) => d + ' !important').join(';')}}\n`;
      css += motion.after;
    }
  }
  sheet.textContent = css;
}
store.on((k) => { if (k === 'appearance') applyAppearance(); });


let selKf = 0;
/** The Animation and transition tab: presets, timing, easing curve, keyframe timeline, transitions, reduced motion and a live preview. */
function motionPanel(p, put, redraw) {
  const row = (label, ctl) => h('div.stack', h('b.small', label), ctl.el || ctl);
  const step = (k, def, min, max, lbl, by = 1) => { const c = stepper(p[k] ?? def, { min, max, step: by, label: lbl }); c.onChange((v) => put(k, v === '' ? undefined : Number(v))); return row(lbl, c); };
  const seg = (k, def, opts, lbl) => { const c = segmented(opts.map((o) => ({ value: o, label: o })), p[k] || def, { label: lbl }); c.onChange((v) => { put(k, v); redraw(); }); return row(lbl, c); };
  const sw = (k, lbl, desc) => { const c = switchCtl(!!p[k], { label: lbl }); c.onChange((v) => { put(k, v || undefined); redraw(); }); return h('div.switch-row', h('div.txt', h('b', lbl), desc ? h('span.small.muted', desc) : null), c.el); };
  const curve = (k, b) => {
    const [x1, y1, x2, y2] = p[k] === 'custom' ? (p[b] || EASINGS.standard) : (EASINGS[p[k] || 'standard'] || EASINGS.linear);
    const box = h('div');
    box.innerHTML = `<svg class="anim-curve" viewBox="-10 -30 220 160" role="img" aria-label="Easing curve ${p[k] || 'standard'}: control points ${x1}, ${y1}, ${x2}, ${y2}"><line x1="0" y1="100" x2="200" y2="0"/><path d="M0 100 C ${x1 * 200} ${100 - y1 * 100}, ${x2 * 200} ${100 - y2 * 100}, 200 0"/><circle cx="${x1 * 200}" cy="${100 - y1 * 100}" r="5"/><circle cx="${x2 * 200}" cy="${100 - y2 * 100}" r="5"/></svg>`;
    return box;
  };
  const bez = (k) => { const v = p[k] || [...EASINGS.standard]; return h('div.row', ['x1', 'y1', 'x2', 'y2'].map((n, i) => { const c = stepper(v[i], { min: i % 2 ? -2 : 0, max: i % 2 ? 3 : 1, step: 0.05, label: n }); c.onChange((x) => { const nv = [...v]; nv[i] = Number(x); put(k, nv); redraw(); }); return h('div.stack', h('span.small', n), c.el); })); };
  const kfs = keyframesOf(p).map((f) => ({ ...f }));
  selKf = Math.min(selKf, kfs.length - 1);
  const setKf = (i, key, v) => { const next = kfs.map((f) => ({ ...f })); next[i][key] = v; next.sort((a, b) => a.at - b.at); put('kf', next); if (p.anim !== 'custom') put('anim', 'custom'); redraw(); };
  const timeline = h('div.timeline', { role: 'group', 'aria-label': pair('Keyframes', '關鍵影格') }, kfs.map((f, i) => h('button.kf', { type: 'button', 'aria-label': pair(`Keyframe at ${f.at}%`, `${f.at}% 關鍵影格`), 'aria-pressed': String(i === selKf), style: { left: `${Math.max(2, Math.min(98, f.at))}%` }, on: { click: () => { selKf = i; redraw(); } } })));
  const f = kfs[selKf] || {};
  const kfStep = (key, def, min, max, lbl, by = 1) => { const c = stepper(f[key] ?? def, { min, max, step: by, label: lbl }); c.onChange((v) => v !== '' && setKf(selKf, key, Number(v))); return row(lbl, c); };
  const ball = h('div.ball');
  const play = () => {
    const reduced = document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames = reduced ? [{ opacity: 0 }, { opacity: 1 }] : keyframesOf(p).map((k) => ({ offset: k.at / 100, opacity: k.opacity !== undefined ? k.opacity / 100 : 1, transform: `translate(${k.tx || 0}px, ${k.ty || 0}px) scale(${(k.scale ?? 100) / 100}) rotate(${k.rotate || 0}deg)` }));
    ball.getAnimations().forEach((a) => a.cancel());
    if (frames.length) ball.animate(frames, { duration: reduced ? 200 : (p.animDur ?? 560), delay: reduced ? 0 : (p.animDelay ?? 0), easing: reduced ? 'linear' : (p.animEase === 'steps' ? `steps(${p.animSteps || 6})` : `cubic-bezier(${(p.animEase === 'custom' ? (p.animBez || EASINGS.standard) : (EASINGS[p.animEase || 'standard'])).join(',')})`), iterations: p.animLoop ? 3 : (p.animIter ?? 1), direction: p.animDir || 'normal', fill: p.animFill || 'both' });
  };
  return h('div.stack',
    h('p.small.muted', pair('Each interaction state animates on its own: set an animation on the hover state to play it on hover, on normal to play it when the element appears.', '每個互動狀態有自己嘅動畫：喺 hover 狀態設定就會喺滑鼠經過時播放。')),
    h('div.anim-grid',
      h('div.stack',
        seg('anim', 'none', ['none', 'fade', 'rise', 'scale', 'slide', 'pulse', 'spin', 'custom'], pair('Animation', '動畫')),
        h('div.row', step('animDur', 560, 0, 20000, pair('Duration (ms)', '時長（毫秒）'), 20), step('animDelay', 0, 0, 20000, pair('Delay (ms)', '延遲（毫秒）'), 20)),
        h('div.row', step('animIter', 1, 1, 100, pair('Repeat', '重複次數')), sw('animLoop', pair('Loop forever', '無限循環'))),
        seg('animDir', 'normal', ['normal', 'reverse', 'alternate', 'alternate-reverse'], pair('Direction', '方向')),
        seg('animFill', 'both', ['none', 'forwards', 'backwards', 'both'], pair('Fill mode', '填充模式')),
        seg('animPlay', 'running', ['running', 'paused'], pair('Playback', '播放')),
        seg('animEase', 'standard', ['standard', 'emphasized', 'spring', 'decelerate', 'accelerate', 'linear', 'steps', 'custom'], pair('Easing', '緩動')), curve('animEase', 'animBez'),
        p.animEase === 'custom' ? bez('animBez') : null, p.animEase === 'steps' ? step('animSteps', 6, 1, 60, pair('Steps', '步數')) : null),
      h('div.stack',
        h('b.small', pair('Keyframe timeline', '關鍵影格時間線')), kfs.length ? timeline : h('div.small.muted', pair('Pick an animation to see and edit its keyframes, or add one to start a custom animation.', '揀一個動畫就可以睇同改佢嘅關鍵影格，或者加一個開始自訂動畫。')),
        h('div.row', kfStep('at', 0, 0, 100, pair('Position %', '位置 %')), kfStep('opacity', 100, 0, 100, pair('Opacity', '透明度'))),
        h('div.row', kfStep('tx', 0, -2000, 2000, pair('Move X (px)', 'X 位移')), kfStep('ty', 0, -2000, 2000, pair('Move Y (px)', 'Y 位移'))),
        h('div.row', kfStep('scale', 100, 0, 1000, pair('Scale %', '縮放 %')), kfStep('rotate', 0, -3600, 3600, pair('Rotate (deg)', '旋轉（度）'))),
        h('div.row',
          h('button.btn.small.tonal', { type: 'button', on: { click: () => { const next = [...kfs, { at: 50, opacity: 100 }].sort((a, b) => a.at - b.at); put('kf', next); put('anim', 'custom'); selKf = next.findIndex((x) => x.at === 50); redraw(); } } }, icon('add'), pair('Add keyframe', '加關鍵影格')),
          h('button.btn.small.outline', { type: 'button', disabled: kfs.length <= 2, on: { click: () => { const next = kfs.filter((_, i) => i !== selKf); put('kf', next); put('anim', 'custom'); selKf = 0; redraw(); } } }, icon('remove'), pair('Remove keyframe', '刪除關鍵影格'))),
        seg('trProp', 'none', ['none', 'all', 'transform', 'colour', 'shadow', 'opacity'], pair('Transition between states', '狀態之間嘅過渡')),
        h('div.row', step('trDur', 320, 0, 20000, pair('Transition (ms)', '過渡（毫秒）'), 20), step('trDelay', 0, 0, 20000, pair('Transition delay', '過渡延遲'), 20)),
        seg('trEase', 'standard', ['standard', 'emphasized', 'spring', 'linear', 'custom'], pair('Transition easing', '過渡緩動')), p.trEase === 'custom' ? bez('trBez') : null,
        seg('animReduce', 'none', ['none', 'fade'], pair('With reduced motion', '減少動態時')),
        h('div.anim-preview', ball), h('div.row', h('button.btn.small', { type: 'button', on: { click: play } }, icon('play_arrow'), pair('Play preview', '預覽播放'))))),
    h('p.small.muted', pair('Not available here: scroll-driven timelines and sequences across sibling elements, because overrides apply to one element and its states. Give each element its own delay instead.', '呢度未支援：跟捲動嘅時間線同兄弟元素之間嘅序列，因為設定只套用喺一個元素同佢嘅狀態。可以為每個元素設定延遲。')));
}

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
  let tab = 'style';
  const draw = () => {
    clear(body);
    const p = cur();
    if (tab === 'motion') { body.append(motionPanel(p, put, draw)); return; }
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
  const tabs = mtabs([{ value: 'style', label: pair('Type, colour and layers', '字體、顏色同圖層'), icon: 'format_paint' }, { value: 'motion', label: pair('Animation and transition', '動畫同過渡'), icon: 'animation' }], tab, { label: pair('Editor sections', '編輯分區') });
  tabs.onChange((v) => { tab = v; draw(); });
  floatPanel('appearance', pair(`Appearance: ${id}`, `外觀：${id}`), h('div.stack', stSeg.el, tabs.el, body), { anchor: target, width: 520, height: 680 });
}
