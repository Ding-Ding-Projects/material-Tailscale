'use strict';
// Local version history backed by Git (isomorphic-git), kept in its own
// folder beside the app data. Every settings change, preference apply and
// admin write is a commit; restoring creates a new commit so history is
// append-only. Credentials are never written here.
const fs = require('node:fs');
const path = require('node:path');
const git = require('isomorphic-git');
const { app } = require('electron');

const dir = () => path.join(app.getPath('userData'), 'history');
const author = { name: 'Material Tailscale', email: 'history@localhost' };
let ready = null;

async function init() {
  if (ready) return ready;
  ready = (async () => {
    fs.mkdirSync(dir(), { recursive: true });
    if (!fs.existsSync(path.join(dir(), '.git'))) await git.init({ fs, dir: dir(), defaultBranch: 'main' });
  })();
  return ready;
}

function safeName(n) {
  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(n)) throw new Error(`Bad history file name: ${n}`);
  return n;
}

async function record(message, files) {
  await init();
  for (const [name, content] of Object.entries(files)) {
    const f = safeName(name);
    fs.writeFileSync(path.join(dir(), f), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    await git.add({ fs, dir: dir(), filepath: f });
  }
  const status = await git.statusMatrix({ fs, dir: dir() });
  if (!status.some(([, h, w, s]) => h !== w || w !== s)) return null;
  return git.commit({ fs, dir: dir(), message: String(message).slice(0, 500), author });
}

async function list(limit = 200) {
  await init();
  try {
    const log = await git.log({ fs, dir: dir(), depth: limit });
    return log.map((e) => ({ oid: e.oid, message: e.commit.message.trim(), time: e.commit.author.timestamp * 1000 }));
  } catch { return []; }
}

async function files(oid) {
  await init();
  const out = {};
  const tree = await git.readTree({ fs, dir: dir(), oid });
  for (const e of tree.tree) {
    if (e.type !== 'blob') continue;
    const { blob } = await git.readBlob({ fs, dir: dir(), oid, filepath: e.path });
    out[e.path] = Buffer.from(blob).toString('utf8');
  }
  return out;
}

async function restore(oid) {
  const content = await files(oid);
  const commit = await record(`Restore ${oid.slice(0, 7)}`, content);
  return { content, commit };
}

module.exports = { record, list, files, restore, dir };
