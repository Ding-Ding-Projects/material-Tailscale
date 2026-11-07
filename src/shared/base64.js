'use strict';
// The Base64 toolkit's core, shared by the main process (files converted beside their source)
// and the renderer (text, previews and the website's downloads). Pure functions only: no file
// system and no network. The streaming encoder and decoder keep memory constant for any size.
//
// Every function takes the same options object:
//   variant     'std'  RFC 4648 section 4, 'url'  RFC 4648 section 5 (Base64url),
//               'mime' the standard alphabet in 76-character lines joined by CRLF (RFC 2045)
//   pad         write '=' padding when encoding; strict decoding then requires it
//   lineLength  0 for one line, or the length of each wrapped line (MIME is always 76)
//   eol         '\r\n' or '\n' between wrapped lines (MIME is always '\r\n')
//   strict      strict decoding accepts only the chosen alphabet, padding exactly as chosen, and
//               line breaks only between wrapped lines and at the very end of the input;
//               lenient decoding skips whitespace anywhere, accepts both alphabets and missing
//               padding, and reads padded blocks written one after another.

const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function options(o = {}) {
  const variant = o.variant === 'url' || o.variant === 'mime' ? o.variant : 'std';
  const mime = variant === 'mime';
  let lineLength = mime ? 76 : Math.floor(Number(o.lineLength) || 0);
  if (!(lineLength > 0)) lineLength = 0;
  else lineLength = Math.min(1e6, Math.max(4, lineLength));
  return {
    variant,
    pad: mime ? true : o.pad !== false,
    lineLength,
    eol: mime ? '\r\n' : o.eol === '\n' ? '\n' : '\r\n',
    strict: o.strict !== false
  };
}

// ---------------- encoding ----------------

/** Standard alphabet with padding, using the platform's native encoder. */
function rawEncode(bytes) {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** A streaming encoder: push byte chunks of any size, then end(). Line breaks never trail. */
function createEncoder(opts) {
  const o = options(opts);
  let carry = new Uint8Array(0);
  let col = 0;
  let chars = 0;
  const shape = (s) => {
    if (o.variant === 'url') s = s.replace(/\+/g, '-').replace(/\//g, '_');
    if (!o.pad) s = s.replace(/=+$/, '');
    chars += s.length;
    if (!o.lineLength) return s;
    let out = '';
    for (let i = 0; i < s.length;) {
      if (col === o.lineLength) { out += o.eol; col = 0; }
      const n = Math.min(o.lineLength - col, s.length - i);
      out += s.slice(i, i + n); col += n; i += n;
    }
    return out;
  };
  return {
    options: o,
    push(bytes) {
      let b = bytes;
      if (carry.length) { const m = new Uint8Array(carry.length + b.length); m.set(carry); m.set(b, carry.length); b = m; }
      const whole = b.length - (b.length % 3);
      carry = new Uint8Array(b.subarray(whole)); // a copy: callers may reuse their buffer
      return whole ? shape(rawEncode(b.subarray(0, whole))) : '';
    },
    end() { const b = carry; carry = new Uint8Array(0); return b.length ? shape(rawEncode(b)) : ''; },
    /** Base64 characters written so far, line breaks not counted. */
    get chars() { return chars; }
  };
}

function encode(bytes, opts) { const e = createEncoder(opts); return e.push(bytes) + e.end(); }

// ---------------- decoding ----------------

const REASONS = {
  'invalid-char': (off, ch) => `Character ${describeChar(ch)} at offset ${off} is not Base64.`,
  'wrong-padding': (off, why) => ({
    missing: `Padding is missing at the end (offset ${off}).`,
    unexpected: `Padding '=' at offset ${off} is not allowed when padding is off.`,
    misplaced: `Padding '=' at offset ${off} is in the wrong place.`,
    'too-many': `Too many '=' at offset ${off}.`,
    'data-after': `Base64 continues after the padding at offset ${off}.`
  }[why] || `Wrong padding at offset ${off}.`),
  truncated: (off) => `The Base64 ends with a single character at offset ${off}, which cannot hold a byte.`,
  empty: () => 'There is no Base64 to decode.',
  'data-url': (off, why) => why === 'not-base64' ? 'This data: URL is not Base64 (it has no ;base64 marker).' : `The data: URL header has no comma (offset ${off}).`
};

function describeChar(ch) {
  if (ch === undefined) return 'that';
  const cp = ch.codePointAt(0);
  const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  const names = { 0x20: 'space', 0x09: 'tab', 0x0a: 'line feed', 0x0d: 'carriage return', 0x0c: 'form feed', 0x0b: 'vertical tab', 0xa0: 'no-break space', 0xfeff: 'byte-order mark' };
  return names[cp] ? `${hex} (${names[cp]})` : cp < 0x20 || cp === 0x7f ? hex : `'${ch}' (${hex})`;
}

/** A decoding problem with a machine-readable code and the exact character offset. */
class Base64Error extends Error {
  constructor(code, offset = 0, detail) {
    super((REASONS[code] || (() => 'Base64 could not be decoded.'))(offset, detail));
    this.name = 'Base64Error';
    this.code = code;
    this.offset = offset;
    this.detail = detail;
  }
}

const DATA = 0, PAD = -2, SPACE = -3, BREAK = -4, BAD = -1;
function table(which) {
  const t = new Int8Array(128).fill(BAD);
  const set = (alpha) => { for (let i = 0; i < 64; i++) t[alpha.charCodeAt(i)] = i; };
  if (which !== 'url') set(STD);
  if (which !== 'std') set(URLSAFE);
  t[61] = PAD; t[32] = SPACE; t[9] = SPACE; t[12] = SPACE; t[11] = SPACE; t[10] = BREAK; t[13] = BREAK;
  return t;
}
const TABLES = { std: table('std'), url: table('url'), both: table('both') };

/**
 * A streaming decoder. push(text) returns the bytes decoded so far, end() the rest; both throw
 * Base64Error with the offset of the first problem, counted over everything pushed.
 */
function createDecoder(opts, { startOffset = 0 } = {}) {
  const o = options(opts);
  const T = o.strict ? (o.variant === 'url' ? TABLES.url : TABLES.std) : TABLES.both;
  const wrapped = o.lineLength > 0;
  let offset = startOffset;
  let acc = 0, n = 0;          // bits of the current quantum and how many characters it holds
  let pads = 0, need = 0;      // '=' seen in the closing quantum and how many it needs
  let closed = false;          // a padded quantum ended; only line breaks (strict) may follow
  let breakAt = -1, breakChar; // strict, unwrapped: the first line break, allowed only at the end
  let dataChars = 0;
  let lastData = -1;
  const flush = (out, k) => {
    if (n === 2) out[k++] = (acc >> 4) & 0xff;
    else if (n === 3) { out[k++] = (acc >> 10) & 0xff; out[k++] = (acc >> 2) & 0xff; }
    acc = 0; n = 0;
    return k;
  };
  return {
    options: o,
    push(text) {
      const out = new Uint8Array(Math.ceil(text.length * 3 / 4) + 3);
      let k = 0;
      for (let i = 0; i < text.length; i++, offset++) {
        const c = text.charCodeAt(i);
        const v = c < 128 ? T[c] : BAD;
        if (v >= DATA) {
          if (o.strict && breakAt >= 0) throw new Base64Error('invalid-char', breakAt, breakChar);
          if (closed || pads) {
            if (o.strict) throw new Base64Error('wrong-padding', offset, 'data-after');
            closed = false; pads = 0; need = 0; // lenient: another padded block follows
          }
          acc = (acc << 6) | v; n++; dataChars++; lastData = offset;
          if (n === 4) { out[k++] = (acc >> 16) & 0xff; out[k++] = (acc >> 8) & 0xff; out[k++] = acc & 0xff; acc = 0; n = 0; }
        } else if (v === PAD) {
          if (o.strict && breakAt >= 0) throw new Base64Error('invalid-char', breakAt, breakChar);
          if (o.strict && !o.pad) throw new Base64Error('wrong-padding', offset, 'unexpected');
          if (closed) {
            if (o.strict) throw new Base64Error('wrong-padding', offset, 'too-many');
            continue; // lenient: extra padding after a finished quantum is ignored
          }
          if (!pads) {
            if (n === 1) throw new Base64Error('truncated', lastData);
            if (n === 0) { if (o.strict) throw new Base64Error('wrong-padding', offset, 'misplaced'); continue; }
            need = 4 - n;
            k = flush(out, k);
          }
          pads++;
          if (pads === need) { closed = true; pads = 0; }
        } else if (v === BREAK) {
          if (o.strict && !wrapped && breakAt < 0) { breakAt = offset; breakChar = text[i]; }
        } else if (v === SPACE) {
          if (o.strict) throw new Base64Error('invalid-char', offset, text[i]);
        } else {
          const ch = String.fromCodePoint(text.codePointAt(i));
          throw new Base64Error('invalid-char', offset, ch);
        }
      }
      return out.subarray(0, k);
    },
    end() {
      const out = new Uint8Array(3);
      let k = 0;
      if (pads && !closed) {
        if (o.strict) throw new Base64Error('wrong-padding', offset, 'missing');
        pads = 0; // lenient: a short run of padding at the end is fine
      }
      if (n === 1) throw new Base64Error('truncated', lastData);
      if (n > 1) {
        if (o.strict && o.pad) throw new Base64Error('wrong-padding', offset, 'missing');
        k = flush(out, k);
      }
      if (!dataChars) throw new Base64Error('empty', 0);
      return out.subarray(0, k);
    },
    get offset() { return offset; }
  };
}

function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Decodes a whole string, data: URLs included. Returns { bytes, dataUrl }. */
function decode(text, opts) {
  const d = createDataAwareDecoder(opts);
  const bytes = concat([d.push(text), d.end()]);
  return { bytes, dataUrl: d.dataUrl };
}

// ---------------- data: URLs ----------------

function parseDataUrlHeader(header) {
  const parts = header.split(';');
  let mime = (parts.shift() || '').trim().toLowerCase();
  const params = {};
  let base64 = false;
  for (const p of parts) {
    const s = p.trim();
    if (s.toLowerCase() === 'base64') { base64 = true; continue; }
    const i = s.indexOf('=');
    if (i > 0) { let v = s.slice(i + 1).trim(); try { v = decodeURIComponent(v); } catch { /* keep as written */ } params[s.slice(0, i).trim().toLowerCase()] = v; }
  }
  if (!mime) mime = 'text/plain';
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)) mime = 'application/octet-stream';
  if (mime === 'text/plain' && !params.charset && !header.trim().toLowerCase().startsWith('text/plain')) params.charset = 'US-ASCII';
  return { mime, params, base64 };
}

/** Splits a complete data: URL into its header and payload; null when the text is not one. */
function parseDataUrl(text) {
  const lead = text.length - text.trimStart().length;
  if (!/^data:/i.test(text.slice(lead, lead + 5))) return null;
  const comma = text.indexOf(',', lead);
  if (comma < 0) throw new Base64Error('data-url', text.length, 'no-comma');
  const info = parseDataUrlHeader(text.slice(lead + 5, comma));
  return { ...info, payloadOffset: comma + 1, payload: text.slice(comma + 1) };
}

/** Bytes of a data: URL, Base64 or percent-encoded. */
function dataUrlBytes(text, opts) {
  const p = parseDataUrl(text);
  if (!p) return null;
  if (p.base64) {
    const d = createDecoder(opts, { startOffset: p.payloadOffset });
    return { ...p, bytes: concat([d.push(p.payload), d.end()]) };
  }
  const bytes = [];
  const s = p.payload;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '%' && /^[0-9a-f]{2}$/i.test(s.slice(i + 1, i + 3))) { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else for (const b of new TextEncoder().encode(s[i])) bytes.push(b);
  }
  return { ...p, bytes: Uint8Array.from(bytes) };
}

function buildDataUrl(mime, base64, params = {}) {
  const extra = Object.entries(params).filter(([k, v]) => k && v !== undefined && v !== '').map(([k, v]) => `;${k}=${encodeURIComponent(String(v))}`).join('');
  return `data:${mime || 'application/octet-stream'}${extra};base64,${base64.replace(/[\r\n]/g, '')}`;
}

/**
 * A streaming decoder that also reads a leading data: URL header, so a text file holding
 * "data:image/png;base64,..." decodes like plain Base64. After the first push, `dataUrl`
 * holds { mime, params } or null. Offsets in errors count from the start of the text.
 */
function createDataAwareDecoder(opts) {
  let head = '';
  let inner = null;
  let info = null;
  let decided = false;
  const start = (text) => {
    head += text;
    const lead = head.length - head.trimStart().length;
    const probe = head.slice(lead, lead + 5);
    if (probe.length < 5 && 'data:'.startsWith(probe.toLowerCase())) return null; // could still become "data:"
    if (!/^data:/i.test(probe)) { decided = true; inner = createDecoder(opts); const t = head; head = ''; return inner.push(t); }
    const comma = head.indexOf(',', lead);
    if (comma < 0) { if (head.length > 4096) throw new Base64Error('data-url', head.length, 'no-comma'); return null; }
    const parsed = parseDataUrlHeader(head.slice(lead + 5, comma));
    if (!parsed.base64) throw new Base64Error('data-url', 0, 'not-base64');
    info = { mime: parsed.mime, params: parsed.params };
    decided = true;
    inner = createDecoder(opts, { startOffset: comma + 1 });
    const rest = head.slice(comma + 1); head = '';
    return inner.push(rest);
  };
  return {
    push(text) { if (decided) return inner.push(text); return start(text) || new Uint8Array(0); },
    end() {
      if (!decided) { decided = true; inner = createDecoder(opts); const t = head; head = ''; const a = inner.push(t); return concat([a, inner.end()]); }
      return inner.end();
    },
    get dataUrl() { return info; }
  };
}

// ---------------- file types ----------------

// MIME type and the extension a restored file gets. The first entry for a type wins.
const TYPES = [
  ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/gif', 'gif'], ['image/webp', 'webp'], ['image/avif', 'avif'], ['image/heic', 'heic'],
  ['image/bmp', 'bmp'], ['image/x-icon', 'ico'], ['image/vnd.microsoft.icon', 'ico'], ['image/svg+xml', 'svg'], ['image/tiff', 'tif'],
  ['application/pdf', 'pdf'], ['application/zip', 'zip'], ['application/gzip', 'gz'], ['application/x-gzip', 'gz'], ['application/x-7z-compressed', '7z'],
  ['application/vnd.rar', 'rar'], ['application/x-rar-compressed', 'rar'], ['application/x-bzip2', 'bz2'], ['application/x-xz', 'xz'], ['application/x-tar', 'tar'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'], ['application/epub+zip', 'epub'], ['application/java-archive', 'jar'],
  ['application/vnd.android.package-archive', 'apk'], ['application/json', 'json'], ['application/xml', 'xml'], ['text/xml', 'xml'], ['text/html', 'html'],
  ['text/css', 'css'], ['text/csv', 'csv'], ['text/markdown', 'md'], ['text/javascript', 'js'], ['application/javascript', 'js'], ['text/calendar', 'ics'],
  ['text/vcard', 'vcf'], ['application/x-pem-file', 'pem'], ['application/postscript', 'ps'], ['text/plain', 'txt'],
  ['audio/mpeg', 'mp3'], ['audio/wav', 'wav'], ['audio/x-wav', 'wav'], ['audio/ogg', 'ogg'], ['audio/flac', 'flac'], ['audio/mp4', 'm4a'], ['audio/aac', 'aac'], ['audio/webm', 'weba'],
  ['video/mp4', 'mp4'], ['video/webm', 'webm'], ['video/quicktime', 'mov'], ['video/x-matroska', 'mkv'], ['video/x-msvideo', 'avi'], ['video/ogg', 'ogv'],
  ['application/wasm', 'wasm'], ['font/woff2', 'woff2'], ['font/woff', 'woff'], ['font/ttf', 'ttf'], ['font/otf', 'otf'],
  ['application/vnd.microsoft.portable-executable', 'exe'], ['application/x-msdownload', 'exe'], ['application/java-vm', 'class'], ['application/vnd.sqlite3', 'sqlite'],
  ['application/octet-stream', 'bin']
];
const EXT_OF = new Map();
const MIME_OF = new Map();
for (const [m, e] of TYPES) { if (!EXT_OF.has(m)) EXT_OF.set(m, e); if (!MIME_OF.has(e)) MIME_OF.set(e, m); }
MIME_OF.set('jpeg', 'image/jpeg'); MIME_OF.set('htm', 'text/html'); MIME_OF.set('tiff', 'image/tiff'); MIME_OF.set('markdown', 'text/markdown'); MIME_OF.set('b64', 'text/plain');

const extForMime = (mime) => EXT_OF.get(String(mime || '').toLowerCase().split(';')[0].trim()) || null;
const mimeForExt = (ext) => MIME_OF.get(String(ext || '').toLowerCase().replace(/^\./, '')) || 'application/octet-stream';

const SNIFF_WINDOW = 4096;

/** Bounded byte-signature inspection: looks at no more than the first 4,096 bytes. */
function sniff(bytes) {
  const b = bytes.subarray(0, SNIFF_WINDOW);
  const is = (off, ...sig) => b.length >= off + sig.length && sig.every((x, i) => b[off + i] === x);
  const ascii = (off, s) => b.length >= off + s.length && [...s].every((c, i) => b[off + i] === c.charCodeAt(0));
  const has = (s) => { const t = latin1(b); return t.includes(s); };
  const T = (mime, how) => ({ mime, ext: extForMime(mime) || 'bin', how });
  if (is(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return T('image/png', 'PNG signature');
  if (is(0, 0xff, 0xd8, 0xff)) return T('image/jpeg', 'JPEG signature');
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return T('image/gif', 'GIF signature');
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return T('image/webp', 'RIFF WEBP');
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return T('audio/wav', 'RIFF WAVE');
  if (ascii(0, 'RIFF') && ascii(8, 'AVI ')) return T('video/x-msvideo', 'RIFF AVI');
  if (ascii(0, '%PDF-')) return T('application/pdf', 'PDF header');
  if (is(0, 0x50, 0x4b, 0x03, 0x04) || is(0, 0x50, 0x4b, 0x05, 0x06)) {
    if (ascii(30, 'mimetypeapplication/epub+zip')) return T('application/epub+zip', 'ZIP holding an EPUB');
    if (has('word/')) return T('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'ZIP holding word/');
    if (has('xl/')) return T('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'ZIP holding xl/');
    if (has('ppt/')) return T('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'ZIP holding ppt/');
    if (has('AndroidManifest.xml')) return T('application/vnd.android.package-archive', 'ZIP holding AndroidManifest.xml');
    if (has('META-INF/MANIFEST.MF')) return T('application/java-archive', 'ZIP holding META-INF/MANIFEST.MF');
    return T('application/zip', 'ZIP signature');
  }
  if (is(0, 0x1f, 0x8b)) return T('application/gzip', 'gzip signature');
  if (is(0, 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return T('application/x-7z-compressed', '7z signature');
  if (ascii(0, 'Rar!')) return T('application/vnd.rar', 'RAR signature');
  if (is(0, 0x42, 0x5a, 0x68)) return T('application/x-bzip2', 'bzip2 signature');
  if (is(0, 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)) return T('application/x-xz', 'xz signature');
  if (ascii(257, 'ustar')) return T('application/x-tar', 'tar header');
  if (ascii(0, 'ID3') || (b[0] === 0xff && (b[1] === 0xfb || b[1] === 0xf3 || b[1] === 0xf2))) return T('audio/mpeg', 'MP3 frame or ID3 tag');
  if (b[0] === 0xff && (b[1] === 0xf1 || b[1] === 0xf9)) return T('audio/aac', 'AAC ADTS frame');
  if (ascii(0, 'OggS')) return T('audio/ogg', 'Ogg page');
  if (ascii(0, 'fLaC')) return T('audio/flac', 'FLAC signature');
  if (ascii(4, 'ftyp')) {
    const brand = latin1(b.subarray(8, 12));
    if (brand === 'M4A ' || brand === 'M4B ') return T('audio/mp4', `ISO media brand ${brand.trim()}`);
    if (brand === 'qt  ') return T('video/quicktime', 'QuickTime brand');
    if (brand === 'avif' || brand === 'avis') return T('image/avif', 'AVIF brand');
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return T('image/heic', 'HEIF brand');
    return T('video/mp4', `ISO media brand ${brand.trim()}`);
  }
  if (is(0, 0x1a, 0x45, 0xdf, 0xa3)) return has('webm') ? T('video/webm', 'Matroska header, WebM doc type') : T('video/x-matroska', 'Matroska header');
  if (is(0, 0x00, 0x61, 0x73, 0x6d)) return T('application/wasm', 'WebAssembly magic');
  if (ascii(0, 'wOF2')) return T('font/woff2', 'WOFF2 signature');
  if (ascii(0, 'wOFF')) return T('font/woff', 'WOFF signature');
  if (ascii(0, 'OTTO')) return T('font/otf', 'OpenType signature');
  if (ascii(0, 'MZ')) return T('application/vnd.microsoft.portable-executable', 'MZ header');
  if (is(0, 0xca, 0xfe, 0xba, 0xbe)) return T('application/java-vm', 'Java class magic');
  if (ascii(0, 'SQLite format 3')) return T('application/vnd.sqlite3', 'SQLite header');
  if (ascii(0, 'BM') && is(6, 0, 0, 0, 0)) return T('image/bmp', 'BMP header');
  if (is(0, 0x00, 0x00, 0x01, 0x00) && b.length > 6 && b[4] > 0) return T('image/x-icon', 'ICO header');
  if (is(0, 0x49, 0x49, 0x2a, 0x00) || is(0, 0x4d, 0x4d, 0x00, 0x2a)) return T('image/tiff', 'TIFF header');
  if (is(0, 0xff, 0xfe) || is(0, 0xfe, 0xff)) return T('text/plain', 'UTF-16 byte-order mark');
  const text = utf8Text(b, bytes.length > SNIFF_WINDOW);
  if (text !== null) {
    const s = text.replace(/^﻿/, '').trimStart();
    const low = s.slice(0, 512).toLowerCase();
    if (low.startsWith('<?xml')) return low.includes('<svg') ? T('image/svg+xml', 'XML with an svg root') : T('application/xml', 'XML declaration');
    if (low.startsWith('<svg')) return T('image/svg+xml', 'svg element');
    if (low.startsWith('<!doctype html') || low.startsWith('<html')) return T('text/html', 'HTML document');
    if (s.startsWith('{') || s.startsWith('[')) return T('application/json', 'JSON (by its first character)');
    if (s.startsWith('%!PS')) return T('application/postscript', 'PostScript header');
    if (s.startsWith('BEGIN:VCALENDAR')) return T('text/calendar', 'iCalendar header');
    if (s.startsWith('BEGIN:VCARD')) return T('text/vcard', 'vCard header');
    if (s.startsWith('-----BEGIN ')) return T('application/x-pem-file', 'PEM armour');
    return T('text/plain', 'readable UTF-8 text');
  }
  return T('application/octet-stream', 'no known signature');
}

function latin1(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }

/** The window as text when it is valid UTF-8 with no control bytes besides tab and line breaks. */
function utf8Text(b, cut) {
  if (!b.length) return '';
  let end = b.length;
  if (cut) { let i = end - 1, back = 0; while (i >= 0 && back < 4 && (b[i] & 0xc0) === 0x80) { i--; back++; } if (i >= 0 && b[i] >= 0xc0) end = i; }
  let s;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, end)); } catch { return null; }
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if ((c < 0x20 && c !== 9 && c !== 10 && c !== 13 && c !== 12) || c === 0x7f) return null; }
  return s;
}

// ---------------- file names ----------------

/** Name of the Base64 text written beside a source file: the full name plus .base64.txt. */
const encodedName = (name) => `${name}.base64.txt`;

/** "report.pdf" -> ["report", ".pdf"]; a leading dot is part of the stem. */
function splitExt(name) { const i = name.lastIndexOf('.'); return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, '']; }

/** The nth alternative when a name is taken: "report.pdf" -> "report (1).pdf". */
function numbered(name, n) { if (!n) return name; const [stem, ext] = splitExt(name); return `${stem} (${n})${ext}`; }

/**
 * The original name a Base64 text file carries. "report.pdf.base64.txt" and
 * "report.pdf.base64 (2).txt" are written by the encoder and give "report.pdf" exactly, even
 * without an extension. ".b64", ".b64.txt" and ".base64" names give the name before them.
 */
function originalFromName(name) {
  let m = /^(.+)\.base64(?: \(\d+\))?\.txt$/i.exec(name);
  if (m) return { name: m[1], exact: true };
  m = /^(.+)\.(?:b64|base64)(?: \(\d+\))?(?:\.txt)?$/i.exec(name);
  if (m) return { name: m[1], exact: false };
  return null;
}

/**
 * The name a decoded file gets beside its Base64 text: the name pattern first, then the data:
 * MIME type, then the byte signature, and .bin only as the last resort. `source` says which.
 */
function restoredName(textName, { dataMime, sniffed } = {}) {
  const fromName = originalFromName(textName);
  if (fromName && (fromName.exact || splitExt(fromName.name)[1])) return { name: fromName.name, source: 'name' };
  const stem = fromName ? fromName.name : splitExt(textName)[0] || 'decoded';
  const dataExt = dataMime && extForMime(dataMime);
  if (dataExt && dataExt !== 'bin') return { name: `${stem}.${dataExt}`, source: 'data-url' };
  if (sniffed && sniffed.ext && sniffed.ext !== 'bin') return { name: `${stem}.${sniffed.ext}`, source: 'signature' };
  return { name: `${stem}.bin`, source: 'fallback' };
}

/** A name that is safe to create in a folder on Windows, macOS and Linux. */
function safeName(name) {
  let s = String(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/, '');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)) s = '_' + s;
  return s.slice(0, 240) || 'decoded';
}

// ---------------- SHA-256 (incremental, for browsers; Node uses its own) ----------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function createSha256() {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const buf = new Uint8Array(64);
  let used = 0, total = 0;
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function block(p, off) {
    for (let i = 0; i < 16; i++) W[i] = (p[off + i * 4] << 24) | (p[off + i * 4 + 1] << 16) | (p[off + i * 4 + 2] << 8) | p[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (W[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return {
    update(bytes) {
      let i = 0;
      total += bytes.length;
      if (used) { const n = Math.min(64 - used, bytes.length); buf.set(bytes.subarray(0, n), used); used += n; i = n; if (used === 64) { block(buf, 0); used = 0; } }
      for (; i + 64 <= bytes.length; i += 64) block(bytes, i);
      if (i < bytes.length) { buf.set(bytes.subarray(i), 0); used = bytes.length - i; }
      return this;
    },
    hex() {
      const bits = total * 8;
      const tail = new Uint8Array(((used + 9 + 63) >> 6) << 6);
      tail.set(buf.subarray(0, used));
      tail[used] = 0x80;
      const hi = Math.floor(bits / 0x100000000), lo = bits >>> 0;
      const n = tail.length;
      tail[n - 8] = hi >>> 24; tail[n - 7] = hi >>> 16; tail[n - 6] = hi >>> 8; tail[n - 5] = hi;
      tail[n - 4] = lo >>> 24; tail[n - 3] = lo >>> 16; tail[n - 2] = lo >>> 8; tail[n - 1] = lo;
      for (let o = 0; o < n; o += 64) block(tail, o);
      return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
    }
  };
}

/** Text in a chosen character encoding, as bytes; the same set the toolkit offers. */
function textToBytes(s, encoding = 'utf-8') {
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    const b = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); const [x, y] = encoding === 'utf-16le' ? [c & 255, c >> 8] : [c >> 8, c & 255]; b[i * 2] = x; b[i * 2 + 1] = y; }
    return b;
  }
  if (encoding === 'latin1') {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 255) throw Object.assign(new Error(`Character ${describeChar(s[i])} at offset ${i} cannot be written in Latin-1.`), { code: 'unsupported-encoding', offset: i }); b[i] = c; }
    return b;
  }
  return new TextEncoder().encode(s);
}

/** Bytes as text in a chosen encoding; fatal, so undecodable bytes are reported, not replaced. */
function bytesToText(b, encoding = 'utf-8') {
  const label = encoding === 'latin1' ? 'iso-8859-1' : encoding;
  if (encoding === 'latin1') return latin1(b);
  try { return new TextDecoder(label, { fatal: true }).decode(b); } catch {
    throw Object.assign(new Error(`These bytes are not valid ${encoding.toUpperCase()} text.`), { code: 'unsupported-encoding' });
  }
}

module.exports = {
  STD, URLSAFE, options, createEncoder, encode, createDecoder, createDataAwareDecoder, decode, Base64Error, describeChar,
  parseDataUrl, dataUrlBytes, buildDataUrl, TYPES, extForMime, mimeForExt, sniff, SNIFF_WINDOW,
  encodedName, splitExt, numbered, originalFromName, restoredName, safeName, createSha256, textToBytes, bytesToText
};
