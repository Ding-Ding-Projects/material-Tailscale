'use strict';
// A small ZIP writer for finished files, used where the bundled 7-Zip is not available (the
// website). Entries are stored without compression, names are UTF-8 (general purpose bit 11)
// and every entry carries the CRC-32 its producer computed while writing it, so nothing has to
// be read twice. No ZIP64: the archive stays under 4 GiB and 65,535 entries, which zipParts
// checks. The returned parts (headers as byte arrays, data as given) can go straight into a
// Blob in a browser or be concatenated in Node.

const LIMIT = 0xffffffff;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

/** CRC-32 (IEEE), continued from a previous value so it can run chunk by chunk. */
function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function dos(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.min(2107, Math.max(1980, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

/**
 * entries: [{ name, data, size, crc, date }] where data is a Uint8Array or Blob of `size`
 * bytes whose CRC-32 is `crc`. Returns the parts of a complete archive, in order.
 */
function zipParts(entries) {
  if (entries.length > 0xffff) throw new Error('A ZIP archive without ZIP64 holds at most 65,535 files.');
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const seen = new Set();
  for (const e of entries) {
    const base = String(e.name).replace(/\\/g, '/').replace(/^\/+/, '');
    let name = base;
    for (let n = 1; seen.has(name.toLowerCase()); n++) { const i = base.lastIndexOf('.'); name = i > 0 ? `${base.slice(0, i)} (${n})${base.slice(i)}` : `${base} (${n})`; }
    seen.add(name.toLowerCase());
    const nameBytes = enc.encode(name);
    const { time, date } = dos(e.date);
    if (e.size > LIMIT || offset > LIMIT) throw new Error('This archive would pass 4 GiB, which needs ZIP64; export fewer files at a time.');
    const local = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint16(10, time, true); v.setUint16(12, date, true); v.setUint32(14, e.crc >>> 0, true);
    v.setUint32(18, e.size, true); v.setUint32(22, e.size, true); v.setUint16(26, nameBytes.length, true); v.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    parts.push(local, e.data);
    const cen = new Uint8Array(46 + nameBytes.length);
    const c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, e.crc >>> 0, true); c.setUint32(20, e.size, true); c.setUint32(24, e.size, true);
    c.setUint16(28, nameBytes.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
    c.setUint32(38, 0, true); c.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + e.size;
  }
  const cenSize = central.reduce((s, x) => s + x.length, 0);
  if (offset + cenSize > LIMIT) throw new Error('This archive would pass 4 GiB, which needs ZIP64; export fewer files at a time.');
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, entries.length, true); v.setUint16(10, entries.length, true);
  v.setUint32(12, cenSize, true); v.setUint32(16, offset, true);
  return [...parts, ...central, end];
}

module.exports = { crc32, zipParts };
