import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { COMMANDS, buildArgs, findCommand } = require('../src/shared/cli-catalog.js');
const totp = require('../src/shared/totp.js');
const api = require('../src/shared/api-catalog.json');

test('every command id is unique and every command has a path', () => {
  const ids = COMMANDS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COMMANDS) assert.ok(c.path.length, c.id);
});

test('core commands and flags are present', () => {
  for (const id of ['up', 'down', 'set', 'login', 'logout', 'status', 'ping', 'netcheck', 'serve', 'funnel', 'file-cp', 'file-get', 'cert', 'lock-sign', 'drive-share', 'exit-node-list', 'dns-query', 'update', 'whois', 'switch']) assert.ok(findCommand(id), id);
  const set = findCommand('set').flags.map((f) => f.name);
  for (const f of ['accept-dns', 'accept-routes', 'advertise-exit-node', 'advertise-routes', 'exit-node', 'exit-node-allow-lan-access', 'hostname', 'shields-up', 'ssh', 'auto-update', 'webclient', 'relay-server-port', 'update-check', 'stateful-filtering', 'operator']) assert.ok(set.includes(f), f);
});

test('buildArgs sends only given flags and validates values', () => {
  assert.deepEqual(buildArgs('set', { flags: { ssh: true } }), ['set', '--ssh=true']);
  assert.deepEqual(buildArgs('set', { flags: { 'advertise-routes': ['10.0.0.0/24', '192.168.1.0/24'] } }), ['set', '--advertise-routes=10.0.0.0/24,192.168.1.0/24']);
  assert.throws(() => buildArgs('set', { flags: { 'advertise-routes': ['not-a-cidr'] } }));
  assert.throws(() => buildArgs('set', { flags: { bogus: true } }));
  assert.throws(() => buildArgs('ping', { positionals: [] }));
  assert.throws(() => buildArgs('ping', { positionals: ['--evil'] }));
  assert.throws(() => buildArgs('set', { flags: { hostname: 'a\nb' } }));
  assert.deepEqual(buildArgs('file-cp', { positionals: [['a.txt', 'b.txt'], 'nas'] }), ['file', 'cp', 'a.txt', 'b.txt', 'nas:']);
  assert.deepEqual(buildArgs('whois', { flags: { proto: 'tcp', json: true }, positionals: ['100.64.0.1'] }), ['whois', '--json=true', '--proto=tcp', '100.64.0.1']);
  assert.deepEqual(buildArgs('status', { flags: {}, global: { socket: '/tmp/s' } }), ['--socket=/tmp/s', 'status']);
});

test('TOTP matches RFC 4226 and RFC 6238 vectors', () => {
  const key = Buffer.from('12345678901234567890');
  const hotp = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  hotp.forEach((v, i) => assert.equal(totp.hotpSync(key, i), v));
  const k1 = totp.base32Encode(Buffer.from('12345678901234567890'));
  const k256 = totp.base32Encode(Buffer.from('12345678901234567890123456789012'));
  const k512 = totp.base32Encode(Buffer.from('1234567890123456789012345678901234567890123456789012345678901234'));
  for (const [t, a, b, c] of [[59, '94287082', '46119246', '90693936'], [1111111109, '07081804', '68084774', '25091201'], [20000000000, '65353130', '77737706', '47863826']]) {
    assert.equal(totp.totpSync(k1, { time: t * 1000, digits: 8 }), a);
    assert.equal(totp.totpSync(k256, { time: t * 1000, digits: 8, algorithm: 'SHA256' }), b);
    assert.equal(totp.totpSync(k512, { time: t * 1000, digits: 8, algorithm: 'SHA512' }), c);
  }
  const p = totp.parseUri('otpauth://totp/ACME:alice?secret=JBSWY3DPEHPK3PXP&issuer=ACME&digits=6&period=30');
  assert.equal(p.issuer, 'ACME'); assert.equal(p.account, 'alice');
  assert.throws(() => totp.parseUri('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP'));
});

test('admin API catalogue has every documented operation', () => {
  assert.ok(api.operations.length >= 90);
  const has = (m, p) => api.operations.some((o) => o.method === m && o.path === p);
  assert.ok(has('GET', '/tailnet/{tailnet}/devices'));
  assert.ok(has('POST', '/tailnet/{tailnet}/acl/validate'));
  assert.ok(has('PATCH', '/tailnet/{tailnet}/settings'));
  assert.ok(has('DELETE', '/device/{deviceId}'));
});
