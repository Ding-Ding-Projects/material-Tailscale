import { h, icon, clear, fmtBytes } from '../core/dom.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { t, pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import { registerPage, openDest, openInNewTab } from '../ui/shell.js';
import { toast, dialog, collapsible } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { segmented, stepper, switchCtl, text, fileButton } from '../ui/controls.js';
import { workbench, folderSearch } from '../ui/regex.js';
import { exportTo, FORMATS } from '../ui/exporter.js';
import totpLib from '../../shared/totp.js';
import QRCode from 'qrcode';
import { withProgress, helpRequest } from '../ui/jobs.js';
import jsQR from 'jsqr';

const head = pageHero;

registerPage('tools', () => h('div.page', head(pair('Built in', '內置'), t('tools'), pair('Local utilities that work offline. Each opens in the workspace or a new tab.', '離線都用到嘅本機工具。'), heroStats([{ value: 8, label: pair('tools', '個工具') }, { value: pair('Offline', '離線'), label: pair('always', '一直'), tone: 'ok' }])),
  h('div.grid.stagger', ['authenticator', 'base64', 'converter', 'regex', 'draw', 'ollama', 'minecraft', 'console'].map((id, i) => h('button.cmd-tile.span-3', { style: { '--i': i }, dataset: { el: 'tool-' + id }, on: { click: () => openDest(id), auxclick: () => openInNewTab(id) } }, h('span.ico', icon({ authenticator: 'pin', base64: 'data_object', converter: 'swap_horiz', regex: 'regular_expression', draw: 'draw', ollama: 'smart_toy', minecraft: 'grass', console: 'keyboard' }[id])), h('span', h('b', t(id), window.mt?.site && ['converter', 'ollama', 'minecraft', 'console'].includes(id) ? h('span.badge.info', { style: { marginLeft: '8px' } }, pair('Desktop app', '桌面版')) : null), h('code', { authenticator: pair('TOTP codes', 'TOTP 驗證碼'), base64: pair('Encode and decode', '編碼同解碼'), converter: pair('Documents, media, archives', '文件、媒體、壓縮檔'), regex: pair('Build, test, trace', '建立、測試、追蹤'), draw: pair('Sketch and annotate', '畫圖同標註'), ollama: pair('Local models', '本機模型'), minecraft: pair('Create and run', '建立同運行'), console: pair('Any arguments', '任何參數') }[id])))))));

// ---------------- Authenticator ----------------

registerPage('authenticator', (ctx) => {
  const list = h('div.grid.stagger');
  let accounts = [];
  let timer;
  const load = async () => {
    let secretsMap = {};
    try { secretsMap = await window.mt.authLoad(); } catch (e) { toast(e.message, { kind: 'err' }); }
    accounts = JSON.parse(localStorage.getItem('mt.auth.meta') || '[]').map((m) => ({ ...m, secret: secretsMap[m.id] || null }));
    draw();
  };
  const persist = () => {
    localStorage.setItem('mt.auth.meta', JSON.stringify(accounts.map(({ secret, ...m }) => m)));
    window.mt.secret.set('authenticator:secrets', { value: JSON.stringify(Object.fromEntries(accounts.map((a) => [a.id, a.secret]))) }).catch((e) => toast(e.message, { kind: 'err' }));
    window.mt.history.record('Authenticator accounts changed', { 'authenticator.json': accounts.map(({ secret, ...m }) => m) }).catch(() => {});
  };
  const add = (acc) => { accounts.push({ id: 'a' + Date.now(), ...acc }); persist(); draw(); toast(pair(`Added ${acc.issuer || acc.account}.`, `已加入 ${acc.issuer || acc.account}。`), { kind: 'ok' }); };
  const addUri = (uri) => { try { add(totpLib.parseUri(uri)); } catch (e) { toast(e.message, { kind: 'err' }); } };
  const decodeImage = async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const code = jsQR(d.data, d.width, d.height);
    if (!code) throw new Error(pair('No QR code was found in that image.', '張圖入面搵唔到 QR 碼。'));
    addUri(code.data);
  };
  const draw = () => {
    clear(list);
    if (!accounts.length) list.append(h('div.empty.span-12', icon('pin'), pair('No accounts yet. Add one with a link, a QR image, the clipboard, your camera or a manual secret.', '未有帳戶。用連結、QR 圖、剪貼簿、鏡頭或者手動密鑰加。')));
    accounts.forEach((a, i) => {
      const code = h('div.big-number', { style: { fontSize: '34px', letterSpacing: '4px' } });
      const nextC = h('div.small.muted');
      const ring = h('div', { style: { height: '6px', borderRadius: '3px', background: 'var(--surface-3)', overflow: 'hidden' } }, h('i', { style: { display: 'block', height: '100%', background: 'var(--secondary)', transition: 'width 1s linear' } }));
      const card = h('article.card.span-4', { style: { '--i': i }, dataset: { el: 'otp-' + a.id } },
        h('div.row.nowrap', h('b', { style: { flex: 1 } }, a.issuer || pair('Account', '帳戶')), h('span.small.muted', `${a.algorithm} · ${a.digits} · ${a.period}s`)), h('div.small.muted', a.account),
        code, ring, nextC,
        h('div.row', h('button.btn.small', { on: { click: async () => { navigator.clipboard.writeText(await totpLib.totp(a.secret, a)); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), t('copy')),
          h('button.btn.small.outline', { on: { click: async () => { const uri = totpLib.buildUri(a); const url = await QRCode.toDataURL(uri, { margin: 2, width: 360 }); dialog({ title: pair('Export as QR', '匯出 QR'), body: h('div.stack', h('img', { src: url, alt: 'QR code', style: { background: '#fff', padding: '10px', borderRadius: '12px', width: '260px' } }), h('p.small.muted', pair('Anyone who scans this can generate your codes.', '任何人掃到都可以產生你嘅碼。'))) }); } } }, icon('qr_code'), 'QR'),
          h('button.icon-btn.sm', { 'aria-label': pair('Delete', '刪除'), on: { click: async () => { if (await superConfirm({ action: pair(`Delete ${a.issuer} ${a.account}`, `刪除 ${a.issuer} ${a.account}`), affects: pair('This authenticator entry on this computer. You may lose access if it is your only copy.', '本機呢個驗證項目。如果係唯一副本可能會失去存取權。') })) { accounts = accounts.filter((x) => x.id !== a.id); persist(); draw(); } } } }, icon('delete'))));
      card._tick = async () => {
        if (!a.secret) { code.textContent = '—'; nextC.textContent = pair('The secret for this entry is missing from the vault. Add it again.', '保險庫搵唔到密鑰，請重新加入。'); return; }
        const now = Date.now(), left = a.period - Math.floor(now / 1000) % a.period;
        code.textContent = (await totpLib.totp(a.secret, a)).replace(/(\d{3,4})(?=\d{3,4}$)/, '$1 ');
        ring.firstChild.style.width = (left / a.period) * 100 + '%';
        nextC.textContent = pair(`${left}s left · next ${await totpLib.totp(a.secret, { ...a, time: now + a.period * 1000 })}`, `剩 ${left} 秒 · 下一個 ${await totpLib.totp(a.secret, { ...a, time: now + a.period * 1000 })}`);
      };
      list.append(card); card._tick();
    });
  };
  clearInterval(timer);
  timer = setInterval(() => list.querySelectorAll('article').forEach((c) => c._tick?.()), 1000);
  ctx.onCleanup(() => clearInterval(timer));
  const onAdd = (e) => addUri(e.detail);
  window.addEventListener('mt:add-totp', onAdd);
  const uriIn = text('', { label: 'otpauth:// link', mono: true, placeholder: 'otpauth://totp/…' });
  const issuer = text('', { label: 'Issuer' }), acct = text('', { label: 'Account' }), sec = text('', { label: 'Secret (base32)', mono: true });
  const algo = segmented(['SHA1', 'SHA256', 'SHA512'].map((v) => ({ value: v, label: v })), 'SHA1', { label: 'Algorithm' });
  const digits = segmented([6, 7, 8].map((v) => ({ value: v, label: String(v) })), 6, { label: 'Digits' });
  const period = stepper(30, { min: 1, max: 3600, label: 'Period', chips: [{ value: 30 }, { value: 60 }] });
  load();
  return h('div.page', head(pair('Two-factor', '雙重驗證'), t('authenticator'), pair('Standards-exact time-based codes (RFC 6238) for any account. Secrets are kept in your operating system\'s encrypted vault.', '任何帳戶嘅標準時間碼（RFC 6238），密鑰存喺系統加密保險庫。')),
    h('div.grid', h('section.card.span-8', h('h2', pair('Codes', '驗證碼')), list),
      h('section.card.span-4.tonal', h('h2', pair('Add an account', '加帳戶')),
        h('div.row', fileButton({ icon: 'image', text: pair('QR from image', '從圖片讀 QR'), accept: 'image/*', onFile: (f) => decodeImage(URL.createObjectURL(f)).catch((er) => toast(er.message, { kind: 'err' })) }),
          h('button.btn.small.tonal', { on: { click: async () => { const d = await window.mt.clipboardImage(); if (d) decodeImage(d).catch((er) => toast(er.message, { kind: 'err' })); else { const s = await navigator.clipboard.readText().catch(() => ''); if (s.startsWith('otpauth://')) addUri(s); else toast(pair('The clipboard has no QR image or otpauth link.', '剪貼簿冇 QR 圖或 otpauth 連結。'), { kind: 'warn' }); } } } }, icon('content_paste'), pair('From clipboard', '從剪貼簿')),
          h('button.btn.small.tonal', { on: { click: () => cameraScan(addUri) } }, icon('photo_camera'), pair('Camera', '鏡頭'))),
        h('b', pair('Link', '連結')), uriIn.el, h('button.btn.small', { on: { click: () => uriIn.get() && addUri(uriIn.get()) } }, pair('Add link', '加連結')),
        h('div.divider'), h('b', pair('Manual', '手動')), issuer.el, acct.el, sec.el, algo.el, digits.el, period.el,
        h('button.btn.small', { on: { click: () => { try { totpLib.base32Decode(sec.get() || ''); if (!sec.get()) throw new Error(pair('Enter the secret.', '請輸入密鑰。')); add({ issuer: issuer.get() || '', account: acct.get() || '', secret: sec.get().replace(/\s/g, '').toUpperCase(), algorithm: algo.get(), digits: digits.get(), period: period.get() || 30 }); } catch (e) { toast(e.message, { kind: 'err' }); } } } }, icon('add'), pair('Add', '加入')))));
});

async function cameraScan(onUri) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); } catch { toast(pair('No camera is available or access was declined.', '冇鏡頭或者被拒絕。'), { kind: 'warn' }); return; }
  const v = h('video', { autoplay: true, playsinline: true, style: { width: '100%', borderRadius: '16px' } }); v.srcObject = stream;
  const c = document.createElement('canvas');
  let alive = true;
  const d = dialog({ title: pair('Scan a QR code', '掃 QR 碼'), body: v, onClose: () => { alive = false; stream.getTracks().forEach((tr) => tr.stop()); } });
  const loop = () => { if (!alive) return; if (v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d'); g.drawImage(v, 0, 0); const im = g.getImageData(0, 0, c.width, c.height); const code = jsQR(im.data, im.width, im.height); if (code?.data.startsWith('otpauth://')) { d.close(); onUri(code.data); return; } } requestAnimationFrame(loop); };
  loop();
}

// ---------------- Base64 ----------------
registerPage('base64', () => {
  const variant = segmented([{ value: 'std', label: 'Standard' }, { value: 'url', label: 'URL-safe' }, { value: 'mime', label: 'MIME (76)' }], 'std', { label: 'Variant' });
  const pad = switchCtl(true, { label: 'Padding' });
  const strict = switchCtl(true, { label: 'Strict decoding' });
  const enc = segmented([{ value: 'utf-8', label: 'UTF-8' }, { value: 'utf-16le', label: 'UTF-16LE' }, { value: 'latin1', label: 'Latin-1' }], 'utf-8', { label: 'Text encoding' });
  const inp = h('textarea.input', { 'aria-label': pair('Input', '輸入'), placeholder: pair('Type or paste text or Base64', '輸入或貼上文字或 Base64') });
  const out = h('textarea.input', { 'aria-label': pair('Output', '輸出'), readonly: true });
  const status = h('div.small');
  const preview = h('div');
  const bytesOf = (s) => { const e = enc.get(); if (e === 'utf-8') return new TextEncoder().encode(s); if (e === 'utf-16le') { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) & 255; b[i * 2 + 1] = s.charCodeAt(i) >> 8; } return b; } return Uint8Array.from(s, (c) => c.charCodeAt(0) & 255); };
  const textOf = (b) => new TextDecoder(enc.get() === 'latin1' ? 'iso-8859-1' : enc.get()).decode(b);
  const toB64 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); let r = btoa(s); if (variant.get() === 'url') r = r.replace(/\+/g, '-').replace(/\//g, '_'); if (!pad.get()) r = r.replace(/=+$/, ''); if (variant.get() === 'mime') r = r.match(/.{1,76}/g)?.join('\r\n') || ''; return r; };
  const fromB64 = (s) => {
    let t0 = s.replace(/^data:[^,]*,/, '');
    if (!strict.get()) t0 = t0.replace(/[^A-Za-z0-9+/=_-]/g, ''); else t0 = t0.replace(/\r?\n/g, '');
    const bad = t0.search(/[^A-Za-z0-9+/=_-]/);
    if (bad >= 0) throw new Error(pair(`Invalid character at offset ${bad}`, `第 ${bad} 位有無效字元`));
    t0 = t0.replace(/-/g, '+').replace(/_/g, '/');
    while (t0.length % 4) t0 += '=';
    const bin = atob(t0); return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  const sniff = (b) => (b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x47 && b[1] === 0x49 ? 'image/gif' : b[0] === 0x25 && b[1] === 0x50 ? 'application/pdf' : b[0] === 0x50 && b[1] === 0x4b ? 'application/zip' : 'application/octet-stream');
  let lastBytes = null;
  const doEnc = () => { lastBytes = bytesOf(inp.value); out.value = toB64(lastBytes); status.textContent = pair(`${fmtBytes(lastBytes.length)} → ${out.value.length} characters`, `${fmtBytes(lastBytes.length)} → ${out.value.length} 字元`); };
  const doDec = () => { try { lastBytes = fromB64(inp.value.trim()); const mt = sniff(lastBytes); out.value = mt === 'application/octet-stream' ? textOf(lastBytes) : `(${mt}, ${fmtBytes(lastBytes.length)})`; status.textContent = pair(`Decoded ${fmtBytes(lastBytes.length)} · detected ${mt}`, `解碼 ${fmtBytes(lastBytes.length)} · ${mt}`); clear(preview); if (mt.startsWith('image/')) preview.append(h('img', { src: URL.createObjectURL(new Blob([lastBytes], { type: mt })), alt: pair('Decoded image preview', '解碼圖片預覽'), style: { maxWidth: '100%', maxHeight: '240px', borderRadius: '12px' } })); } catch (e) { status.textContent = e.message; status.className = 'err-text'; } };
  const file = async (dec) => {
    const p = await window.mt.dialog.open({}); if (!p) return;
    status.textContent = pair('Reading…', '讀緊…');
    const b64 = await window.mt.fs.readBytes(p[0]);
    if (dec) { inp.value = await window.mt.fs.readText(p[0]); doDec(); return; }
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((x) => x.toString(16).padStart(2, '0')).join('');
    lastBytes = bytes; out.value = toB64(bytes);
    const back = fromB64(out.value);
    const hash2 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', back))].map((x) => x.toString(16).padStart(2, '0')).join('');
    status.textContent = pair(`Encoded ${fmtBytes(bytes.length)} · SHA-256 round trip ${hash === hash2 ? 'verified' : 'FAILED'} (${hash.slice(0, 16)}…)`, `已編碼 ${fmtBytes(bytes.length)} · SHA-256 來回 ${hash === hash2 ? '驗證通過' : '失敗'}`);
  };
  return h('div.page', head(pair('Encoding', '編碼'), t('base64'), pair('Encode and decode text and files with every Base64 variant, data: URLs, strict error offsets and a verified round trip.', '用各種 Base64 變體編解碼文字同檔案。')),
    h('div.grid', h('section.card.span-12.tonal', h('div.row', variant.el, enc.el), h('div.row', h('div.switch-row', h('b', pair('Padding', '填充')), pad.el), h('div.switch-row', h('b', pair('Strict decoding', '嚴格解碼')), strict.el))),
      h('section.card.span-6', h('h2.h3', pair('Input', '輸入')), inp, h('div.row', h('button.btn', { on: { click: doEnc } }, icon('lock'), pair('Encode', '編碼')), h('button.btn.tonal', { on: { click: doDec } }, icon('lock_open'), pair('Decode', '解碼')), h('button.btn.outline', { on: { click: () => file(false) } }, icon('upload_file'), pair('Encode a file', '編碼檔案')), h('button.btn.outline', { on: { click: () => file(true) } }, icon('file_open'), pair('Decode a file', '解碼檔案')))),
      h('section.card.span-6', h('h2.h3', pair('Output', '輸出')), out, status, preview, h('div.row', h('button.btn.small.outline', { on: { click: () => { navigator.clipboard.writeText(out.value); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), t('copy')),
        h('button.btn.small.outline', { on: { click: () => { const mt = lastBytes ? sniff(lastBytes) : 'text/plain'; navigator.clipboard.writeText(`data:${mt};base64,${toB64(lastBytes || bytesOf(inp.value)).replace(/\r\n/g, '')}`); toast(pair('data: URL copied.', '已複製 data: URL。'), { kind: 'ok' }); } } }, icon('link'), 'data: URL'),
        h('button.btn.small.outline', { on: { click: async () => { if (!lastBytes) return; const p = await window.mt.dialog.save({ defaultPath: 'decoded.bin' }); if (p) { await window.mt.fs.writeBytes(p, toB64(lastBytes).replace(/\r\n/g, '').replace(/-/g, '+').replace(/_/g, '/')); toast(pair('Saved.', '已儲存。'), { kind: 'ok' }); } } } }, icon('save'), pair('Save bytes', '儲存位元組'))))));
});

// ---------------- File converter ----------------
const IMG = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'];
const AUD = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus', 'wma'];
const VID = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'm4v'];
const ARC = ['zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'rar', 'iso', 'cab'];
const DOC = ['docx', 'pdf', 'md', 'markdown', 'html', 'htm', 'txt', 'log'];
export const ADAPTERS = [
  { category: 'Structured data / spreadsheets', from: ['json', 'csv'], to: ['json', 'yaml', 'csv', 'md', 'html', 'txt'], engine: 'built in' },
  { category: 'Images', from: IMG, to: ['png', 'jpeg', 'webp'], engine: 'built in (Chromium)' },
  { category: 'Audio', from: [...AUD, ...VID], to: ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'opus'], engine: 'ffmpeg (bundled)', tool: 'ffmpeg' },
  { category: 'Video', from: VID, to: ['mp4', 'webm', 'mkv', 'gif'], engine: 'ffmpeg (bundled)', tool: 'ffmpeg' },
  { category: 'Archives', from: ARC, to: ['extract', 'zip', '7z'], engine: '7-Zip (bundled)', tool: 'sevenZip' },
  { category: 'Documents / PDF', from: DOC, to: ['pdf', 'html', 'txt'], engine: 'built in (Chromium print, mammoth, pdf.js)' },
  { category: 'Code / text', from: ['txt', 'md', 'log', 'hujson', 'js', 'ts', 'py', 'go', 'yaml', 'yml', 'xml', 'ini', 'toml'], to: ['html', 'pdf', 'txt'], engine: 'built in' },
  { category: 'Binary encodings', from: ['*'], to: ['base64', 'hex'], engine: 'built in' }
];
registerPage('converter', () => {
  let src = null;
  let bundled = { ffmpegPresent: false, sevenZipPresent: false };
  const info = h('div.small');
  const opts = h('div.stack');
  const catalogue = h('div');
  const drawCatalogue = () => clear(catalogue).append(h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', ['Category', 'From', 'To', 'Engine', 'Status'].map((c) => h('th', c)))), h('tbody', ADAPTERS.map((a) => { const ok = !a.tool || bundled[a.tool + 'Present']; return h('tr', h('td', a.category), h('td.small', a.from.join(', ')), h('td.small', a.to.join(', ')), h('td.small', a.engine), h('td', ok ? h('span.badge.ok', pair('ready', '可用')) : h('span.badge.err', pair(`missing ${a.tool} in this installation`, `呢個安裝缺少 ${a.tool}`)))); })))));
  window.mt.tools.bundled().then((b) => { bundled = b; drawCatalogue(); });
  drawCatalogue();
  const drop = h('div.card.hero', { style: { minHeight: '140px', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }, dataset: { el: 'converter-drop' } }, icon('upload_file'), h('b', pair('Drop a file here, or choose one', '拖檔案到呢度，或者揀一個')), h('button.btn.small', { on: { click: async () => { const p = await window.mt.dialog.open({}); if (p) pick(p[0]); } } }, pair('Choose file…', '揀檔…')));
  drop.addEventListener('dragover', (e) => e.preventDefault());
  drop.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) pick(window.mt.pathForFile(f)); });
  const sniff = (b) => (b[0] === 0x89 && b[1] === 0x50 ? 'png' : b[0] === 0xff && b[1] === 0xd8 ? 'jpg' : b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 ? 'gif' : b[0] === 0x25 && b[1] === 0x50 ? 'pdf' : b[0] === 0x37 && b[1] === 0x7a ? '7z' : b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 ? 'rar' : b[0] === 0x1f && b[1] === 0x8b ? 'gz' : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 ? 'webp' : b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 ? 'mp3' : b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 ? 'mp4' : b[0] === 0x1a && b[1] === 0x45 ? 'mkv' : b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 ? 'wav' : null);
  const pick = async (p) => {
    const head64 = (await window.mt.fs.readBytes(p).catch(() => null));
    if (!head64) { info.textContent = pair('That file could not be read (it may be larger than 256 MB).', '讀唔到呢個檔（可能大過 256 MB）。'); return; }
    const bytes = Uint8Array.from(atob(head64.slice(0, 64)), (c) => c.charCodeAt(0));
    const magic = sniff(bytes);
    let ext = (magic === 'mp4' && /\.(mov|m4a|m4v)$/i.test(p)) ? p.split('.').pop().toLowerCase() : magic === 'gz' && /\.tgz$/i.test(p) ? 'tgz' : magic || p.split('.').pop().toLowerCase();
    if (magic === 'zip' || (bytes[0] === 0x50 && bytes[1] === 0x4b)) ext = /\.docx$/i.test(p) ? 'docx' : 'zip';
    src = { p, ext, b64: head64 };
    info.textContent = pair(`Detected .${ext} from ${magic ? 'its first bytes' : 'its extension'} · ${fmtBytes(head64.length * 0.75)}`, `偵測到 .${ext} · ${fmtBytes(head64.length * 0.75)}`);
    clear(opts);
    for (const a of ADAPTERS) {
      if (!(a.from.includes(ext) || a.from.includes('*'))) continue;
      const ok = !a.tool || bundled[a.tool + 'Present'];
      opts.append(h('div.row', h('b', { style: { minWidth: '200px' } }, a.category), ...a.to.map((to) => h('button.btn.small' + (ok ? '' : '.outline'), { disabled: !ok, title: ok ? a.engine : pair(`${a.tool} is missing from this installation`, `缺少 ${a.tool}`), on: { click: () => convert(a, to) } }, to === 'extract' ? pair('Extract', '解壓') : `→ ${to}`))));
    }
    if (!opts.childNodes.length) opts.append(h('div.small.muted', pair('No converter handles this type.', '冇轉換器處理呢個類型。')));
  };
  const base = () => src.p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const convert = async (a, to) => {
    try {
      if (a.category === 'Images') {
        const img = new Image(); img.src = `data:image/${src.ext === 'svg' ? 'svg+xml' : src.ext === 'jpg' ? 'jpeg' : src.ext};base64,${src.b64}`; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
        const p = await window.mt.dialog.save({ defaultPath: `${base()}.${to === 'jpeg' ? 'jpg' : to}` }); if (p) { await window.mt.fs.writeBytes(p, c.toDataURL('image/' + to, 0.92).split(',')[1]); toast(pair('Converted.', '已轉換。'), { kind: 'ok' }); }
        return;
      }
      if (a.tool === 'ffmpeg') {
        const out = await window.mt.dialog.save({ defaultPath: `${base()}.${to}` }); if (!out) return;
        withProgress(pair(`Convert to ${to}`, `轉換做 ${to}`), (job) => window.mt.tools.convertMedia({ input: src.p, output: out, options: { audioOnly: a.category === 'Audio', crf: a.category === 'Video' && to !== 'gif' ? 23 : undefined } }, job), { onDone: (r, b) => r?.path && b.append(h('button.btn.small.outline', { on: { click: () => window.mt.shell.showItem(r.path) } }, icon('folder_open'), pair('Show in folder', '喺資料夾顯示'))) });
        return;
      }
      if (a.tool === 'sevenZip') {
        if (to === 'extract') { const d = await window.mt.dialog.open({ properties: ['openDirectory', 'createDirectory'], title: pair('Extract into', '解壓到') }); if (!d) return; withProgress(pair('Extract archive', '解壓'), (job) => window.mt.tools.archiveExtract({ file: src.p, dest: d[0] }, job), { onDone: () => window.mt.shell.openPath(d[0]) }); return; }
        const out = await window.mt.dialog.save({ defaultPath: `${base()}.${to}` }); if (!out) return;
        const tmp = await window.mt.dialog.open({ properties: ['openDirectory', 'createDirectory'], title: pair('Choose an empty working folder for repacking', '揀一個空資料夾做重新壓縮') }); if (!tmp) return;
        withProgress(pair(`Repack as ${to}`, `重新壓縮做 ${to}`), async (job) => { await window.mt.tools.archiveExtract({ file: src.p, dest: tmp[0] }, job); return window.mt.tools.archiveCreate({ files: [tmp[0] + (navigator.platform.startsWith('Win') ? '\\*' : '/*')], dest: out, format: to }, job); });
        return;
      }
      if (a.category === 'Documents / PDF' || (a.category === 'Code / text' && to !== 'txt')) {
        const out = await window.mt.dialog.save({ defaultPath: `${base()}.${to}` }); if (!out) return;
        withProgress(pair(`Convert to ${to}`, `轉換做 ${to}`), () => window.mt.tools.convertDocument({ input: src.p, output: out }), { onDone: (r, b) => r?.path && b.append(h('button.btn.small.outline', { on: { click: () => window.mt.shell.openPath(r.path) } }, icon('open_in_new'), pair('Open', '開'))) });
        return;
      }
      if (to === 'base64' || to === 'hex') {
        const out = to === 'base64' ? src.b64 : [...atob(src.b64)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        const p = await window.mt.dialog.save({ defaultPath: `${base()}.${to}.txt` }); if (p) { await window.mt.fs.writeText(p, out); toast(pair('Converted.', '已轉換。'), { kind: 'ok' }); }
        return;
      }
      const textIn = new TextDecoder().decode(Uint8Array.from(atob(src.b64), (c) => c.charCodeAt(0)));
      let data;
      if (src.ext === 'json') data = JSON.parse(textIn);
      else if (src.ext === 'csv') { const [hd, ...rows] = textIn.trim().split(/\r?\n/).map((l) => l.split(',')); data = rows.map((r) => Object.fromEntries(hd.map((k, i) => [k, r[i]]))); }
      else data = textIn;
      const f = FORMATS.find((x) => x.id === to) || FORMATS.find((x) => x.id === 'txt');
      await exportTo(f, () => ({ name: base(), data, text: typeof data === 'string' ? data : undefined }));
    } catch (e) { toast(pair(`Conversion failed: ${e.message}`, `轉換失敗：${e.message}`), { kind: 'err', actions: [{ label: pair('Copy a help request', '複製求助訊息'), run: () => helpRequest('Converting a file', e.message).click() }] }); }
  };
  return h('div.page', head(pair('Convert', '轉換'), t('converter'), pair('Detects a file\'s type from its first bytes and converts it locally with bundled ffmpeg and 7-Zip, Chromium, mammoth and pdf.js. Nothing is uploaded.', '用檔案頭位元組偵測類型，用內置 ffmpeg、7-Zip 等本機轉換，唔會上載。')),
    drop, info, opts, collapsible('conv-catalog', pair('Adapter catalogue', '轉換器目錄'), catalogue, { startCollapsed: true }));
});

// ---------------- Regex page ----------------
registerPage('regex', () => h('div.page', head(pair('Patterns', '模式'), t('regex'), pair('Build, test, explain, replace and generate code for regular expressions.', '建立、測試、解釋、替換同產生正則表達式程式碼。')), h('div.card', workbench({ initial: '(?<host>[a-z0-9-]+)\\s+(?<ip>100(?:\\.\\d{1,3}){3})' })), h('section.card', h('h2.h3', pair('Search inside files (GREP)', '喺檔案入面搜尋（GREP）')), folderSearch())));

// ---------------- Drawing board ----------------
const PENS = [['pen', 'Pen', 'P', 3], ['marker', 'Marker', 'M', 10], ['highlighter', 'Highlighter', 'H', 18], ['pencil', 'Pencil', 'N', 1.5], ['brush', 'Brush', 'B', 8], ['calligraphy', 'Calligraphy', 'C', 6], ['neon', 'Neon', 'O', 5], ['eraser', 'Eraser', 'E', 20]];
registerPage('draw', (ctx) => {
  const cv = h('canvas.draw', { width: 1600, height: 900, 'aria-label': pair('Drawing board', '畫板'), tabindex: '0' });
  const g = cv.getContext('2d');
  let tool = 'pen', color = '#1b2140', width = 3, strokes = JSON.parse(localStorage.getItem('mt.draw') || '[]'), redo = [], cur = null, bg = null;
  const redraw = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); if (bg) g.drawImage(bg, 0, 0, cv.width, cv.height); for (const s of strokes) paint(s); };
  const paint = (s) => {
    g.save(); g.lineCap = s.tool === 'calligraphy' ? 'square' : 'round'; g.lineJoin = 'round';
    g.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    g.globalAlpha = s.tool === 'highlighter' ? 0.35 : s.tool === 'pencil' ? 0.8 : 1;
    if (s.tool === 'neon') { g.shadowColor = s.color; g.shadowBlur = 14; }
    g.strokeStyle = s.tool === 'eraser' ? '#000' : s.color;
    for (let i = 1; i < s.pts.length; i++) {
      const [x0, y0, p0] = s.pts[i - 1], [x1, y1, p1] = s.pts[i];
      g.lineWidth = s.tool === 'brush' ? s.width * (0.4 + (p1 || 0.5)) : s.tool === 'calligraphy' ? s.width * (0.4 + Math.abs(Math.sin(Math.atan2(y1 - y0, x1 - x0)))) : s.width;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.restore();
  };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height), e.pressure || 0.5]; };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); cur = { tool, color, width, pts: [pos(e)], shift: e.shiftKey }; });
  cv.addEventListener('pointermove', (e) => { if (!cur) return; let p = pos(e); if (e.shiftKey) { const [x0, y0] = cur.pts[0]; p = Math.abs(p[0] - x0) > Math.abs(p[1] - y0) ? [p[0], y0, p[2]] : [x0, p[1], p[2]]; cur.pts = [cur.pts[0], p]; redraw(); paint(cur); return; } cur.pts.push(p); paint({ ...cur, pts: cur.pts.slice(-2) }); });
  cv.addEventListener('pointerup', () => { if (!cur) return; strokes.push(cur); cur = null; redo = []; save(); });
  const save = () => { try { localStorage.setItem('mt.draw', JSON.stringify(strokes)); } catch { toast(pair('The drawing is too large to keep between sessions.', '幅畫太大，存唔到。'), { kind: 'warn' }); } };
  const undo = () => { if (strokes.length) { redo.push(strokes.pop()); redraw(); save(); } };
  const redoF = () => { if (redo.length) { strokes.push(redo.pop()); redraw(); save(); } };
  const toolbar = h('div.row');
  const drawBar = () => { clear(toolbar).append(...PENS.map(([id, label, key, w]) => h('button.chip.choice', { 'aria-pressed': String(tool === id), title: `${label} (${key})`, 'aria-keyshortcuts': key, on: { click: () => { tool = id; width = w; drawBar(); } } }, label, h('span.small.muted', ` ${key}`))),
    h('input', { type: 'color', value: color, 'aria-label': pair('Colour', '顏色'), on: { input: (e) => { color = e.target.value; } } }),
    h('input.slider', { type: 'range', min: 1, max: 60, value: width, style: { width: '120px' }, 'aria-label': pair('Width', '粗幼'), on: { input: (e) => { width = Number(e.target.value); } } }),
    h('button.icon-btn', { 'aria-label': 'Undo (Ctrl+Z)', on: { click: undo } }, icon('undo')), h('button.icon-btn', { 'aria-label': 'Redo (Ctrl+Y)', on: { click: redoF } }, icon('redo')),
    h('button.btn.small.outline', { on: { click: async () => { if (await superConfirm({ action: pair('Clear the drawing', '清除畫作'), affects: pair(`${strokes.length} strokes`, `${strokes.length} 筆`) })) { strokes = []; redraw(); save(); } } } }, icon('delete_sweep'), pair('Clear', '清除')),
    h('button.btn.small.outline', { on: { click: async () => { const p = await window.mt.dialog.save({ defaultPath: 'drawing.svg' }); if (!p) return; const paths = strokes.filter((s) => s.tool !== 'eraser').map((s) => `<path d="M${s.pts.map((q) => q.slice(0, 2).join(' ')).join(' L')}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${s.tool === 'highlighter' ? 0.35 : 1}"/>`).join(''); await window.mt.fs.writeText(p, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cv.width} ${cv.height}"><rect width="100%" height="100%" fill="#fff"/>${paths}</svg>`); toast(pair('SVG saved.', '已儲存 SVG。'), { kind: 'ok' }); } } }, 'SVG'),
    ...[1, 2, 3].map((sc) => h('button.btn.small.outline', { on: { click: async () => { const c2 = document.createElement('canvas'); c2.width = cv.width * sc / 2; c2.height = cv.height * sc / 2; c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); const p = await window.mt.dialog.save({ defaultPath: `drawing@${sc}x.png` }); if (p) { await window.mt.fs.writeBytes(p, c2.toDataURL('image/png').split(',')[1]); toast(pair('PNG saved.', '已儲存 PNG。'), { kind: 'ok' }); } } } }, `PNG ${sc}x`)),
    h('button.btn.small.tonal', { on: { click: async () => { const b64 = await window.mt.win.capture(); const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); bg = im; redraw(); } } }, icon('screenshot_monitor'), pair('Annotate a screenshot of this app', '喺本程式截圖上畫'))); };
  const keys = (e) => { if (e.target.closest('input,textarea')) return; const p = PENS.find((x) => x[2].toLowerCase() === e.key.toLowerCase()); if (p && !e.ctrlKey) { tool = p[0]; width = p[3]; drawBar(); } if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redoF(); } };
  document.addEventListener('keydown', keys);
  ctx.onCleanup(() => document.removeEventListener('keydown', keys));
  drawBar(); setTimeout(redraw, 0);
  return h('div.page', head(pair('Annotate', '標註'), t('draw'), pair('Seven pens plus an eraser, Shift-locked straight strokes, undo and redo, SVG and 1x to 3x PNG export.', '七支筆加擦膠，Shift 畫直線，復原重做，匯出 SVG 同 PNG。')), h('div.card.tonal', toolbar), cv);
});

// ---------------- Ollama suite ----------------
const OLL = 'http://127.0.0.1:11434';
registerPage('ollama', (ctx) => {
  const box = h('div.stack'), running = h('div.stack'), chat = h('div.stack');
  const load = async () => {
    clear(box).append(h('div.skeleton', { style: { height: '80px' } }));
    try {
      const [tags, ps, ver] = await Promise.all([fetch(OLL + '/api/tags').then((x) => x.json()), fetch(OLL + '/api/ps').then((x) => x.json()).catch(() => ({ models: [] })), fetch(OLL + '/api/version').then((x) => x.json()).catch(() => ({}))]);
      clear(box).append(h('div.row', h('span.badge.ok', pair(`Ollama ${ver.version || ''} is running`, `Ollama ${ver.version || ''} 運行緊`)), h('span.small.muted', pair(`${(tags.models || []).length} models`, `${(tags.models || []).length} 個模型`))));
      for (const m of tags.models || []) box.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('smart_toy')), h('span.meta', h('b', m.name), h('span', `${fmtBytes(m.size)} · ${m.details?.family || ''} ${m.details?.parameter_size || ''} ${m.details?.quantization_level || ''}`)),
        h('button.btn.small.outline', { on: { click: async () => dialog({ title: m.name, wide: true, body: h('div.out', JSON.stringify(await fetch(OLL + '/api/show', { method: 'POST', body: JSON.stringify({ name: m.name }) }).then((x) => x.json()), null, 2).slice(0, 20000)) }) } }, pair('Details', '詳情')),
        h('button.btn.small.tonal', { on: { click: () => { modelSel.value = m.name; prompt.focus(); } } }, pair('Chat', '對話')),
        h('button.icon-btn.sm', { 'aria-label': pair(`Delete ${m.name}`, `刪除 ${m.name}`), on: { click: async () => { if (await superConfirm({ action: pair(`Delete the model ${m.name}`, `刪除模型 ${m.name}`), affects: fmtBytes(m.size) })) { await fetch(OLL + '/api/delete', { method: 'DELETE', body: JSON.stringify({ name: m.name }) }); toast(pair('Model deleted.', '已刪除模型。'), { kind: 'ok' }); load(); } } } }, icon('delete'))));
      if (!tags.models?.length) box.append(h('div.empty.small', pair('No models downloaded yet. Pull one below.', '未有模型，喺下面下載。')));
      clear(running).append(h('b', pair('Loaded in memory', '已載入記憶體')), ...(ps.models?.length ? ps.models.map((m) => h('div.chip', `${m.name} · ${fmtBytes(m.size_vram || m.size)} VRAM`)) : [h('span.small.muted', pair('None', '無'))]));
      clear(modelSel).append(...(tags.models || []).map((m) => h('option', { value: m.name }, m.name)));
    } catch {
      clear(box).append(h('span.badge.warn', pair('Ollama is not running or not installed', 'Ollama 未運行或者未安裝')),
        h('p', pair('One click downloads the official Ollama installer, verifies its SHA-256 checksum from the release, and installs it. If a previous install is broken, this repairs it in place; your models are kept.', '一撳就下載官方 Ollama 安裝程式、驗證 SHA-256 再安裝。舊版壞咗都會原地修復，模型會保留。')),
        h('button.btn', { dataset: { el: 'install-ollama' }, on: { click: () => withProgress(pair('Install Ollama', '安裝 Ollama'), (job) => window.mt.tools.installOllama(job), { onDone: (r, b) => { if (r?.ok) { b.append(h('p', pair(`Ollama ${r.version} installed; checksum verified.`, `已安裝 Ollama ${r.version}。`))); setTimeout(load, 4000); } else if (r?.message) b.append(h('p', r.message)); } }) } }, icon('download'), pair('Install or repair Ollama', '安裝或修復 Ollama')));
      clear(running);
    }
  };
  const model = text('llama3.2', { label: 'Model', mono: true });
  const prog = h('div.sc-progress', h('i', { style: { background: 'var(--primary)' } })); const progText = h('div.small');
  const pull = async () => {
    try {
      const res = await fetch(OLL + '/api/pull', { method: 'POST', body: JSON.stringify({ name: model.get() }) });
      const rd = res.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; for (const line of dec.decode(value).split('\n').filter(Boolean)) { const j = JSON.parse(line); if (j.error) throw new Error(j.error); const pct = j.total ? Math.round(((j.completed || 0) / j.total) * 100) : null; prog.firstChild.style.width = (pct ?? 5) + '%'; progText.textContent = `${j.status}${pct !== null ? ` ${pct}%` : ''}`; } }
      toast(pair('Model downloaded.', '模型已下載。'), { kind: 'ok' }); load();
    } catch (e) { toast(e.message, { kind: 'err' }); }
  };
  const modelSel = h('select.input', { 'aria-label': pair('Chat model', '對話模型') });
  const prompt = h('textarea.input', { placeholder: pair('Ask something…', '問啲嘢…'), style: { minHeight: '80px', fontFamily: 'var(--font-body)' }, 'aria-label': pair('Message', '訊息') });
  const msgs = []; const log = h('div.stack');
  const send = async () => {
    if (!prompt.value.trim() || !modelSel.value) return;
    msgs.push({ role: 'user', content: prompt.value }); log.append(h('div.card.tonal', { style: { padding: '12px' } }, h('b', pair('You', '你')), h('div', prompt.value))); prompt.value = '';
    const out = h('div', { style: { whiteSpace: 'pre-wrap' } }); log.append(h('div.card', { style: { padding: '12px' } }, h('b', modelSel.value), out));
    try {
      const res = await fetch(OLL + '/api/chat', { method: 'POST', body: JSON.stringify({ model: modelSel.value, messages: msgs, stream: true }) });
      const rd = res.body.getReader(); const dec = new TextDecoder(); let full = '';
      for (;;) { const { done, value } = await rd.read(); if (done) break; for (const line of dec.decode(value).split('\n').filter(Boolean)) { const j = JSON.parse(line); full += j.message?.content || ''; out.textContent = full; } }
      msgs.push({ role: 'assistant', content: full });
    } catch (e) { out.textContent = e.message; }
  };
  load();
  clear(chat).append(h('h2.h3', pair('Chat with a local model', '同本機模型對話')), modelSel, prompt, h('div.row', h('button.btn', { on: { click: send } }, icon('send'), pair('Send', '傳送')), h('button.btn.text', { on: { click: () => { msgs.length = 0; clear(log); } } }, pair('New conversation', '新對話'))), log);
  return h('div.page', head('Local AI', t('ollama'), pair('Install, run and manage local Ollama models: list, details, pull with progress, delete, what is loaded, and chat.', '安裝、運行同管理本機 Ollama 模型。'), h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))),
    h('div.grid', h('section.card.span-7', box, running), h('section.card.span-5.tonal', h('h2.h3', pair('Download a model', '下載模型')), model.el, h('div.suggest', ['llama3.2', 'qwen2.5', 'gemma3', 'mistral', 'phi4', 'deepseek-r1'].map((m) => h('button.chip.choice', { on: { click: () => model.set(m) } }, m))), h('div.row', h('button.btn', { on: { click: pull } }, icon('download'), pair('Pull', '下載'))), prog, progText)),
    h('section.card', chat));
});

