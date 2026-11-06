'use strict';
// RFC 4226 HOTP and RFC 6238 TOTP with SHA-1, SHA-256 and SHA-512, 6 to 8
// digits and any period. Works in Node (main process) and in the browser
// renderer through the async WebCrypto path.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const s = String(input).toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!/^[A-Z2-7]*$/.test(s)) throw new Error('The secret is not valid base32 (letters A-Z and digits 2-7).');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function counterBytes(counter) {
  const buf = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { buf[i] = Number(c & 255n); c >>= 8n; }
  return buf;
}

function truncate(mac, digits) {
  const off = mac[mac.length - 1] & 15;
  const bin = ((mac[off] & 127) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

const ALGOS = { SHA1: 'sha1', SHA256: 'sha256', SHA512: 'sha512' };

function hotpSync(keyBytes, counter, { algorithm = 'SHA1', digits = 6 } = {}) {
  const crypto = require('node:crypto');
  const mac = crypto.createHmac(ALGOS[algorithm] || 'sha1', Buffer.from(keyBytes)).update(Buffer.from(counterBytes(counter))).digest();
  return truncate(mac, digits);
}

async function hotp(keyBytes, counter, { algorithm = 'SHA1', digits = 6 } = {}) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return hotpSync(keyBytes, counter, { algorithm, digits });
  const name = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' }[algorithm] || 'SHA-1';
  const key = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: name }, false, ['sign']);
  return truncate(new Uint8Array(await subtle.sign('HMAC', key, counterBytes(counter))), digits);
}

function totpSync(secret, { algorithm = 'SHA1', digits = 6, period = 30, time = Date.now() } = {}) {
  return hotpSync(base32Decode(secret), Math.floor(time / 1000 / period), { algorithm, digits });
}

async function totp(secret, { algorithm = 'SHA1', digits = 6, period = 30, time = Date.now() } = {}) {
  return hotp(base32Decode(secret), Math.floor(time / 1000 / period), { algorithm, digits });
}

function verify(secret, code, opts = {}) {
  const period = opts.period || 30;
  for (const drift of [-1, 0, 1]) {
    if (totpSync(secret, { ...opts, time: Date.now() + drift * period * 1000 }) === String(code).trim()) return true;
  }
  return false;
}

async function verifyAsync(secret, code, opts = {}) {
  const period = opts.period || 30;
  for (const drift of [-1, 0, 1]) {
    if ((await totp(secret, { ...opts, time: Date.now() + drift * period * 1000 })) === String(code).trim()) return true;
  }
  return false;
}

function parseUri(uri) {
  const u = new URL(uri);
  if (u.protocol !== 'otpauth:') throw new Error('Not an otpauth:// link.');
  const type = u.hostname;
  if (type !== 'totp') throw new Error('Only time-based (totp) codes are supported.');
  const label = decodeURIComponent(u.pathname.replace(/^\//, ''));
  const [issuerFromLabel, account] = label.includes(':') ? label.split(':') : ['', label];
  const p = u.searchParams;
  const secret = p.get('secret');
  if (!secret) throw new Error('The link has no secret.');
  base32Decode(secret);
  const algorithm = (p.get('algorithm') || 'SHA1').toUpperCase();
  if (!ALGOS[algorithm]) throw new Error(`Unsupported algorithm ${algorithm}.`);
  const digits = Number(p.get('digits') || 6);
  if (digits < 6 || digits > 8) throw new Error('Digits must be 6, 7 or 8.');
  const period = Number(p.get('period') || 30);
  if (!(period > 0 && period <= 3600)) throw new Error('Period must be between 1 and 3600 seconds.');
  return { issuer: p.get('issuer') || issuerFromLabel, account: account.trim(), secret: secret.toUpperCase(), algorithm, digits, period };
}

function buildUri({ issuer, account, secret, algorithm = 'SHA1', digits = 6, period = 30 }) {
  const label = encodeURIComponent(issuer ? `${issuer}:${account}` : account);
  const q = new URLSearchParams({ secret, algorithm, digits: String(digits), period: String(period) });
  if (issuer) q.set('issuer', issuer);
  return `otpauth://totp/${label}?${q}`;
}

function randomSecret(bytes = 20) {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return base32Encode(b);
}

module.exports = { base32Decode, base32Encode, hotp, hotpSync, totp, totpSync, verify, verifyAsync, parseUri, buildUri, randomSecret };
