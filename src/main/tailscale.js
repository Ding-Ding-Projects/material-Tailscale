'use strict';
// Runs the tailscale CLI. Arguments come only from the catalogue builder or
// from the raw console (an explicit argv array the person typed). Nothing is
// ever passed through a shell.
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildArgs, findCommand } = require('../shared/cli-catalog');

const CANDIDATES = {
  win32: [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Tailscale', 'tailscale.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Tailscale', 'tailscale.exe')
  ],
  darwin: ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale'],
  linux: ['/usr/bin/tailscale', '/usr/local/bin/tailscale', '/usr/sbin/tailscale', '/snap/bin/tailscale']
};

let override = null;
const searched = [];

function setOverride(p) { override = p || null; }

function onPath() {
  const exe = process.platform === 'win32' ? 'tailscale.exe' : 'tailscale';
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, exe);
    searched.push(full);
    try { fs.accessSync(full, fs.constants.X_OK); return full; } catch { /* keep looking */ }
  }
  return null;
}

function locate() {
  searched.length = 0;
  if (override) {
    searched.push(override);
    if (fs.existsSync(override)) return { path: override, source: 'Chosen in Settings', searched: [...searched] };
  }
  for (const c of CANDIDATES[process.platform] || []) {
    searched.push(c);
    if (c && fs.existsSync(c)) return { path: c, source: 'Standard install location', searched: [...searched] };
  }
  const p = onPath();
  if (p) return { path: p, source: 'Found on PATH', searched: [...searched] };
  return { path: null, source: null, searched: [...searched] };
}

function tryJson(text) {
  const t = (text || '').trim();
  if (!t || !/^[[{]/.test(t)) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

function execArgv(argv, { timeout = 60000 } = {}) {
  const loc = locate();
  if (!loc.path) {
    return Promise.resolve({ ok: false, missing: true, code: null, stdout: '', stderr: 'Tailscale was not found on this computer.', argv, searched: loc.searched });
  }
  const started = Date.now();
  return new Promise((resolve) => {
    execFile(loc.path, argv, { timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({ ok: !err, code, stdout: String(stdout), stderr: String(stderr), json: tryJson(stdout), argv, ms: Date.now() - started, binary: loc.path, timedOut: !!(err && err.killed) });
    });
  });
}

function run(id, values) {
  const argv = buildArgs(id, values);
  const cmd = findCommand(id);
  return execArgv(argv, { timeout: cmd.output === 'stream' ? 10 * 60000 : 60000 });
}

const streams = new Map();

function stream(id, values, streamId, send) {
  const argv = buildArgs(id, values);
  const loc = locate();
  if (!loc.path) {
    send({ streamId, type: 'end', code: null, missing: true, argv });
    return { argv };
  }
  const child = spawn(loc.path, argv, { windowsHide: true });
  streams.set(streamId, child);
  send({ streamId, type: 'start', argv, binary: loc.path });
  child.stdout.on('data', (d) => send({ streamId, type: 'stdout', text: d.toString() }));
  child.stderr.on('data', (d) => send({ streamId, type: 'stderr', text: d.toString() }));
  child.on('error', (e) => send({ streamId, type: 'stderr', text: e.message }));
  child.on('close', (code) => { streams.delete(streamId); send({ streamId, type: 'end', code }); });
  return { argv };
}

function cancel(streamId) {
  const c = streams.get(streamId);
  if (c) { c.kill(); streams.delete(streamId); return true; }
  return false;
}

function raw(argv) {
  if (!Array.isArray(argv) || argv.some((a) => typeof a !== 'string' || /[\0\r\n]/.test(a))) throw new Error('Arguments must be a list of single-line strings.');
  return execArgv(argv, { timeout: 120000 });
}

/** Opens an interactive command (ssh, nc) in a new terminal window. */
function openTerminal(id, values) {
  const argv = buildArgs(id, values);
  const loc = locate();
  if (!loc.path) throw new Error('Tailscale was not found on this computer.');
  if (process.platform === 'win32') {
    const q = (a) => `"${String(a).replace(/"/g, '')}"`;
    spawn('cmd.exe', ['/c', 'start', '"Tailscale"', 'cmd.exe', '/k', q(loc.path), ...argv.map(q)], { detached: true, windowsHide: false, windowsVerbatimArguments: true }).unref();
  } else if (process.platform === 'darwin') {
    const q = [loc.path, ...argv].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    spawn('osascript', ['-e', `tell application "Terminal" to do script "${q.replace(/"/g, '\\"')}"`], { detached: true }).unref();
  } else {
    spawn('x-terminal-emulator', ['-e', loc.path, ...argv], { detached: true }).unref();
  }
  return { argv };
}

module.exports = { locate, setOverride, run, stream, cancel, raw, openTerminal, execArgv };
