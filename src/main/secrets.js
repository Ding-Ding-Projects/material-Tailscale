'use strict';
// Credentials are encrypted with the operating system's keychain-backed
// safeStorage and kept in the app data folder. Values are never sent to the
// renderer; it only learns whether a credential is present.
const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const file = () => path.join(app.getPath('userData'), 'vault.json');

function load() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; }
}

function save(data) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(data), { mode: 0o600 });
}

function available() { return safeStorage.isEncryptionAvailable(); }

function set(name, obj) {
  if (!available()) throw new Error('This computer has no secure credential storage available, so nothing was saved.');
  const data = load();
  data[name] = safeStorage.encryptString(JSON.stringify(obj)).toString('base64');
  save(data);
}

function get(name) {
  const data = load();
  if (!data[name]) return null;
  try { return JSON.parse(safeStorage.decryptString(Buffer.from(data[name], 'base64'))); } catch { return null; }
}

function presence(name) {
  const v = get(name);
  if (!v) return { present: false };
  const { value, ...meta } = v;
  return { present: true, ...meta, hint: value ? `…${String(value).slice(-4)}` : undefined };
}

function clear(name) {
  const data = load();
  delete data[name];
  save(data);
}

function names() { return Object.keys(load()); }

module.exports = { set, get, presence, clear, names, available };
