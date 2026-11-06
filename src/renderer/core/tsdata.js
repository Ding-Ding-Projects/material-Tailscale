// Live Tailscale data shared by every page: status (polled), exit nodes and
// accounts (on demand). Pickers read from here so they always offer real data.
import * as store from './store.js';

const subs = new Set();
export const data = { status: null, statusErr: null, missing: false, located: null, accounts: null, exitNodes: null, traffic: [], lastPoll: 0, prefs: null };

export function subscribe(fn) { subs.add(fn); fn(data); return () => subs.delete(fn); }
const emit = () => subs.forEach((fn) => fn(data));

export function globalValues() {
  const sock = store.get('socket');
  return sock ? { socket: sock } : {};
}

export async function run(id, values = {}) {
  return window.mt.ts.run(id, { ...values, global: globalValues() });
}

let prevTotals = null;
export async function poll() {
  try {
    const r = await run('status', { flags: { json: true } });
    data.lastPoll = Date.now();
    if (r.missing) { data.missing = true; data.status = null; data.statusErr = r.stderr; data.located = r.searched; emit(); return; }
    data.missing = false;
    if (r.json) {
      data.status = r.json; data.statusErr = null;
      const peers = Object.values(r.json.Peer || {});
      const rx = peers.reduce((n, p) => n + (p.RxBytes || 0), 0), tx = peers.reduce((n, p) => n + (p.TxBytes || 0), 0);
      const now = Date.now();
      if (prevTotals) {
        const dt = (now - prevTotals.at) / 1000;
        data.traffic.push({ t: now, rx: Math.max(0, (rx - prevTotals.rx) / dt), tx: Math.max(0, (tx - prevTotals.tx) / dt) });
        if (data.traffic.length > 120) data.traffic.shift();
      }
      prevTotals = { rx, tx, at: now };
    } else { data.statusErr = (r.stderr || r.stdout || '').trim(); }
  } catch (e) { data.statusErr = e.message; }
  emit();
}

let timer;
export function startPolling() {
  clearInterval(timer);
  poll();
  timer = setInterval(poll, Math.max(1, store.get('statusInterval')) * 1000);
}
store.on((k) => { if (k === 'statusInterval') startPolling(); });

export function peers() {
  const s = data.status;
  if (!s) return [];
  return Object.entries(s.Peer || {}).map(([key, p]) => ({ key, ...p }));
}

export function self() { return data.status?.Self || null; }

export const peerName = (p) => (p.DNSName ? p.DNSName.split('.')[0] : p.HostName) || p.HostName || '?';
export const peerIp = (p) => (p.TailscaleIPs || [])[0] || '';
export function peerPath(p) {
  if (!p.Online) return 'offline';
  if (p.CurAddr) return 'direct';
  if (p.Relay || p.PeerRelay) return 'relay';
  return 'idle';
}
export function peerIcon(p) {
  const os = (p.OS || '').toLowerCase();
  if (p.ExitNodeOption) return 'travel_explore';
  return { windows: 'desktop_windows', macos: 'laptop_mac', linux: 'dns', ios: 'phone_iphone', android: 'phone_android', freebsd: 'dns', tvos: 'tv' }[os] || 'devices';
}

export async function loadAccounts() {
  const r = await run('switch-list');
  if (r.json) data.accounts = Array.isArray(r.json) ? r.json : (r.json.Profiles || r.json.profiles || []);
  else data.accounts = (r.stdout || '').split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => { const parts = l.split(/\s+/); return { ID: parts[0], Tailnet: parts[1], Account: parts[2]?.replace('*', ''), Selected: l.includes('*') }; });
  emit();
  return data.accounts;
}

export async function loadExitNodes() {
  const r = await run('exit-node-list', {});
  const rows = (r.stdout || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^IP\s/i.test(l) && !l.startsWith('#'));
  data.exitNodes = rows.map((l) => {
    const c = l.split(/\s{2,}/);
    return { ip: c[0], name: c[1], country: c[2], city: c[3], status: c[4] };
  }).filter((x) => x.ip && /\d/.test(x.ip));
  if (!data.exitNodes.length) data.exitNodes = peers().filter((p) => p.ExitNodeOption).map((p) => ({ ip: peerIp(p), name: peerName(p), country: p.Location?.Country || '', city: p.Location?.City || '', status: p.ExitNode ? 'selected' : (p.Online ? '' : 'offline') }));
  emit();
  return data.exitNodes;
}
