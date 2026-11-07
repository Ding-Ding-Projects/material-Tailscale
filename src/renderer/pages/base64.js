// The Base64 toolkit: drop a file to write its Base64 beside it (or download it, on the
// website), drop a Base64 text file to get the original back with its name and extension,
// encode and decode text in four character encodings, build and read data: URLs, preview the
// bytes safely, export results and step back and forth through a history that never stores
// content unless asked to. Everything runs on this device.
import { h, icon, clear, fmtBytes, fmtDateTime } from '../core/dom.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { t, pair } from '../core/i18n.js';
import { registerPage } from '../ui/shell.js';
import { toast, announce } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { segmented, stepper, switchCtl } from '../ui/controls.js';
import { helpRequest } from '../ui/jobs.js';
import { createJobs, downloadBlob, isSite } from '../ui/base64-jobs.js';
import { createHistory } from '../ui/base64-history.js';
import { renderPreview } from '../ui/base64-preview.js';
import B from '../../shared/base64.js';
import { zipParts } from '../../shared/zip-store.js';

const OPT_KEY = 'mt.b64.options.v1';
const DEFAULTS = { variant: 'std', pad: true, strict: true, lineLength: 0, eol: '\r\n', encoding: 'utf-8' };
const loadOptions = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(OPT_KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
const saveOptions = (o) => { try { localStorage.setItem(OPT_KEY, JSON.stringify(o)); } catch { /* a convenience only */ } };

const sha = (bytes) => B.createSha256().update(bytes).hex();
const short = (hex) => (hex ? hex.slice(0, 12) + '…' : '');
const b64std = (bytes) => B.encode(bytes, { variant: 'std', pad: true });

// One file of Base64 text pasted into the input is fine; beyond this the file targets stream it.
const TEXT_FILE_LIMIT = 8 * 1024 * 1024;

const CHAR_NAMES = { 0x20: ['space', '空格'], 0x09: ['tab', 'Tab'], 0x0a: ['line feed', '換行'], 0x0d: ['carriage return', '歸位字元'], 0x0c: ['form feed', '換頁'], 0x0b: ['vertical tab', '垂直 Tab'], 0xa0: ['no-break space', '不換行空格'], 0xfeff: ['byte-order mark', '位元組順序記號'], 0xfffd: ['replacement character', '替代字元'] };
function charText(ch) {
  if (ch === undefined) return pair('that character', '嗰個字元');
  const cp = ch.codePointAt(0);
  const u = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  const n = CHAR_NAMES[cp];
  return n ? `${u} (${pair(n[0], n[1])})` : cp < 0x20 || cp === 0x7f ? u : `“${ch}” (${u})`;
}

/** A localized sentence for every way a conversion can fail. */
export function explainFailure(e) {
  const off = e.offset;
  switch (e.code) {
    case 'invalid-char': return pair(`Character ${charText(e.detail)} at offset ${off} is not Base64 in the chosen variant.`, `第 ${off} 位嘅字元 ${charText(e.detail)} 唔係揀咗嗰種 Base64。`);
    case 'wrong-padding': return {
      missing: pair(`Padding is missing at the end (offset ${off}). Turn off strict decoding to accept it.`, `尾段缺少填充（第 ${off} 位）。熄咗嚴格解碼就會接受。`),
      unexpected: pair(`Padding “=” at offset ${off}, but padding is turned off.`, `第 ${off} 位有填充「=」，但填充已經熄咗。`),
      misplaced: pair(`Padding “=” at offset ${off} is in the wrong place.`, `第 ${off} 位嘅填充「=」擺錯位。`),
      'too-many': pair(`Too many “=” at offset ${off}.`, `第 ${off} 位多咗「=」。`),
      'data-after': pair(`Base64 continues after the padding, at offset ${off}.`, `填充之後仲有 Base64，喺第 ${off} 位。`)
    }[e.detail] || pair(`Wrong padding at offset ${off}.`, `第 ${off} 位填充唔啱。`);
    case 'truncated': return pair(`The Base64 ends with a single character at offset ${off}, which cannot hold a byte. Part of it may be missing.`, `Base64 喺第 ${off} 位得一個字元收尾，裝唔落一個位元組，可能唔齊。`);
    case 'empty': return pair('There is nothing to decode yet.', '仲未有嘢可以解碼。');
    case 'data-url': return e.detail === 'not-base64' ? pair('This data: URL is not Base64 (it has no ;base64 marker); its text is shown as it is.', '呢個 data: URL 唔係 Base64（冇 ;base64 標記）。') : pair('The data: URL has no comma after its header.', 'data: URL 個標頭後面冇逗號。');
    case 'unsupported-encoding': return pair(`That text cannot be written in the chosen encoding${off !== undefined ? ` (offset ${off})` : ''}. Pick UTF-8 or UTF-16.`, `嗰段文字用揀咗嘅編碼寫唔到${off !== undefined ? `（第 ${off} 位）` : ''}。揀 UTF-8 或者 UTF-16。`);
    case 'not-text': return pair('These bytes are not text in the chosen encoding; they are shown in Preview instead.', '呢啲位元組喺揀咗嘅編碼唔係文字，改喺預覽度顯示。');
    case 'too-large': return pair(`That file is over ${fmtBytes(TEXT_FILE_LIMIT)}; drop it on Decode beside the file instead, which streams it.`, `個檔案大過 ${fmtBytes(TEXT_FILE_LIMIT)}，請放落「解碼放喺旁邊」，會分段處理。`);
    case 'cancelled': return pair('Cancelled. Nothing was kept.', '已取消，乜都冇留低。');
    case 'verify-failed': return pair('The round trip did not match, so nothing was kept.', '來回驗證對唔上，所以乜都冇留低。');
    case 'ENOENT': return pair('The file is no longer there.', '個檔案已經唔喺度。');
    case 'EACCES': case 'EPERM': case 'EROFS': return pair('That folder cannot be written to. Copy the file somewhere you can write, then try again.', '嗰個資料夾寫唔到。將檔案抄去寫得到嘅地方再試。');
    case 'ENOSPC': return pair('The disk is full. Nothing was kept.', '磁碟滿咗，乜都冇留低。');
    default: return e.message || pair('Something went wrong.', '出咗問題。');
  }
}

const NAME_SOURCE = {
  name: pair('from the file name', '由檔名'),
  'data-url': pair('from the data: URL type', '由 data: URL 類型'),
  signature: pair('from the file’s signature', '由檔案簽名'),
  fallback: pair('no clue in the name, type or signature, so .bin', '檔名、類型同簽名都冇線索，所以用 .bin')
};

const MIME_CHOICES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/json', 'text/plain', 'text/html', 'text/csv', 'audio/mpeg', 'video/mp4', 'application/zip', 'application/octet-stream'];

// Jobs and history outlive the page: closing the tab does not stop a conversion, and the
// list is still there when the toolkit opens again.
let shared = null;
const jobSubs = new Set();
function sharedState() {
  if (shared) return shared;
  const hist = createHistory();
  const jobs = createJobs((list) => jobSubs.forEach((f) => f(list)), {
    onFinished: (j) => {
      if (j.state === 'done') {
        const r = j.result;
        announce(pair(`${j.name}: ${r.name} written and verified.`, `${j.name}：${r.name} 已寫好同驗證。`));
        hist.add({ kind: j.kind === 'encode' ? 'encode-file' : 'decode-file', input: { name: j.name, bytes: j.kind === 'encode' ? r.bytes : r.chars, sha256: j.kind === 'encode' ? r.sha256 : undefined }, output: { name: r.name, path: r.path || null, bytes: r.written, sha256: j.kind === 'decode' ? r.sha256 : undefined, downloaded: !!r.downloaded }, options: r.options, verified: r.verified, roundTrip: r.roundTrip });
      } else if (j.state === 'failed') announce(pair(`${j.name} was not converted.`, `${j.name} 冇轉換到。`));
    }
  });
  shared = { hist, jobs };
  return shared;
}

registerPage('base64', () => {
  const saved = loadOptions();
  const site = isSite();
  const { hist, jobs } = sharedState();

  // ---------- options ----------
  const variant = segmented([{ value: 'std', label: pair('Standard', '標準') }, { value: 'url', label: pair('URL-safe', '網址安全') }, { value: 'mime', label: 'MIME (76)' }], saved.variant, { label: pair('Variant', '變體') });
  const pad = switchCtl(saved.pad, { label: pair('Padding', '填充') });
  const strict = switchCtl(saved.strict, { label: pair('Strict decoding', '嚴格解碼') });
  const lineLen = stepper(saved.lineLength, { min: 0, max: 100000, step: 4, label: pair('Line length, 0 for one line', '每行長度，0 即一行'), chips: [{ value: 0, label: pair('One line', '一行') }, { value: 64, label: '64 (PEM)' }, { value: 76, label: '76' }] });
  const eol = segmented([{ value: '\r\n', label: 'CRLF' }, { value: '\n', label: 'LF' }], saved.eol, { label: pair('Line ending', '換行') });
  const encoding = segmented([{ value: 'utf-8', label: 'UTF-8' }, { value: 'utf-16le', label: 'UTF-16 LE' }, { value: 'utf-16be', label: 'UTF-16 BE' }, { value: 'latin1', label: 'Latin-1' }], saved.encoding, { label: pair('Text encoding', '文字編碼') });
  const options = () => ({ variant: variant.get(), pad: pad.get(), strict: strict.get(), lineLength: Number(lineLen.get()) || 0, eol: eol.get(), encoding: encoding.get() });
  const mimeNote = h('p.small.muted', pair('MIME uses 76-character lines joined by CRLF, with padding.', 'MIME 每行 76 個字元，用 CRLF 分行，一定有填充。'));
  const wrapRow = h('div.row', h('div.stack.tight', h('b.small', pair('Line length', '每行長度')), lineLen.el), h('div.stack.tight', h('b.small', pair('Line ending', '換行')), eol.el));
  const syncOptions = () => {
    const mime = variant.get() === 'mime';
    if (mime) pad.set(true);
    pad.el.disabled = mime;
    wrapRow.hidden = mime; mimeNote.hidden = !mime;
    saveOptions(options());
    countIn(); countOut();
  };
  const setOptions = (o) => { variant.set(o.variant); pad.set(o.pad); strict.set(o.strict); lineLen.set(o.lineLength); eol.set(o.eol); encoding.set(o.encoding); syncOptions(); };
  [variant, pad, strict, lineLen, eol, encoding].forEach((c) => c.onChange(syncOptions));
  const optionsCard = h('section.card.span-12.tonal', { dataset: { el: 'b64-options' } },
    h('div.card-head', h('span.ic', icon('tune')), h('h2.h3', pair('Options for text and files', '文字同檔案嘅選項'))),
    h('div.row', h('div.stack.tight', h('b.small', pair('Variant', '變體')), variant.el), h('div.stack.tight', h('b.small', pair('Text encoding', '文字編碼')), encoding.el)),
    wrapRow, mimeNote,
    h('div.row', h('div.switch-row', h('div.txt', h('b', pair('Padding', '填充')), h('span.small.muted', pair('Write “=” at the end so the length is a multiple of four.', '尾段加「=」令長度係四嘅倍數。'))), pad.el),
      h('div.switch-row', h('div.txt', h('b', pair('Strict decoding', '嚴格解碼')), h('span.small.muted', pair('Only the chosen alphabet and padding; off skips spaces and line breaks and accepts missing padding.', '只接受揀咗嘅字母同填充；熄咗就會略過空格同換行，冇填充都接受。'))), strict.el)));

  // ---------- results shared by the text, data: URL and preview cards ----------
  let last = null; // { bytes, type: { mime, how }, name }
  let releasePreview = () => {};
  const previewBox = h('div.stack', { dataset: { el: 'b64-preview' } });
  const showBytes = (bytes, type, name) => {
    last = bytes ? { bytes, type, name } : null;
    releasePreview();
    releasePreview = renderPreview(previewBox, bytes, type, { textOf: (b) => B.bytesToText(b, encoding.get()) });
  };

  // ---------- text ----------
  const inp = h('textarea.input', { 'aria-label': pair('Input', '輸入'), placeholder: pair('Type or paste text, Base64 or a data: URL', '輸入或者貼上文字、Base64 或 data: URL'), dataset: { el: 'b64-input' }, spellcheck: 'false' });
  const out = h('textarea.input', { 'aria-label': pair('Output', '輸出'), readonly: true, dataset: { el: 'b64-output' }, spellcheck: 'false' });
  const inCount = h('div.small.muted');
  const outCount = h('div.small.muted');
  const status = h('div.small.b64-status', { role: 'status' });
  const say = (msg, kind = 'ok') => { status.textContent = msg; status.className = `small b64-status ${kind}`; };
  function countIn() {
    const s = inp.value;
    let bytes;
    try { bytes = B.textToBytes(s, encoding.get()).length; } catch { bytes = null; }
    inCount.textContent = bytes === null
      ? pair(`${s.length} characters; some cannot be written in ${encoding.get().toUpperCase()}`, `${s.length} 個字元；有啲用 ${encoding.get().toUpperCase()} 寫唔到`)
      : pair(`${s.length} characters · ${fmtBytes(bytes)} in ${encoding.get().toUpperCase()}`, `${s.length} 個字元 · ${encoding.get().toUpperCase()} ${fmtBytes(bytes)}`);
  }
  function countOut() {
    if (!out.value && last?.bytes && outKind === 'binary') { outCount.textContent = pair(`${fmtBytes(last.bytes.length)} of ${last.type.mime}; shown in Preview`, `${fmtBytes(last.bytes.length)} ${last.type.mime}；喺預覽度顯示`); return; }
    outCount.textContent = out.value ? pair(`${out.value.length} characters`, `${out.value.length} 個字元`) + (last?.bytes ? ` · ${fmtBytes(last.bytes.length)}` : '') : '';
  }
  let outKind = 'text';
  inp.addEventListener('input', countIn);
  const state = () => ({ options: options(), input: inp.value, output: out.value });
  const restore = (st, entry) => {
    if (!st) return;
    setOptions({ ...DEFAULTS, ...st.options });
    if (st.input !== undefined) { inp.value = st.input; out.value = st.output ?? ''; outKind = 'text'; showBytes(null); say(pair('Restored the text from history.', '由紀錄還原咗文字。')); }
    else { say(pair(`Restored the options of “${entryTitle(entry)}”. Its text was not kept; turn on Keep text in history to keep text next time.`, `還原咗「${entryTitle(entry)}」嘅選項。冇保留文字；想保留可以開「喺紀錄保留文字」。`), 'warn'); }
    countIn(); countOut(); drawHistory();
  };

  const encodeText = () => {
    const before = state();
    let bytes;
    try { bytes = B.textToBytes(inp.value, encoding.get()); } catch (e) { say(explainFailure(e), 'err'); if (e.offset !== undefined) inp.setSelectionRange(e.offset, e.offset + 1); return; }
    out.value = B.encode(bytes, options()); outKind = 'text';
    showBytes(bytes, { mime: 'text/plain', how: pair('typed text', '輸入嘅文字') }, 'text');
    say(pair(`Encoded ${fmtBytes(bytes.length)} into ${out.value.length} characters.`, `已將 ${fmtBytes(bytes.length)} 編碼成 ${out.value.length} 個字元。`));
    hist.add({ kind: 'encode-text', input: { bytes: bytes.length, sha256: sha(bytes) }, output: { chars: out.value.length }, options: options() }, { before, after: state() });
    countOut();
  };
  const decodeText = () => {
    const before = state();
    let r;
    try { r = B.decode(inp.value, options()); } catch (e) {
      say(explainFailure(e), 'err');
      if (Number.isInteger(e.offset) && e.code !== 'empty') { inp.focus(); inp.setSelectionRange(e.offset, Math.min(inp.value.length, e.offset + 1)); }
      return;
    }
    const type = r.dataUrl ? { mime: r.dataUrl.mime, how: 'data: URL' } : B.sniff(r.bytes);
    let text = null;
    if (/^(text\/|application\/(json|xml))|svg/.test(type.mime) || type.mime === 'application/octet-stream') { try { text = B.bytesToText(r.bytes, encoding.get()); } catch { text = null; } }
    if (text !== null) { out.value = text; outKind = 'text'; } else { out.value = ''; outKind = 'binary'; }
    showBytes(r.bytes, type, 'decoded');
    say(text !== null ? pair(`Decoded ${fmtBytes(r.bytes.length)} of ${type.mime}.`, `已解碼 ${fmtBytes(r.bytes.length)} ${type.mime}。`) : explainFailure({ code: 'not-text' }), text !== null ? 'ok' : 'warn');
    hist.add({ kind: 'decode-text', input: { chars: inp.value.length }, output: { bytes: r.bytes.length, sha256: sha(r.bytes), mime: type.mime }, options: options() }, { before, after: state() });
    countOut();
  };
  const importText = async () => {
    const p = await window.mt.dialog.open({ filters: [{ name: pair('Base64 text', 'Base64 文字'), extensions: ['txt', 'b64', 'base64'] }, { name: pair('All files', '所有檔案'), extensions: ['*'] }] });
    if (!p) return;
    const s = await window.mt.fs.readText(p[0]);
    if (s.length > TEXT_FILE_LIMIT) { say(explainFailure({ code: 'too-large' }), 'warn'); return; }
    inp.value = s; countIn(); say(pair('Loaded the file into Input. Press Decode.', '已將檔案放入輸入，撳解碼。'));
  };
  const pasteText = async () => {
    let s = '';
    try { s = await navigator.clipboard.readText(); } catch { s = ''; }
    if (!s) { say(pair('The clipboard has no text.', '剪貼簿冇文字。'), 'warn'); return; }
    inp.value = s; countIn(); say(pair('Pasted from the clipboard.', '已由剪貼簿貼上。'));
  };
  const saveOutput = async () => {
    if (outKind === 'binary' || (last?.bytes && !out.value)) return saveBytesNow();
    if (!out.value) { say(pair('There is no output to save yet.', '仲未有輸出可以儲存。'), 'warn'); return; }
    const p = await window.mt.dialog.save({ defaultPath: 'text.base64.txt', filters: [{ name: pair('Base64 text', 'Base64 文字'), extensions: ['txt'] }, { name: 'Base64', extensions: ['b64'] }] });
    if (!p) return;
    await window.mt.fs.writeText(p, out.value);
    toast(pair(`Saved to ${p}`, `已儲存去 ${p}`), { kind: 'ok', actions: site ? [] : [{ label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(p) }] });
  };
  const saveBytesNow = async () => {
    if (!last?.bytes) { say(pair('Decode something first.', '請先解碼。'), 'warn'); return; }
    const guess = B.restoredName('decoded', { dataMime: last.type.mime, sniffed: B.sniff(last.bytes) }).name;
    const p = await window.mt.dialog.save({ defaultPath: guess });
    if (!p) return;
    await window.mt.fs.writeBytes(p, b64std(last.bytes));
    toast(pair(`Saved ${fmtBytes(last.bytes.length)} to ${p}`, `已儲存 ${fmtBytes(last.bytes.length)} 去 ${p}`), { kind: 'ok', actions: site ? [] : [{ label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(p) }] });
  };
  const copyOut = async () => { if (!out.value) return; await navigator.clipboard.writeText(out.value); toast(t('copied'), { kind: 'ok' }); };
  const swap = () => { if (!out.value) return; inp.value = out.value; out.value = ''; outKind = 'text'; countIn(); countOut(); inp.focus(); };
  const clearText = () => { inp.value = ''; out.value = ''; outKind = 'text'; showBytes(null); say(''); countIn(); countOut(); };

  const textCards = [
    h('section.card.span-6', h('div.card-head', h('span.ic', icon('input')), h('h2.h3', pair('Input', '輸入'))), inp, inCount,
      h('div.row', h('button.btn', { type: 'button', dataset: { el: 'b64-encode' }, on: { click: encodeText } }, icon('lock'), pair('Encode', '編碼')),
        h('button.btn.tonal', { type: 'button', dataset: { el: 'b64-decode' }, on: { click: decodeText } }, icon('lock_open'), pair('Decode', '解碼')),
        h('button.btn.outline', { type: 'button', on: { click: pasteText } }, icon('content_paste'), pair('Paste', '貼上')),
        h('button.btn.outline', { type: 'button', on: { click: importText } }, icon('file_open'), pair('Open a Base64 file…', '開 Base64 檔案…')),
        h('button.btn.text', { type: 'button', on: { click: clearText } }, icon('backspace'), pair('Clear', '清除')))),
    h('section.card.span-6', h('div.card-head', h('span.ic.alt', icon('output')), h('h2.h3', pair('Output', '輸出'))), out, outCount, status,
      h('div.row', h('button.btn.small.tonal', { type: 'button', on: { click: copyOut } }, icon('content_copy'), t('copy')),
        h('button.btn.small.outline', { type: 'button', on: { click: saveOutput } }, icon('save'), pair('Save…', '儲存…')),
        h('button.btn.small.outline', { type: 'button', on: { click: swap } }, icon('swap_vert'), pair('Use as input', '當輸入用')),
        h('button.btn.small.outline', { type: 'button', on: { click: () => exportRecord([currentRecord()]) } }, icon('data_object'), pair('JSON record…', 'JSON 紀錄…'))))
  ];

  // ---------- files beside their source ----------
  const jobsList = h('ul.b64-jobs', { dataset: { el: 'b64-jobs' }, 'aria-label': pair('File conversions', '檔案轉換') });
  const jobsEmpty = h('p.small.muted', pair('Nothing converted yet. Drop a file on one of the two targets above, or pick one.', '仲未轉換過。將檔案放落上面兩個目標，或者揀一個。'));
  const rows = new Map();
  // Listeners stay until the page has been shown and then left the document.
  const onJobs = (list) => { if (!page.isConnected && pageSeen) { jobSubs.delete(onJobs); return; } if (page.isConnected) pageSeen = true; drawJobs(list); };
  jobSubs.add(onJobs);
  const addFiles = (kind, files) => {
    let n = 0;
    for (const f of files) {
      if (site) { jobs.start(kind, { file: f }, options()); n++; continue; }
      const p = window.mt.pathForFile(f);
      if (!p) continue;
      jobs.start(kind, { path: p, size: f.size }, options()); n++;
    }
    if (!n) toast(pair('Only files can be converted here.', '呢度只可以轉換檔案。'), { kind: 'warn' });
  };
  const pickFiles = async (kind) => {
    if (site) {
      const input = h('input', { type: 'file', multiple: true, hidden: true, accept: kind === 'decode' ? '.txt,.b64,.base64,text/plain' : null });
      input.addEventListener('change', () => { addFiles(kind, [...input.files]); input.remove(); });
      input.addEventListener('cancel', () => input.remove());
      document.body.append(input); input.click();
      return;
    }
    const ps = await window.mt.dialog.open({ properties: ['openFile', 'multiSelections'], filters: kind === 'decode' ? [{ name: pair('Base64 text', 'Base64 文字'), extensions: ['txt', 'b64', 'base64'] }, { name: pair('All files', '所有檔案'), extensions: ['*'] }] : [] });
    for (const p of ps || []) jobs.start(kind, { path: p }, options());
  };
  const dropTarget = (kind) => {
    const enc = kind === 'encode';
    const pick = h('button.btn', { type: 'button', dataset: { el: enc ? 'b64-pick-encode' : 'b64-pick-decode' }, on: { click: () => pickFiles(kind) } }, icon(enc ? 'upload_file' : 'file_open'), enc ? pair('Pick files to encode…', '揀檔案編碼…') : pair('Pick Base64 files…', '揀 Base64 檔案…'));
    const card = h(`section.card.span-6.b64-drop${enc ? '' : '.alt'}`, { dataset: { el: enc ? 'b64-encode-drop' : 'b64-decode-drop', dropTarget: kind } },
      h('div.b64-drop-art', icon(enc ? 'note_add' : 'restore_page')),
      h('h2.h3', enc ? pair('Encode beside the file', '編碼，放喺檔案旁邊') : pair('Decode beside the file', '解碼，放返喺旁邊')),
      h('p.small', enc
        ? (site ? pair('Drop files here. Each downloads as its full name plus .base64.txt: report.pdf becomes report.pdf.base64.txt.', '將檔案放落嚟。每個會下載成原名加 .base64.txt：report.pdf 變 report.pdf.base64.txt。') : pair('Drop files here. Each gets its Base64 in the same folder, named with its full name plus .base64.txt: report.pdf becomes report.pdf.base64.txt.', '將檔案放落嚟。每個會喺同一個資料夾寫低 Base64，檔名係原名加 .base64.txt：report.pdf 變 report.pdf.base64.txt。'))
        : (site ? pair('Drop .base64.txt or .b64 files here. Each downloads as the original file, its name and extension restored.', '將 .base64.txt 或 .b64 檔案放落嚟。每個會下載返原本嘅檔案，檔名同副檔名還原。') : pair('Drop .base64.txt or .b64 files here. The original file is written next to each one, its name and extension restored: report.pdf.base64.txt gives report.pdf.', '將 .base64.txt 或 .b64 檔案放落嚟。原本嘅檔案會寫喺旁邊，檔名同副檔名還原：report.pdf.base64.txt 變返 report.pdf。'))),
      h('p.small.muted', site ? pair('Uses the options below. Verified by a SHA-256 round trip before it downloads.', '用下面嘅選項。下載之前會用 SHA-256 來回驗證。') : pair('Never overwrites: a taken name gets (1), (2) before the extension. Uses the options below and is verified by a SHA-256 round trip.', '永遠唔會覆蓋：撞名就喺副檔名前面加 (1)、(2)。用下面嘅選項，並用 SHA-256 來回驗證。')),
      h('div.row', pick));
    let depth = 0;
    const files = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    card.addEventListener('dragenter', (e) => { if (!files(e)) return; e.preventDefault(); depth++; card.classList.add('over'); });
    card.addEventListener('dragover', (e) => { if (!files(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    card.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) card.classList.remove('over'); });
    card.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); depth = 0; card.classList.remove('over'); addFiles(kind, [...e.dataTransfer.files]); });
    return card;
  };

  const PHASE = { encode: pair('Encoding', '編碼緊'), decode: pair('Decoding', '解碼緊'), verify: pair('Checking the round trip', '驗證緊來回') };
  function makeRow(j) {
    const ic = h('span.ic', icon(j.kind === 'encode' ? 'lock' : 'lock_open'));
    const title = h('b');
    const detail = h('span.small');
    const bar = h('div.sc-progress', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': pair(`Progress of ${j.name}`, `${j.name} 嘅進度`) }, h('i'));
    const badge = h('span.badge');
    const actions = h('div.row.b64-job-actions');
    const el = h('li.b64-job', ic, h('div.meta', title, detail, bar), badge, actions);
    let shownState = null;
    return {
      el,
      update(j) {
        el.dataset.state = j.state;
        const outName = j.result?.name;
        title.textContent = outName ? `${j.name} → ${outName}` : j.name;
        const pct = j.state === 'done' ? 100 : j.total ? Math.floor((j.done / j.total) * 100) : 0;
        bar.firstChild.style.width = `${Math.max(2, pct)}%`;
        bar.setAttribute('aria-valuenow', String(pct));
        bar.hidden = !['running', 'paused', 'queued'].includes(j.state);
        const r = j.result;
        if (j.state === 'done') {
          const where = r.downloaded ? pair(`Downloaded as ${r.name}`, `下載咗做 ${r.name}`) : pair(`Written beside it as ${r.name}`, `寫咗喺旁邊，叫 ${r.name}`);
          const from = j.kind === 'decode' && r.nameSource ? ` · ${pair('name', '檔名')} ${NAME_SOURCE[r.nameSource]}` : '';
          detail.textContent = `${where} · ${fmtBytes(r.written)} · SHA-256 ${short(r.sha256)}${from}${j.kind === 'decode' && !r.roundTrip ? ` · ${pair('the input was not in canonical form, so encoding the result gives slightly different text', '輸入唔係標準形式，所以再編碼會有少少唔同')}` : ''}`;
        } else if (j.state === 'failed' || j.state === 'cancelled') detail.textContent = explainFailure(j.error || { code: 'cancelled' });
        else if (j.state === 'queued') detail.textContent = pair('Waiting for the one before it.', '等緊前一個。');
        else detail.textContent = `${PHASE[j.phase] || ''} · ${j.total ? `${fmtBytes(j.done)} / ${fmtBytes(j.total)}` : ''}`;
        const [tone, label] = {
          queued: ['', pair('Waiting', '等緊')], running: ['info', PHASE[j.phase] || pair('Working', '處理緊')], paused: ['warn', pair('Paused', '暫停咗')],
          done: ['ok', r?.roundTrip ? pair('Round trip verified', '來回驗證通過') : pair('Bytes verified', '位元組驗證通過')], failed: ['err', pair('Not converted', '冇轉換到')], cancelled: ['', pair('Cancelled', '取消咗')]
        }[j.state];
        badge.className = `badge ${tone}`; badge.textContent = label;
        if (shownState === j.state) return;
        shownState = j.state;
        const hadFocus = actions.contains(document.activeElement);
        const btn = (ic2, label2, run, el2) => h('button.icon-btn', { type: 'button', 'aria-label': `${label2}: ${j.name}`, title: label2, dataset: el2 ? { el: el2 } : {}, on: { click: run } }, icon(ic2));
        clear(actions);
        if (j.state === 'running') actions.append(btn('pause', pair('Pause', '暫停'), () => jobs.pause(j)), btn('close', pair('Cancel', '取消'), () => jobs.cancel(j)));
        if (j.state === 'paused') actions.append(btn('play_arrow', pair('Resume', '繼續'), () => jobs.resume(j)), btn('close', pair('Cancel', '取消'), () => jobs.cancel(j)));
        if (j.state === 'queued') actions.append(btn('close', pair('Cancel', '取消'), () => jobs.cancel(j)));
        if (j.state === 'done' && r.path) actions.append(btn('folder_open', pair('Show in folder', '喺資料夾顯示'), () => window.mt.shell.showItem(r.path)), btn('content_copy', pair('Copy the path', '複製路徑'), async () => { await navigator.clipboard.writeText(r.path); toast(t('copied'), { kind: 'ok' }); }));
        if (j.state === 'done' && r.blob) actions.append(btn('download', pair('Download again', '再下載'), () => downloadBlob(r.name, r.blob)));
        if (j.state === 'failed') actions.append(helpRequest(pair(`Base64 ${j.kind} of ${j.name}`, `Base64 ${j.kind} ${j.name}`), j.error?.message || ''));
        if (['done', 'failed', 'cancelled'].includes(j.state)) actions.append(btn('playlist_remove', pair('Remove from the list', '由清單移走'), () => jobs.remove(j)));
        if (hadFocus) (actions.querySelector('button') || el).focus?.();
      }
    };
  }
  function drawJobs(list) {
    for (const j of list) { let r = rows.get(j.id); if (!r) { r = makeRow(j); rows.set(j.id, r); } r.update(j); }
    for (const [id, r] of rows) if (!list.some((j) => j.id === id)) { r.el.remove(); rows.delete(id); }
    list.forEach((j, i) => { const el = rows.get(j.id).el; if (jobsList.children[i] !== el) jobsList.insertBefore(el, jobsList.children[i] || null); });
    jobsEmpty.hidden = list.length > 0;
    const done = list.filter((j) => j.state === 'done');
    zipBtn.disabled = !done.length; recBtn.disabled = !list.some((j) => j.state === 'done' || j.state === 'failed'); clearBtn.disabled = !list.some((j) => ['done', 'failed', 'cancelled'].includes(j.state));
    jobsCount.textContent = list.length ? pair(`${done.length} of ${list.length} done`, `${list.length} 個入面完成咗 ${done.length} 個`) : '';
  }
  const zipAll = async () => {
    const done = jobs.list.filter((j) => j.state === 'done');
    if (!done.length) return;
    if (site) {
      const parts = zipParts(done.map((j) => ({ name: j.result.name, data: j.result.blob, size: j.result.blob.size, crc: j.result.crc, date: new Date(j.at) })));
      downloadBlob('base64-results.zip', new Blob(parts, { type: 'application/zip' }));
      return;
    }
    const dest = await window.mt.dialog.save({ defaultPath: 'base64-results.zip', filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (!dest) return;
    try {
      const r = await window.mt.tools.archiveCreate({ files: done.map((j) => j.result.path), dest, format: 'zip' }, 'b64-zip');
      toast(pair(`Saved ${done.length} result(s) to ${r.path}`, `已將 ${done.length} 個結果存去 ${r.path}`), { kind: 'ok', actions: [{ label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(r.path) }] });
    } catch (e) { toast(e.message, { kind: 'err' }); }
  };
  const zipBtn = h('button.btn.small.tonal', { type: 'button', disabled: true, on: { click: zipAll } }, icon('folder_zip'), pair('Export all as .zip…', '全部匯出做 .zip…'));
  const recBtn = h('button.btn.small.outline', { type: 'button', disabled: true, on: { click: () => exportRecord(jobs.list.filter((j) => j.state === 'done' || j.state === 'failed').map(jobRecord)) } }, icon('data_object'), pair('JSON record…', 'JSON 紀錄…'));
  const clearBtn = h('button.btn.small.text', { type: 'button', disabled: true, on: { click: () => jobs.clearFinished() } }, icon('clear_all'), pair('Clear finished', '清走完成咗嘅'));
  const jobsCount = h('span.small.muted');
  const jobsCard = h('section.card.span-12', h('div.card-head', h('span.ic', icon('swap_horiz')), h('h2.h3', pair('Files', '檔案')), jobsCount), jobsEmpty, jobsList, h('div.row', zipBtn, recBtn, clearBtn));

  // ---------- records ----------
  const includePayload = switchCtl(false, { label: pair('Include the content in JSON records', 'JSON 紀錄包埋內容') });
  const currentRecord = () => ({ kind: 'text', options: options(), input: { chars: inp.value.length, sha256: sha(B.textToBytes(inp.value, 'utf-8')) }, output: { chars: out.value.length, bytes: last?.bytes?.length ?? null, sha256: last?.bytes ? sha(last.bytes) : null, mime: last?.type?.mime ?? null }, ...(includePayload.get() ? { payload: { input: inp.value, output: out.value || (last?.bytes ? b64std(last.bytes) : '') } } : {}) });
  const jobRecord = (j) => ({ kind: j.kind, source: j.name, state: j.state, options: j.options, ...(j.state === 'done' ? { output: { name: j.result.name, path: j.result.path || null, bytes: j.result.written, sha256: j.result.sha256, verified: j.result.verified, roundTrip: j.result.roundTrip, nameFrom: j.result.nameSource || null } } : { error: j.error }) });
  async function exportRecord(items) {
    const rec = { tool: 'Material Tailscale Base64 toolkit', schema: 1, exportedAt: new Date().toISOString(), conversions: items };
    const text = JSON.stringify(rec, null, 2) + '\n';
    if (site) { downloadBlob('base64-record.json', new Blob([text], { type: 'application/json' })); return; }
    const p = await window.mt.dialog.save({ defaultPath: 'base64-record.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!p) return;
    await window.mt.fs.writeText(p, text);
    toast(pair(`Saved the record to ${p}`, `已將紀錄存去 ${p}`), { kind: 'ok', actions: [{ label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(p) }] });
  }

  // ---------- data: URLs ----------
  const mimeSel = h('select.input', { 'aria-label': pair('MIME type for the data: URL', 'data: URL 嘅 MIME 類型') }, h('option', { value: '' }, pair('Detected from the bytes', '由位元組偵測')), MIME_CHOICES.map((m) => h('option', { value: m }, m)), h('option', { value: 'custom' }, pair('Another type…', '其他類型…')));
  const customMime = h('input.input', { placeholder: 'type/subtype', 'aria-label': pair('Another MIME type', '其他 MIME 類型'), hidden: true, spellcheck: 'false' });
  mimeSel.addEventListener('change', () => { customMime.hidden = mimeSel.value !== 'custom'; });
  const dataOut = h('div.out.b64-dataurl', { dataset: { label: pair('Built data: URL', '建立咗嘅 data: URL') } });
  const dataIn = h('textarea.input', { 'aria-label': pair('A data: URL to read', '要讀嘅 data: URL'), placeholder: 'data:image/png;base64,iVBORw0KGgo…', style: { minHeight: '72px' }, spellcheck: 'false' });
  const dataInfo = h('div.small');
  const buildDataUrl = () => {
    const bytes = last?.bytes || (inp.value ? B.textToBytes(inp.value, encoding.get()) : null);
    if (!bytes) { dataInfo.textContent = pair('Encode or decode something first, or type text in Input.', '請先編碼或者解碼，或者喺輸入度打字。'); return; }
    const mime = mimeSel.value === 'custom' ? customMime.value.trim() : mimeSel.value || (last?.type?.mime) || B.sniff(bytes).mime;
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) { dataInfo.textContent = pair('Type the MIME type as type/subtype, for example image/png.', 'MIME 類型要寫成 type/subtype，例如 image/png。'); return; }
    const url = B.buildDataUrl(mime, B.encode(bytes, { variant: 'std', pad: true }), mime.startsWith('text/') ? { charset: encoding.get() === 'latin1' ? 'ISO-8859-1' : encoding.get().toUpperCase() } : {});
    dataOut.textContent = url;
    dataInfo.textContent = pair(`${mime} · ${fmtBytes(bytes.length)} · ${url.length} characters`, `${mime} · ${fmtBytes(bytes.length)} · ${url.length} 個字元`);
    hist.add({ kind: 'data-url-build', input: { bytes: bytes.length, sha256: sha(bytes) }, output: { chars: url.length, mime }, options: options() });
  };
  const readDataUrl = () => {
    let r;
    try { r = B.dataUrlBytes(dataIn.value.trim(), options()); } catch (e) { dataInfo.textContent = explainFailure(e); return; }
    if (!r) { dataInfo.textContent = pair('That does not start with data:.', '嗰段唔係 data: 開頭。'); return; }
    const params = Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join('; ');
    dataInfo.textContent = pair(`${r.mime}${params ? ` (${params})` : ''} · ${r.base64 ? 'Base64' : pair('percent-encoded', '百分比編碼')} · ${fmtBytes(r.bytes.length)}`, `${r.mime}${params ? `（${params}）` : ''} · ${r.base64 ? 'Base64' : '百分比編碼'} · ${fmtBytes(r.bytes.length)}`);
    showBytes(r.bytes, { mime: r.mime, how: 'data: URL' }, 'data');
    hist.add({ kind: 'data-url-read', input: { chars: dataIn.value.length }, output: { bytes: r.bytes.length, sha256: sha(r.bytes), mime: r.mime }, options: options() });
  };
  const dataCard = h('section.card.span-6', { dataset: { el: 'b64-dataurl' } }, h('div.card-head', h('span.ic', icon('link')), h('h2.h3', pair('data: URLs', 'data: URL'))),
    h('div.stack.tight', h('b.small', pair('Build one from the last result', '用上一個結果建立')), h('div.row', mimeSel, customMime, h('button.btn.small', { type: 'button', on: { click: buildDataUrl } }, icon('add_link'), pair('Build', '建立')), h('button.btn.small.outline', { type: 'button', on: { click: async () => { if (!dataOut.textContent) return; await navigator.clipboard.writeText(dataOut.textContent); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), t('copy')))),
    dataOut,
    h('div.stack.tight', h('b.small', pair('Read one', '讀一個')), dataIn, h('div.row', h('button.btn.small.tonal', { type: 'button', on: { click: readDataUrl } }, icon('manage_search'), pair('Read', '讀取')))),
    dataInfo);
  const previewCard = h('section.card.span-6', h('div.card-head', h('span.ic.alt', icon('preview')), h('h2.h3', pair('Preview', '預覽')), h('span.small.muted', pair('Sandboxed: nothing runs or opens', '沙盒：乜都唔會執行或者打開'))), previewBox,
    h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: saveBytesNow } }, icon('save'), pair('Save these bytes…', '儲存呢啲位元組…'))));

  // ---------- history ----------
  const histList = h('ol.b64-history', { 'aria-label': pair('Conversion history', '轉換紀錄') });
  const undoBtn = h('button.btn.small.tonal', { type: 'button', dataset: { el: 'b64-undo' }, on: { click: () => { const r = hist.undo(); if (r) restore(r.state, r.entry); } } }, icon('undo'), pair('Undo', '還原'));
  const redoBtn = h('button.btn.small.tonal', { type: 'button', dataset: { el: 'b64-redo' }, on: { click: () => { const r = hist.redo(); if (r) restore(r.state, r.entry); } } }, icon('redo'), pair('Redo', '重做'));
  const keep = switchCtl(hist.keepText, { label: pair('Keep text in history', '喺紀錄保留文字') });
  keep.onChange((v) => { hist.setKeepText(v); drawHistory(); });
  const clearHist = h('button.btn.small.text', { type: 'button', on: { click: async (e) => {
    const n = hist.state.log.length;
    if (!n) return;
    if (await superConfirm({ action: pair('Clear the Base64 history', '清除 Base64 紀錄'), affects: pair(`${n} entries and the undo steps go. Files written beside their source stay where they are.`, `${n} 項紀錄同還原步驟會清走。寫喺旁邊嘅檔案會留低。`), anchor: e.currentTarget })) { hist.clear(); drawHistory(); toast(pair('History cleared.', '紀錄已清除。'), { kind: 'ok' }); }
  } } }, icon('delete_sweep'), pair('Clear history…', '清除紀錄…'));
  const KIND = {
    'encode-text': ['lock', pair('Encoded text', '編碼文字')], 'decode-text': ['lock_open', pair('Decoded text', '解碼文字')],
    'encode-file': ['note_add', pair('Encoded a file', '編碼檔案')], 'decode-file': ['restore_page', pair('Decoded a file', '解碼檔案')],
    'data-url-build': ['add_link', pair('Built a data: URL', '建立 data: URL')], 'data-url-read': ['manage_search', pair('Read a data: URL', '讀取 data: URL')]
  };
  function entryTitle(e) { return KIND[e?.kind]?.[1] || e?.kind || ''; }
  function drawHistory() {
    const s = hist.state;
    undoBtn.disabled = !hist.canUndo(); redoBtn.disabled = !hist.canRedo();
    undoBtn.title = pair(`${s.pos + 1} step(s) to undo`, `可以還原 ${s.pos + 1} 步`);
    redoBtn.title = pair(`${s.stack.length - s.pos - 1} step(s) to redo`, `可以重做 ${s.stack.length - s.pos - 1} 步`);
    clear(histList);
    const shown = s.log.slice(-60).reverse();
    if (!shown.length) histList.append(h('li.small.muted', pair('No conversions yet. Each one is listed here by name, size and SHA-256.', '仲未有轉換。每次都會喺度列出名、大細同 SHA-256。')));
    const current = s.stack[s.pos];
    for (const e of shown) {
      const [ic, label] = KIND[e.kind] || ['history', e.kind];
      const io = [e.input?.name, e.output?.name].filter(Boolean).join(' → ');
      const size = e.output?.bytes ?? e.output?.chars;
      const hash = e.output?.sha256 || e.input?.sha256;
      const kept = e.after?.input !== undefined ? pair('text kept', '保留咗文字') : '';
      histList.append(h('li.b64-hist', { dataset: { current: String(e.id === current) } }, h('span.ic', icon(ic)),
        h('div.meta', h('b', label, io ? `: ${io}` : ''), h('span.small.muted', [fmtDateTime(new Date(e.at)), size !== undefined ? (e.output?.bytes !== undefined ? fmtBytes(size) : pair(`${size} characters`, `${size} 個字元`)) : '', hash ? `SHA-256 ${short(hash)}` : '', e.output?.path ? e.output.path : '', e.output?.downloaded ? pair('downloaded', '已下載') : '', kept].filter(Boolean).join(' · '))),
        e.output?.path && !site ? h('button.icon-btn', { type: 'button', 'aria-label': pair(`Show in folder: ${e.output.name}`, `喺資料夾顯示：${e.output.name}`), title: pair('Show in folder', '喺資料夾顯示'), on: { click: () => window.mt.shell.showItem(e.output.path) } }, icon('folder_open')) : null));
    }
    if (s.log.length > shown.length) histList.append(h('li.small.muted', pair(`${s.log.length - shown.length} older entries are kept and still count for undo.`, `仲有 ${s.log.length - shown.length} 項較舊嘅紀錄，還原時照計。`)));
  }
  const offHist = hist.onChange(() => { if (!page.isConnected && pageSeen) { offHist(); return; } if (page.isConnected) pageSeen = true; drawHistory(); });
  const histCard = h('section.card.span-12', { dataset: { el: 'b64-history' } }, h('div.card-head', h('span.ic', icon('history')), h('h2.h3', pair('History', '紀錄'))),
    h('div.row', undoBtn, redoBtn, h('div.switch-row', h('div.txt', h('b', pair('Keep text in history', '喺紀錄保留文字')), h('span.small.muted', pair('Off: entries hold names, sizes and hashes only.', '熄咗：紀錄只有名、大細同雜湊值。'))), keep.el),
      h('div.switch-row', h('div.txt', h('b', pair('Content in JSON records', 'JSON 紀錄包內容')), h('span.small.muted', pair('Off: records describe conversions without the data.', '熄咗：紀錄只描述轉換，唔包資料。'))), includePayload.el), clearHist),
    histList);

  // ---------- page ----------
  let page = null;
  let pageSeen = false;
  syncOptions(); countIn(); countOut(); drawHistory(); showBytes(null);
  // Capture hook: real conversions of sample files made for screenshots (desktop capture runs only).
  window.__mtBase64Demo = async () => {
    const s = await window.mt.b64.samples();
    jobs.clearFinished();
    jobs.start('encode', { path: s.encode }, options());
    jobs.start('decode', { path: s.decode }, options());
    jobs.start('decode', { path: s.broken }, options());
    inp.value = 'Material Tailscale 🧋'; countIn(); encodeText();
    return true;
  };
  page = h('div.page', pageHero(pair('Encoding', '編碼'), t('base64'), site ? pair('Encode and decode text and files in this browser: every Base64 variant, data: URLs, strict error offsets, safe previews and results that download under their own names.', '喺呢個瀏覽器編解碼文字同檔案：各種 Base64 變體、data: URL、嚴格錯誤位置、安全預覽，結果用返原名下載。') : pair('Encode and decode text and files on this device: drop a file to write its Base64 beside it, drop the Base64 to get the original back, all verified by a SHA-256 round trip.', '喺本機編解碼文字同檔案：放低檔案就喺旁邊寫低 Base64，放低 Base64 就還原返原本檔案，全部用 SHA-256 來回驗證。'),
    heroStats([{ value: pair('On this device', '喺本機'), label: pair('nothing is uploaded', '唔會上載'), tone: 'ok' }, { value: 3, label: pair('variants', '變體') }, { value: 4, label: pair('text encodings', '文字編碼') }])),
  h('div.grid', dropTarget('encode'), dropTarget('decode'), jobsCard, optionsCard, ...textCards, dataCard, previewCard, histCard));
  drawJobs(jobs.list);
  return page;
});
