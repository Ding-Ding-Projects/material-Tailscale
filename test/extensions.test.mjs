// Extension host: manifest checks, consent, permissions, limits, what never reaches an
// extension, and real extension processes (the built-ins and the samples).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const X = require('../src/main/extensions.js');
const API = require('../src/shared/extension-api.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BUILTIN = path.join(root, 'extensions', 'builtin');
const SAMPLES = path.join(root, 'extensions', 'samples');

const PEER = {
  ID: 'n1', HostName: 'nas', DNSName: 'nas.tail1234.ts.net.', TailscaleIPs: ['100.64.0.7', 'fd7a:115c:a1e0::7'], OS: 'linux', Online: true,
  Tags: ['tag:storage'], LastSeen: '2026-11-06T10:00:00Z', ExitNodeOption: true, ExitNode: false,
  PublicKey: 'nodekey:SECRETSECRET', NodeKey: 'nodekey:SECRET2', MachineKey: 'mkey:SECRET3', UserID: 12345,
  CurAddr: '203.0.113.9:41641', Relay: 'tor', KeyExpiry: '2027-01-01T00:00:00Z', LoginName: 'someone@example.com'
};
const STATUS = {
  Version: '1.90.1-t1234', BackendState: 'Running', MagicDNSSuffix: 'tail1234.ts.net', AuthURL: 'https://login.tailscale.com/a/SECRET',
  Self: { HostName: 'laptop', DNSName: 'laptop.tail1234.ts.net.', TailscaleIPs: ['100.64.0.2'], OS: 'windows', Online: true, KeyExpiry: '2026-11-20T00:00:00Z', PublicKey: 'nodekey:SELFSECRET' },
  Peer: { a: PEER, b: { HostName: 'phone', Online: false, PublicKey: 'nodekey:X' } },
  User: { 1: { LoginName: 'someone@example.com' } }, Health: ['DNS is not working'], CurrentTailnet: { Name: 'someone@example.com' }
};

const manifest = (over = {}) => ({
  manifestVersion: 1, id: 'demo', name: 'Demo', version: '1.0.0', apiVersion: 1, description: 'A demo.',
  run: { script: 'main.js' }, permissions: ['peer-details'], actions: [{ id: 'go', hook: 'peer.action', title: 'Go' }], ...over
});

function tempHost() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-ext-test-'));
  const host = X.createHost({ dir: path.join(base, 'extensions'), statePath: path.join(base, 'state.json'), builtinDir: BUILTIN, timeoutMs: 3000 });
  return { base, host, dir: path.join(base, 'extensions') };
}

function writeExt(dir, m, script) {
  const d = path.join(dir, m.id);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m));
  if (script) fs.writeFileSync(path.join(d, 'main.js'), script);
  return d;
}

const echo = (answer) => `let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{process.stdout.write(JSON.stringify(${JSON.stringify(answer)}))});`;

// ---------- manifests ----------
test('every built-in extension and sample has a valid manifest', () => {
  for (const base of [BUILTIN, SAMPLES]) for (const d of fs.readdirSync(base)) {
    const r = X.validateManifest(JSON.parse(fs.readFileSync(path.join(base, d, 'manifest.json'), 'utf8')), d);
    assert.equal(r.ok, true, `${d}: ${(r.errors || []).join(' ')}`);
  }
});

test('manifest checks refuse what the protocol does not allow', () => {
  const bad = (over, folder, why) => {
    const r = X.validateManifest(manifest(over), folder);
    assert.equal(r.ok, false, `expected a refusal for ${JSON.stringify(over)}`);
    assert.match(r.errors.join(' '), why);
  };
  assert.equal(X.validateManifest(manifest(), 'demo').ok, true);
  bad({ id: 'Demo!' }, undefined, /id must be/);
  bad({}, 'other-folder', /must match its folder/);
  bad({ apiVersion: 2 }, undefined, /apiVersion must be 1/);
  bad({ version: 'one' }, undefined, /version must look like/);
  bad({ secretField: 1 }, undefined, /Unknown field "secretField"/);
  bad({ run: { script: '../escape.js' } }, undefined, /inside the extension folder/);
  bad({ run: { script: 'main.js', command: ['x'] } }, undefined, /exactly one of/);
  bad({ run: { command: [] } }, undefined, /run.command must be a list/);
  bad({ permissions: ['peer-details', 'everything'] }, undefined, /permissions must be a list/);
  bad({ permissions: ['peer-details', 'peer-details'] }, undefined, /without repeats/);
  bad({ permissions: [] }, undefined, /needs the "peer-details" permission/);
  bad({ actions: [{ id: 'go', hook: 'boot.sector', title: 'Go' }] }, undefined, /hook must be one of/);
  bad({ actions: [{ id: 'go', hook: 'peer.action', title: 'Go' }, { id: 'go', hook: 'peer.action', title: 'Again' }] }, undefined, /must be unique/);
  bad({ actions: [] }, undefined, /1 to 12 actions/);
  bad({ homepage: 'http://insecure.example' }, undefined, /https link/);
  assert.equal(X.validateManifest(null).ok, false);
  assert.equal(X.validateManifest([]).ok, false);
});

// ---------- what an extension may see ----------
test('keys, owners, public endpoints and tokens never reach an extension', () => {
  const peerReq = X.buildRequest(manifest(), manifest().actions[0], { peer: PEER, language: 'yue' });
  const statusReq = X.buildRequest(manifest({ permissions: ['tailnet-status'], actions: [{ id: 'c', hook: 'status.check', title: 'C' }] }), { id: 'c', hook: 'status.check' }, { status: STATUS });
  for (const req of [peerReq, statusReq]) {
    const text = JSON.stringify(req);
    for (const secret of ['SECRET', 'nodekey', 'mkey', '203.0.113.9', 'someone@example.com', 'login.tailscale.com', '12345']) assert.equal(text.includes(secret), false, `${secret} leaked into ${text}`);
  }
  assert.deepEqual(Object.keys(peerReq.peer).sort(), ['addresses', 'dnsName', 'isExitNode', 'lastSeen', 'name', 'offersExitNode', 'online', 'os', 'tags']);
  assert.equal(peerReq.peer.dnsName, 'nas.tail1234.ts.net');
  assert.equal(peerReq.language, 'yue');
  assert.deepEqual(statusReq.status.devices, { total: 2, online: 1 });
  assert.equal(statusReq.status.self.keyExpiry, '2026-11-20T00:00:00Z');
  assert.equal(statusReq.peer, undefined);
});

test('a request carries data only for permissions the extension holds', () => {
  const m = manifest({ permissions: ['clipboard'] });
  assert.throws(() => X.buildRequest(m, { id: 'go', hook: 'peer.action' }, { peer: PEER }), /peer-details permission/);
  assert.throws(() => X.buildRequest(m, { id: 'c', hook: 'status.check' }, { status: STATUS }), /tailnet-status permission/);
});

// ---------- answers ----------
test('answers are refused when they ask for something not granted or break the limits', () => {
  const ctx = { hook: 'peer.action', permissions: ['peer-details'] };
  assert.throws(() => X.validateAnswer({ ok: true, copy: 'x' }, ctx), /clipboard permission/);
  assert.throws(() => X.validateAnswer({ ok: true, openUrl: 'https://example.com' }, ctx), /open-url permission/);
  assert.throws(() => X.validateAnswer({ ok: true, openUrl: 'file:///etc/passwd' }, { ...ctx, permissions: ['open-url'] }), /http or https/);
  assert.throws(() => X.validateAnswer({ ok: true, openUrl: 'https://user:pw@example.com' }, { ...ctx, permissions: ['open-url'] }), /without a user name or password/);
  assert.throws(() => X.validateAnswer({ ok: true, run: 'rm -rf /' }, ctx), /unknown field "run"/);
  assert.throws(() => X.validateAnswer({ ok: true, message: 'x'.repeat(API.LIMITS.message + 1) }, ctx), /up to 500 characters/);
  assert.throws(() => X.validateAnswer({ ok: true, checks: [] }, ctx), /Only checks for Diagnostics/);
  assert.throws(() => X.validateAnswer({ ok: true, checks: [{ title: 'T', state: 'great' }] }, { hook: 'status.check', permissions: [] }), /state must be one of/);
  assert.throws(() => X.validateAnswer({ message: 'no ok' }, ctx), /"ok": true or false/);
  assert.throws(() => X.validateAnswer('text', ctx), /not a JSON object/);
  assert.doesNotThrow(() => X.validateAnswer({ ok: true, copy: 'ssh nas', message: 'done' }, { ...ctx, permissions: ['peer-details', 'clipboard'] }));
});

// ---------- consent ----------
test('new extensions stay off until allowed, and a changed version or permissions needs consent again', async () => {
  const { host, dir } = tempHost();
  writeExt(dir, manifest(), echo({ ok: true, message: 'hi' }));
  let item = host.list().items.find((i) => i.id === 'demo');
  assert.equal(item.consent, 'needed');
  assert.equal(item.enabled, false);
  await assert.rejects(host.run('demo', 'go', { peer: PEER }), /not been allowed/);
  assert.throws(() => host.allow('demo', 'not-the-fingerprint'), /changed while you were reviewing/);
  host.allow('demo', item.fingerprint);
  item = host.list().items.find((i) => i.id === 'demo');
  assert.equal(item.consent, 'granted');
  assert.equal(item.enabled, true);
  assert.equal((await host.run('demo', 'go', { peer: PEER })).answer.message, 'hi');

  writeExt(dir, manifest({ version: '1.1.0', permissions: ['peer-details', 'clipboard'] }), echo({ ok: true }));
  item = host.list().items.find((i) => i.id === 'demo');
  assert.equal(item.consent, 'changed');
  assert.deepEqual(item.added, ['clipboard']);
  assert.equal(item.was.version, '1.0.0');
  assert.equal(item.enabled, false);
  await assert.rejects(host.run('demo', 'go', { peer: PEER }), /changed what it asks for/);

  host.allow('demo', item.fingerprint);
  host.setEnabled('demo', false);
  await assert.rejects(host.run('demo', 'go', { peer: PEER }), /turned off/);
  host.setEnabled('demo', true);
  host.setMasterOff(true);
  assert.equal(host.list().items.find((i) => i.id === 'demo').enabled, false);
  await assert.rejects(host.run('demo', 'go', { peer: PEER }), /turned off in the extensions manager/);
});

// ---------- limits ----------
test('an extension that does not answer in time is stopped', async () => {
  const { host, dir } = tempHost();
  writeExt(dir, manifest(), 'setTimeout(() => {}, 60000);');
  host.allow('demo', host.list().items.find((i) => i.id === 'demo').fingerprint);
  const t0 = Date.now();
  const r = await host.run('demo', 'go', { peer: PEER });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'timeout');
  assert.ok(Date.now() - t0 < 6000);
  assert.equal(host.list().items.find((i) => i.id === 'demo').runs[0].ok, false);
});

test('an answer larger than the limit is refused, and broken answers are reported plainly', async () => {
  const { host, dir } = tempHost();
  const big = `process.stdout.write(JSON.stringify({ ok: true, message: 'x'.repeat(${API.LIMITS.answerBytes + 10}) }));`;
  writeExt(dir, manifest(), big);
  host.allow('demo', host.list().items.find((i) => i.id === 'demo').fingerprint);
  assert.equal((await host.run('demo', 'go', { peer: PEER })).code, 'too-large');

  writeExt(dir, manifest(), 'process.stdout.write("not json");');
  assert.equal((await host.run('demo', 'go', { peer: PEER })).code, 'bad-answer');
  writeExt(dir, manifest(), 'console.error("disk on fire"); process.exit(3);');
  const r = await host.run('demo', 'go', { peer: PEER });
  assert.equal(r.code, 'exit');
  assert.match(r.error, /exit code 3: disk on fire/);
  writeExt(dir, manifest(), echo({ ok: true, copy: 'sneaky' }));
  const refused = await host.run('demo', 'go', { peer: PEER });
  assert.equal(refused.code, 'refused');
  assert.match(refused.error, /clipboard permission/);
});

test('an extension starts with no tokens from the environment', async () => {
  process.env.MT_TEST_TOKEN = 'tskey-api-SECRET';
  const { host, dir } = tempHost();
  writeExt(dir, manifest(), "process.stdout.write(JSON.stringify({ ok: true, message: Object.keys(process.env).filter((k) => /TOKEN|KEY|SECRET/.test(k)).join(',') || 'clean' }));");
  host.allow('demo', host.list().items.find((i) => i.id === 'demo').fingerprint);
  const r = await host.run('demo', 'go', { peer: PEER });
  delete process.env.MT_TEST_TOKEN;
  assert.equal(r.answer.message, 'clean');
});

// ---------- built-ins ----------
test('built-in extensions install once, update only while unmodified, and stay removed when removed', () => {
  const { host, dir, base } = tempHost();
  host.installBuiltins();
  const ids = host.list().items.map((i) => i.id);
  assert.deepEqual(ids, ['device-summary', 'ssh-command', 'tailnet-health', 'web-page']);
  assert.ok(host.list().items.every((i) => i.builtIn && !i.modified && i.consent === 'needed'));

  // A modified built-in is left alone by the next install.
  fs.appendFileSync(path.join(dir, 'ssh-command', 'main.js'), '\n// my change\n');
  const state = JSON.parse(fs.readFileSync(path.join(base, 'state.json'), 'utf8'));
  state.builtIns['ssh-command'].hash = 'older-shipped-version';
  fs.writeFileSync(path.join(base, 'state.json'), JSON.stringify(state));
  const host2 = X.createHost({ dir, statePath: path.join(base, 'state.json'), builtinDir: BUILTIN });
  host2.installBuiltins();
  assert.match(fs.readFileSync(path.join(dir, 'ssh-command', 'main.js'), 'utf8'), /my change/);
  assert.equal(host2.list().items.find((i) => i.id === 'ssh-command').modified, true);

  // A removed built-in does not come back.
  host2.remove('web-page');
  host2.installBuiltins();
  assert.equal(fs.existsSync(path.join(dir, 'web-page')), false);
});

test('adding from a folder asks before replacing a different version', () => {
  const { host, base } = tempHost();
  const src = path.join(base, 'incoming', 'demo-v1');
  writeExt(path.dirname(src), { ...manifest(), id: 'demo' }, echo({ ok: true }));
  fs.renameSync(path.join(path.dirname(src), 'demo'), src);
  assert.equal(host.addFromFolder(src).added, 'demo');
  fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify(manifest({ version: '2.0.0' })));
  const ask = host.addFromFolder(src);
  assert.deepEqual({ confirm: ask.confirm, from: ask.from, to: ask.to }, { confirm: true, from: '1.0.0', to: '2.0.0' });
  assert.equal(host.addFromFolder(src, { replace: true }).added, 'demo');
  assert.equal(host.list().items.find((i) => i.id === 'demo').manifest.version, '2.0.0');
  fs.writeFileSync(path.join(src, 'manifest.json'), '{ "id": ');
  assert.throws(() => host.addFromFolder(src), /not valid JSON/);
});

test('the built-in extensions answer real requests', async () => {
  const { host } = tempHost();
  host.installBuiltins();
  for (const i of host.list().items) host.allow(i.id, i.fingerprint);
  const ssh = await host.run('ssh-command', 'copy', { peer: PEER, language: 'en' });
  assert.equal(ssh.ok, true, ssh.error);
  assert.equal(ssh.answer.copy, 'tailscale ssh nas.tail1234.ts.net');
  const web = await host.run('web-page', 'open', { peer: PEER, language: 'both' });
  assert.equal(web.answer.openUrl, 'http://nas.tail1234.ts.net/');
  assert.match(web.answer.message, / · /);
  const sum = await host.run('device-summary', 'copy', { peer: PEER, language: 'yue' });
  assert.match(sum.answer.copy, /### nas/);
  assert.match(sum.answer.copy, /在線/);
  const health = await host.run('tailnet-health', 'checks', { status: STATUS, language: 'en' });
  assert.equal(health.ok, true, health.error);
  const titles = health.answer.checks.map((c) => `${c.state}: ${c.title}`);
  assert.ok(titles.includes('ok: Tailscale is connected'), titles.join('\n'));
  assert.ok(titles.some((x) => x.startsWith('warn: 1 health warning')), titles.join('\n'));
  assert.ok(titles.includes('ok: 1 of 2 devices are online'), titles.join('\n'));
});

test('the language-neutral samples answer real requests where their runtime exists', async (t) => {
  const { host, base } = tempHost();
  const node = await (async () => {
    const r = host.addFromFolder(path.join(SAMPLES, 'online-share-node'));
    const item = r.list.items.find((i) => i.id === 'online-share-node');
    host.allow(item.id, item.fingerprint);
    return host.run('online-share-node', 'share', { status: STATUS });
  })();
  assert.equal(node.answer.checks[0].title, '50% of devices are online');
  const py = ['python3', 'python'].find((c) => spawnSync(c, ['--version']).status === 0);
  if (!py) { t.diagnostic('Python is not installed here; the Python sample was not run.'); return; }
  const dest = path.join(base, 'py', 'hello-python');
  fs.cpSync(path.join(SAMPLES, 'hello-python'), dest, { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  m.run.command[0] = py;
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(m));
  const item = host.addFromFolder(dest).list.items.find((i) => i.id === 'hello-python');
  host.allow(item.id, item.fingerprint);
  const r = await host.run('hello-python', 'hello', { peer: PEER });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.answer.message, 'Hello, nas! It is online and runs linux.');
});
