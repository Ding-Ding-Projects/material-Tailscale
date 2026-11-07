// Safe previews of decoded bytes for the Base64 toolkit. Images (SVG included) show through an
// <img>, which never runs scripts; audio and video get player controls and never autoplay; text
// and markup show as text; anything else shows as a hex dump. Nothing decoded is ever opened,
// executed or loaded as a page.
import { h, clear, append, fmtBytes } from '../core/dom.js';
import { pair } from '../core/i18n.js';
import { segmented } from './controls.js';

export const PREVIEW_LIMIT = 32 * 1024 * 1024;
const TEXT_LIMIT = 64 * 1024;
const HEX_LIMIT = 4096;

const TEXTY = /^(text\/|application\/(json|xml|javascript|x-pem-file|postscript)|image\/svg\+xml)/;

export function hexDump(bytes, limit = HEX_LIMIT) {
  const n = Math.min(bytes.length, limit);
  const lines = [];
  for (let i = 0; i < n; i += 16) {
    const row = bytes.subarray(i, Math.min(n, i + 16));
    const hx = [...row].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const as = [...row].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hx}  |${as}|`);
  }
  return lines.join('\n');
}

/**
 * Renders a preview of `bytes` into `box`. `type` is { mime, how }. Returns a function that
 * releases object URLs; call it before rendering the next preview.
 */
export function renderPreview(box, bytes, type = {}, { textOf } = {}) {
  clear(box);
  const urls = [];
  const release = () => urls.forEach((u) => URL.revokeObjectURL(u));
  if (!bytes) {
    box.append(h('p.small.muted', pair('Decode something and it previews here: pictures, sound, video, text or a hex dump.', '解碼之後會喺度預覽：圖片、聲音、影片、文字或者十六進位。')));
    return release;
  }
  const mime = type.mime || 'application/octet-stream';
  const auto = /^(image|audio|video)\//.test(mime) && !/svg/.test(mime) ? 'media' : TEXTY.test(mime) ? 'text' : 'hex';
  const view = h('div.b64-view');
  const draw = (mode) => {
    release(); urls.length = 0;
    clear(view);
    if (bytes.length > PREVIEW_LIMIT) {
      view.append(h('p.small', pair(`Too large to preview (${fmtBytes(bytes.length)}; the limit is ${fmtBytes(PREVIEW_LIMIT)}). Save it to open it in another program.`, `太大預覽唔到（${fmtBytes(bytes.length)}，上限 ${fmtBytes(PREVIEW_LIMIT)}）。儲存之後用其他程式開。`)));
      return;
    }
    if (mode === 'media' || (mode === 'auto' && (auto === 'media' || /svg/.test(mime)))) {
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      urls.push(url);
      if (mime.startsWith('audio/')) view.append(h('audio', { controls: true, preload: 'metadata', src: url, 'aria-label': pair('Decoded audio', '解碼咗嘅聲音') }));
      else if (mime.startsWith('video/')) view.append(h('video', { controls: true, preload: 'metadata', src: url, 'aria-label': pair('Decoded video', '解碼咗嘅影片'), style: { maxWidth: '100%', maxHeight: '280px', borderRadius: '12px' } }));
      else view.append(h('img.b64-img', { src: url, alt: pair(`Decoded picture (${mime})`, `解碼咗嘅圖片（${mime}）`) }));
      return;
    }
    if (mode === 'text' || (mode === 'auto' && auto === 'text')) {
      let s;
      try { s = textOf ? textOf(bytes.subarray(0, TEXT_LIMIT)) : new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, TEXT_LIMIT)); } catch { s = null; }
      if (s === null) { view.append(h('p.small', pair('These bytes are not text in the chosen encoding. The hex view shows them as they are.', '呢啲位元組喺揀咗嘅編碼唔係文字，可以睇十六進位。'))); return; }
      // append() from dom.js drops the null; the native Element.append would print "null".
      append(view, [h('pre.out.b64-text', { dataset: { label: pair('Decoded text', '解碼咗嘅文字') } }, s), bytes.length > TEXT_LIMIT ? h('p.small.muted', pair(`Showing the first ${fmtBytes(TEXT_LIMIT)} of ${fmtBytes(bytes.length)}.`, `顯示頭 ${fmtBytes(TEXT_LIMIT)}，共 ${fmtBytes(bytes.length)}。`)) : null]);
      return;
    }
    append(view, [h('pre.out.b64-hex', { dataset: { label: pair('Hex dump', '十六進位') } }, hexDump(bytes)), bytes.length > HEX_LIMIT ? h('p.small.muted', pair(`Showing the first ${fmtBytes(HEX_LIMIT)} of ${fmtBytes(bytes.length)}.`, `顯示頭 ${fmtBytes(HEX_LIMIT)}，共 ${fmtBytes(bytes.length)}。`)) : null]);
  };
  const mode = segmented([{ value: 'auto', label: pair('Automatic', '自動') }, { value: 'text', label: pair('Text', '文字') }, { value: 'hex', label: pair('Hex', '十六進位') }], 'auto', { label: pair('Preview as', '預覽方式') });
  mode.onChange(draw);
  box.append(h('div.row', h('span.badge.info', mime), type.how ? h('span.small.muted', type.how) : null, h('span.small.muted', fmtBytes(bytes.length)), h('span', { style: { flex: 1 } }), mode.el), view);
  draw('auto');
  return release;
}
