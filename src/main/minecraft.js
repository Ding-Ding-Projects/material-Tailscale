'use strict';
// Minecraft server creator and manager. Four execution targets share one
// adapter interface: local process, local Docker, process over SSH, Docker
// over SSH. Versions come from the authoritative catalogues; downloads are
// verified against published digests; the EULA is accepted only by the person
// in the app; discovery is read-only until a server is explicitly adopted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { app } = require('electron');
const tools = require('./tools');

const root = () => path.join(app.getPath('userData'), 'minecraft');
const registryFile = () => path.join(root(), 'servers.json');
const cacheDir = (...p) => path.join(root(), 'cache', ...p);
let emit = () => {};
function setEmitter(fn) { emit = fn; }

// ---------------- registry ----------------
function loadRegistry() { try { return JSON.parse(fs.readFileSync(registryFile(), 'utf8')); } catch { return { servers: [] }; } }
function saveRegistry(r) { fs.mkdirSync(root(), { recursive: true }); fs.writeFileSync(registryFile(), JSON.stringify(r, null, 2)); }
function getServer(id) { const s = loadRegistry().servers.find((x) => x.id === id); if (!s) throw new Error(`Unknown server ${id}`); return s; }
function updateServer(id, patch) { const r = loadRegistry(); const i = r.servers.findIndex((x) => x.id === id); r.servers[i] = { ...r.servers[i], ...patch }; saveRegistry(r); return r.servers[i]; }

// ---------------- catalogues ----------------
const UA = { 'User-Agent': 'MaterialTailscale (github.com/Ding-Ding-Projects/material-Tailscale)' };
const j = async (url) => { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`); return r.json(); };
async function cached(name, url, maxAgeMs = 6 * 3600 * 1000) {
  const f = cacheDir(name + '.json');
  try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); if (Date.now() - c.at < maxAgeMs) return { ...c, stale: false }; } catch { /* refresh */ }
  try { const data = await j(url); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ at: Date.now(), url, data })); return { at: Date.now(), url, data, stale: false }; }
  catch (e) { try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); return { ...c, stale: true, error: e.message }; } catch { throw e; } }
}

async function catalog(edition = 'java', flavor = 'vanilla') {
  if (edition === 'bedrock') {
    const c = await cached('bedrock-links', 'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links');
    const links = c.data?.result?.links || [];
    return { edition, flavor: 'bedrock', retrievedAt: c.at, stale: c.stale, source: c.url, versions: links.filter((l) => /^serverBedrock/.test(l.downloadType)).map((l) => ({ id: (l.downloadUrl.match(/bedrock-server-([\d.]+)\.zip/) || [])[1] || l.downloadType, type: /Preview/.test(l.downloadType) ? 'preview' : 'release', platform: /Windows/.test(l.downloadType) ? 'windows' : 'linux', url: l.downloadUrl, distribution: 'available' })),
      gap: 'Only the current release and preview packages are published by the official link service; historical Bedrock server packages have no authoritative catalogue.' };
  }
  if (flavor === 'vanilla') {
    const c = await cached('mojang-manifest', 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    return { edition, flavor, retrievedAt: c.at, stale: c.stale, source: c.url, latest: c.data.latest, versions: c.data.versions.map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime, metaUrl: v.url, metaSha1: v.sha1, distribution: 'resolve on selection' })) };
  }
  if (flavor === 'paper' || flavor === 'folia' || flavor === 'velocity') {
    // PaperMC sunset its v2 API; the Fill v3 API groups versions newest first.
    const c = await cached(`papermc3-${flavor}`, `https://fill.papermc.io/v3/projects/${flavor}`);
    const ids = Object.values(c.data.versions || {}).flat();
    return { edition, flavor, retrievedAt: c.at, stale: c.stale, source: c.url, versions: ids.map((id) => ({ id, type: /pre|rc|snapshot/i.test(id) ? 'pre-release' : 'release', distribution: 'resolve on selection' })) };
  }
  if (flavor === 'purpur') {
    const c = await cached('purpur', 'https://api.purpurmc.org/v2/purpur');
    return { edition, flavor, retrievedAt: c.at, stale: c.stale, source: c.url, versions: [...c.data.versions].reverse().map((id) => ({ id, type: 'release', distribution: 'resolve on selection' })) };
  }
  if (flavor === 'fabric') {
    const c = await cached('fabric-game', 'https://meta.fabricmc.net/v2/versions/game');
    return { edition, flavor, retrievedAt: c.at, stale: c.stale, source: c.url, versions: c.data.map((v) => ({ id: v.version, type: v.stable ? 'release' : 'snapshot', distribution: 'resolve on selection' })) };
  }
  if (flavor === 'forge') {
    const c = await cached('forge-promos', 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const map = new Map();
    for (const [k, v] of Object.entries(c.data.promos || {})) { const [mc, kind] = k.split('-'); if (!map.has(mc) || kind === 'recommended') map.set(mc, { id: mc, forge: v, type: kind === 'recommended' ? 'release' : 'latest build', distribution: 'resolve on selection' }); }
    return { edition, flavor, retrievedAt: c.at, stale: c.stale, source: c.url, versions: [...map.values()].reverse(), gap: 'Only versions with a promoted Forge build are listed.' };
  }
  throw new Error(`Unknown flavour ${flavor}`);
}

/** Resolves the exact download, digest and Java runtime for one selection. */
async function resolve(edition, flavor, version) {
  if (edition === 'bedrock') {
    const listing = await catalog('bedrock');
    const plat = process.platform === 'win32' ? 'windows' : 'linux';
    const v = listing.versions.find((x) => x.id === version && x.platform === plat) || listing.versions.find((x) => x.id === version);
    if (!v) throw new Error(`Bedrock ${version} has no published server package.`);
    return { url: v.url, file: path.basename(v.url), digest: null, digestNote: 'The Bedrock link service publishes no checksum; integrity metadata is unavailable.', java: null, kind: 'bedrock-zip' };
  }
  const vanillaMeta = async () => {
    const listing = await catalog('java', 'vanilla');
    const v = listing.versions.find((x) => x.id === version);
    if (!v) throw new Error(`${version} is not in the official catalogue.`);
    const res = await fetch(v.metaUrl, { headers: UA });
    const text = await res.text();
    if (crypto.createHash('sha1').update(text).digest('hex') !== v.metaSha1) throw new Error('Version metadata did not match its published SHA-1.');
    return JSON.parse(text);
  };
  if (flavor === 'vanilla') {
    const meta = await vanillaMeta();
    const s = meta.downloads?.server;
    if (!s) return { unavailable: true, reason: `${version} has no dedicated server download in its official metadata.` };
    return { url: s.url, file: 'server.jar', digest: { algo: 'sha1', value: s.sha1 }, size: s.size, java: meta.javaVersion?.majorVersion || null, javaNote: meta.javaVersion ? null : 'This version\'s metadata names no Java runtime; Java 8 is used for these historical versions.', kind: 'jar' };
  }
  if (flavor === 'paper' || flavor === 'folia') {
    const builds = await j(`https://fill.papermc.io/v3/projects/${flavor}/versions/${encodeURIComponent(version)}/builds`);
    if (!Array.isArray(builds) || !builds.length) return { unavailable: true, reason: `${flavor} publishes no build for ${version}.` };
    const build = builds.find((x) => x.channel === 'STABLE') || builds[0];
    const d = build.downloads?.['server:default'];
    if (!d?.checksums?.sha256) return { unavailable: true, reason: `${flavor} build ${build.id} has no published SHA-256, so it is not downloaded.` };
    const meta = await vanillaMeta().catch(() => null);
    return { url: d.url, file: 'server.jar', digest: { algo: 'sha256', value: d.checksums.sha256 }, size: d.size, build: build.id, channel: build.channel, java: meta?.javaVersion?.majorVersion || 21, kind: 'jar' };
  }
  if (flavor === 'purpur') {
    const b = await j(`https://api.purpurmc.org/v2/purpur/${version}/latest`);
    const meta = await vanillaMeta().catch(() => null);
    return { url: `https://api.purpurmc.org/v2/purpur/${version}/latest/download`, file: 'server.jar', digest: { algo: 'md5', value: b.md5 }, build: b.build, java: meta?.javaVersion?.majorVersion || 21, kind: 'jar' };
  }
  if (flavor === 'fabric') {
    const loaders = await j(`https://meta.fabricmc.net/v2/versions/loader/${version}`);
    const loader = loaders.find((l) => l.loader.stable)?.loader.version || loaders[0]?.loader.version;
    const inst = (await j('https://meta.fabricmc.net/v2/versions/installer')).find((i) => i.stable).version;
    const meta = await vanillaMeta().catch(() => null);
    return { url: `https://meta.fabricmc.net/v2/versions/loader/${version}/${loader}/${inst}/server/jar`, file: 'server.jar', digest: null, digestNote: 'Fabric publishes no checksum for the server launcher; integrity metadata is unavailable.', loader, java: meta?.javaVersion?.majorVersion || 21, kind: 'jar' };
  }
  if (flavor === 'forge') {
    const listing = await catalog('java', 'forge');
    const v = listing.versions.find((x) => x.id === version);
    const full = `${version}-${v.forge}`;
    const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
    const sha1 = (await (await fetch(url + '.sha1', { headers: UA })).text()).trim();
    const meta = await vanillaMeta().catch(() => null);
    return { url, file: 'forge-installer.jar', digest: /^[0-9a-f]{40}$/.test(sha1) ? { algo: 'sha1', value: sha1 } : null, java: meta?.javaVersion?.majorVersion || 17, kind: 'forge-installer' };
  }
  throw new Error(`Unknown flavour ${flavor}`);
}

async function verifiedDownload(url, dest, digest, job) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const h = digest ? crypto.createHash(digest.algo) : null;
  const tmp = dest + '.part'; const out = fs.createWriteStream(tmp); let got = 0;
  for await (const chunk of res.body) { h?.update(chunk); out.write(chunk); got += chunk.length; emit('progress', { job, got, total, phase: `Downloading ${path.basename(dest)}` }); }
  await new Promise((r, e) => out.end((x) => (x ? e(x) : r())));
  if (h) { const d = h.digest('hex'); if (d !== digest.value.toLowerCase()) { fs.rmSync(tmp, { force: true }); throw new Error(`${digest.algo.toUpperCase()} mismatch for ${path.basename(dest)}: expected ${digest.value}, got ${d}. The file was deleted.`); } }
  fs.renameSync(tmp, dest);
  return { bytes: got, verified: !!h };
}

// ---------------- targets ----------------
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
function sshArgs(t) { return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', ...(t.port ? ['-p', String(t.port)] : []), ...(t.keyPath ? ['-i', t.keyPath] : []), `${t.user ? t.user + '@' : ''}${t.host}`]; }
function execP(cmd, args, { input, timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    const p = execFile(cmd, args, { timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr), error: err && err.code === 'ENOENT' ? `${cmd} is not installed or not on PATH` : null }));
    if (input) { p.stdin.write(input); p.stdin.end(); }
  });
}
/** Runs a shell command on the target host (remote targets) or a docker CLI command. */
function remote(t, script, opts) { return execP('ssh', [...sshArgs(t), script], opts); }
function docker(t, args, opts) { return t.kind === 'ssh-docker' ? remote(t, ['docker', ...args].map(q).join(' '), opts) : execP('docker', args, opts); }

async function probeTarget(t) {
  if (t.kind === 'local') return { ok: true, platform: process.platform, arch: process.arch };
  if (t.kind === 'docker') { const r = await docker(t, ['version', '--format', '{{.Server.Version}}']); return r.code === 0 ? { ok: true, docker: r.stdout.trim() } : { ok: false, message: r.error || r.stderr.trim() || 'Docker is not reachable.' }; }
  const r = await remote(t, 'uname -sm && (java -version 2>&1 | head -1 || true) && (docker version --format "{{.Server.Version}}" 2>/dev/null || true)', { timeout: 20000 });
  if (r.code !== 0) return { ok: false, message: r.error || r.stderr.trim() || `SSH exited with ${r.code}`, connection: true };
  const lines = r.stdout.trim().split('\n');
  return { ok: true, platform: lines[0], java: lines[1] || null, docker: lines[2] || null };
}

/** Read-only discovery of servers that are not managed yet. Nothing is adopted without consent. */
async function discover(t) {
  const found = [];
  if (t.kind === 'docker' || t.kind === 'ssh-docker') {
    const r = await docker(t, ['ps', '-a', '--format', '{{json .}}']);
    for (const line of r.stdout.split('\n').filter(Boolean)) { const c = JSON.parse(line); if (/minecraft/i.test(c.Image) || /25565|19132/.test(c.Ports)) found.push({ kind: 'container', id: c.ID, name: c.Names, image: c.Image, state: c.State, ports: c.Ports, managed: /mt-mc-/.test(c.Names) }); }
  } else if (t.kind === 'ssh') {
    const r = await remote(t, 'ls -d ~/minecraft/*/ 2>/dev/null; pgrep -af "server.jar|bedrock_server" 2>/dev/null || true');
    found.push(...r.stdout.split('\n').filter(Boolean).map((l) => ({ kind: /^\d+ /.test(l) ? 'process' : 'folder', id: l.split(' ')[0], name: l })));
  } else {
    const r = loadRegistry();
    for (const d of fs.existsSync(path.join(root(), 'servers')) ? fs.readdirSync(path.join(root(), 'servers')) : []) if (!r.servers.some((s) => s.id === d)) found.push({ kind: 'folder', id: d, name: path.join(root(), 'servers', d) });
  }
  return found;
}

// ---------------- create / install ----------------
async function create(spec, job) {
  const id = (spec.name || 'server').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  const t = spec.target || { kind: 'local' };
  const probe = await probeTarget(t);
  if (!probe.ok) throw new Error(`The target is not ready: ${probe.message}`);
  const s = { id, name: spec.name, edition: spec.edition, flavor: spec.flavor, version: spec.version, target: t, port: spec.port || (spec.edition === 'bedrock' ? 19132 : 25565), memoryMb: spec.memoryMb || 2048, created: new Date().toISOString(), eulaAccepted: false, history: [] };
  if (t.kind === 'local') {
    s.dir = path.join(root(), 'servers', id);
    fs.mkdirSync(s.dir, { recursive: true });
    const r = await resolve(spec.edition, spec.flavor, spec.version);
    if (r.unavailable) throw new Error(r.reason);
    const dest = path.join(s.dir, r.file);
    const dl = await verifiedDownload(r.url, dest, r.digest, job);
    s.distribution = { url: r.url, digest: r.digest, verified: dl.verified, note: r.digestNote || null, build: r.build || r.loader || null };
    if (r.kind === 'bedrock-zip') { emit('progress', { job, phase: 'Unpacking the Bedrock server' }); await tools.sevenZip(['x', dest, `-o${s.dir}`, '-y']); fs.rmSync(dest); if (process.platform !== 'win32') fs.chmodSync(path.join(s.dir, 'bedrock_server'), 0o755); }
    if (r.java) { const jv = await tools.ensureJava(r.java, (p) => emit('progress', { job, ...p })); s.java = jv.java; s.javaFeature = r.java; }
    if (r.kind === 'forge-installer') {
      emit('progress', { job, phase: 'Running the Forge installer' });
      const out = await execP(s.java, ['-jar', dest, '--installServer'], { timeout: 15 * 60000 });
      if (out.code !== 0) throw new Error(`The Forge installer failed: ${out.stderr.slice(-500)}`);
      s.forgeArgs = fs.existsSync(path.join(s.dir, 'run.bat')) ? 'run' : 'jar';
    }
  } else if (t.kind === 'docker' || t.kind === 'ssh-docker') {
    const image = spec.edition === 'bedrock' ? 'itzg/minecraft-bedrock-server' : 'itzg/minecraft-server';
    emit('progress', { job, phase: `Pulling ${image}` });
    const p = await docker(t, ['pull', image], { timeout: 20 * 60000 });
    if (p.code !== 0) throw new Error(`Could not pull ${image}: ${p.stderr.trim() || p.error}`);
    const ins = await docker(t, ['image', 'inspect', '--format', '{{index .RepoDigests 0}}', image]);
    s.image = ins.stdout.trim() || image;
    s.container = `mt-mc-${id}`;
    s.dir = t.kind === 'docker' ? path.join(root(), 'servers', id) : `~/minecraft/${id}`;
    if (t.kind === 'docker') fs.mkdirSync(s.dir, { recursive: true }); else await remote(t, `mkdir -p ${s.dir}`);
  } else if (t.kind === 'ssh') {
    if (spec.edition === 'bedrock') throw new Error('Bedrock over SSH without Docker is not supported; choose SSH with Docker.');
    s.dir = `~/minecraft/${id}`;
    const r = await resolve(spec.edition, spec.flavor, spec.version);
    if (r.unavailable) throw new Error(r.reason);
    const sumCmd = r.digest ? `${r.digest.algo}sum server.jar | cut -d' ' -f1` : 'echo none';
    emit('progress', { job, phase: 'Downloading on the remote host' });
    const out = await remote(t, `set -e; mkdir -p ${s.dir}; cd ${s.dir}; curl -fsSL -o server.jar ${q(r.url)}; ${sumCmd}`, { timeout: 15 * 60000 });
    if (out.code !== 0) throw new Error(`Remote download failed: ${out.stderr.trim()}`);
    if (r.digest && out.stdout.trim().split('\n').pop() !== r.digest.value.toLowerCase()) throw new Error('The remote download did not match its published digest.');
    s.distribution = { url: r.url, digest: r.digest, verified: !!r.digest };
    if (!probe.java) s.warning = 'No Java was found on the remote host. Install a compatible Java runtime there before starting.';
  }
  const reg = loadRegistry(); reg.servers.push(s); saveRegistry(reg);
  return s;
}

async function adopt(t, item, name) {
  const id = (name || item.name || 'adopted').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) + '-' + crypto.randomBytes(3).toString('hex');
  const s = { id, name: name || item.name, edition: 'java', flavor: 'unknown', version: 'unknown', target: t, adopted: { from: item, at: new Date().toISOString() }, eulaAccepted: true, history: [] };
  if (item.kind === 'container') { s.container = item.name; s.image = item.image; }
  else if (item.kind === 'folder') s.dir = item.name.replace(/\/$/, '');
  const reg = loadRegistry(); reg.servers.push(s); saveRegistry(reg);
  return s;
}

// ---------------- lifecycle ----------------
const procs = new Map();     // id -> child process (local)
const tails = new Map();     // id -> log tail process (remote/docker)

function acceptEula(id) {
  const s = getServer(id);
  if (s.target.kind === 'local' && s.dir) fs.writeFileSync(path.join(s.dir, 'eula.txt'), `# Accepted in Material Tailscale by the server owner on ${new Date().toISOString()}\neula=true\n`);
  return updateServer(id, { eulaAccepted: true, eulaAcceptedAt: new Date().toISOString() });
}

async function start(id) {
  const s = getServer(id);
  if (!s.eulaAccepted && s.edition !== 'bedrock') throw Object.assign(new Error('The Minecraft EULA must be accepted in the app before this server can start.'), { code: 'EULA' });
  const t = s.target;
  if (t.kind === 'local') {
    if (procs.has(id)) return { already: true };
    let cmd, args;
    if (s.edition === 'bedrock') { cmd = path.join(s.dir, process.platform === 'win32' ? 'bedrock_server.exe' : 'bedrock_server'); args = []; }
    else if (s.forgeArgs === 'run') { const argsFile = fs.readdirSync(path.join(s.dir, 'libraries', 'net', 'minecraftforge', 'forge')).map((v) => path.join(s.dir, 'libraries', 'net', 'minecraftforge', 'forge', v, process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt')).find(fs.existsSync); cmd = s.java; args = [`-Xmx${s.memoryMb}M`, `@${argsFile}`, 'nogui']; }
    else { cmd = s.java || 'java'; args = [`-Xms${Math.min(1024, s.memoryMb)}M`, `-Xmx${s.memoryMb}M`, '-jar', 'server.jar', 'nogui']; }
    const p = spawn(cmd, args, { cwd: s.dir, windowsHide: true, env: { ...process.env, LD_LIBRARY_PATH: s.dir } });
    procs.set(id, p);
    const line = (stream) => (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => emit('log', { id, line: l, stream }));
    p.stdout.on('data', line('out')); p.stderr.on('data', line('err'));
    p.on('error', (e) => emit('log', { id, line: e.message, stream: 'err' }));
    p.on('close', (code) => { procs.delete(id); emit('state', { id, state: 'stopped', code }); });
    emit('state', { id, state: 'starting', pid: p.pid });
    return { pid: p.pid };
  }
  if (t.kind === 'docker' || t.kind === 'ssh-docker') {
    const exists = (await docker(t, ['inspect', s.container])).code === 0;
    if (!exists) {
      const env = s.edition === 'bedrock' ? ['-e', 'EULA=TRUE', '-e', `VERSION=${s.version}`] : ['-e', 'EULA=TRUE', '-e', `TYPE=${(s.flavor === 'vanilla' ? 'VANILLA' : s.flavor).toUpperCase()}`, '-e', `VERSION=${s.version}`, '-e', `MEMORY=${s.memoryMb}M`];
      const vol = t.kind === 'docker' ? s.dir : s.dir.replace(/^~/, '$HOME');
      const ports = s.edition === 'bedrock' ? ['-p', `${s.port}:19132/udp`] : ['-p', `${s.port}:25565`];
      const r = await docker(t, ['run', '-d', '--name', s.container, '--label', `material-tailscale.server=${id}`, '-v', `${vol}:/data`, ...ports, ...env, '-it', s.image], { timeout: 120000 });
      if (r.code !== 0) throw new Error(r.stderr.trim() || r.error);
    } else { const r = await docker(t, ['start', s.container]); if (r.code !== 0) throw new Error(r.stderr.trim()); }
    followLogs(id);
    emit('state', { id, state: 'starting' });
    return { container: s.container };
  }
  // ssh process
  const r = await remote(t, `cd ${s.dir} && [ -p console.in ] || mkfifo -m600 console.in; nohup sh -c 'tail -f console.in | java -Xmx${s.memoryMb}M -jar server.jar nogui' > server.log 2>&1 & echo $! > server.pid; echo started`);
  if (r.code !== 0) throw new Error(r.stderr.trim() || r.error);
  followLogs(id);
  emit('state', { id, state: 'starting' });
  return { remote: true };
}

function followLogs(id) {
  const s = getServer(id);
  tails.get(id)?.kill();
  const args = s.target.kind === 'ssh' ? [...sshArgs(s.target), `tail -n 200 -F ${s.dir}/server.log`] : s.target.kind === 'ssh-docker' ? [...sshArgs(s.target), `docker logs -f --tail 200 ${q(s.container)}`] : ['logs', '-f', '--tail', '200', s.container];
  const p = spawn(s.target.kind === 'docker' ? 'docker' : 'ssh', args, { windowsHide: true });
  tails.set(id, p);
  const line = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => emit('log', { id, line: l, stream: 'out' }));
  p.stdout.on('data', line); p.stderr.on('data', line);
  p.on('close', (code) => { tails.delete(id); emit('state', { id, state: 'disconnected', code, note: 'The log connection closed. This does not mean the server stopped.' }); });
}

async function command(id, cmd) {
  if (/[\r\n]/.test(cmd)) throw new Error('Commands are one line.');
  const s = getServer(id);
  const t = s.target;
  if (t.kind === 'local') { const p = procs.get(id); if (!p) throw new Error('The server is not running.'); p.stdin.write(cmd + '\n'); return { sent: true }; }
  if (t.kind === 'ssh') { const r = await remote(t, `cd ${s.dir} && printf '%s\\n' ${q(cmd)} > console.in`); if (r.code !== 0) throw new Error(r.stderr.trim()); return { sent: true }; }
  const r = await docker(t, s.edition === 'bedrock' ? ['exec', s.container, 'send-command', ...cmd.split(' ')] : ['exec', s.container, 'rcon-cli', ...cmd.split(' ')]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || r.error);
  if (r.stdout.trim()) emit('log', { id, line: r.stdout.trim(), stream: 'out' });
  return { sent: true, output: r.stdout };
}

async function stop(id, { force } = {}) {
  const s = getServer(id);
  const t = s.target;
  if (t.kind === 'local') {
    const p = procs.get(id); if (!p) return { already: true };
    if (force) { p.kill(); return { killed: true }; }
    p.stdin.write('stop\n');
    const done = await new Promise((r) => { const to = setTimeout(() => r(false), 60000); p.once('close', () => { clearTimeout(to); r(true); }); });
    return done ? { stopped: true } : { stillRunning: true, message: 'The server did not stop within 60 seconds. Use Force stop if it is stuck.' };
  }
  if (t.kind === 'ssh') { await command(id, 'stop'); return { stopping: true }; }
  const r = await docker(t, ['stop', '-t', '60', s.container], { timeout: 90000 });
  if (r.code !== 0) throw new Error(r.stderr.trim());
  return { stopped: true };
}

async function status(id) {
  const s = getServer(id);
  const t = s.target;
  if (t.kind === 'local') {
    const p = procs.get(id);
    if (!p) return { state: 'stopped' };
    let usage = null;
    if (process.platform === 'win32') { const r = await execP('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${p.pid}; "$($p.CPU) $($p.WorkingSet64)"`]); const [cpu, mem] = r.stdout.trim().split(' ').map(Number); usage = { cpuSeconds: cpu, memoryBytes: mem }; }
    else { try { const st = fs.readFileSync(`/proc/${p.pid}/status`, 'utf8'); usage = { memoryBytes: Number((st.match(/VmRSS:\s+(\d+)/) || [])[1]) * 1024 }; } catch { /* gone */ } }
    return { state: 'running', pid: p.pid, usage };
  }
  if (t.kind === 'ssh') {
    const r = await remote(t, `cd ${s.dir} 2>/dev/null && read -r pid < server.pid 2>/dev/null && kill -0 $pid 2>/dev/null && ps -o rss= -p $pid || echo stopped`, { timeout: 15000 });
    if (r.code === 255) return { state: 'unreachable', message: r.stderr.trim() };
    const out = r.stdout.trim();
    return out === 'stopped' ? { state: 'stopped' } : { state: 'running', usage: { memoryBytes: Number(out) * 1024 } };
  }
  const r = await docker(t, ['inspect', '--format', '{{.State.Status}}', s.container], { timeout: 15000 });
  if (r.code !== 0) return { state: t.kind === 'ssh-docker' && r.code === 255 ? 'unreachable' : 'not created' };
  const st = r.stdout.trim();
  let usage = null;
  if (st === 'running') { const u = await docker(t, ['stats', '--no-stream', '--format', '{{json .}}', s.container]); try { const x = JSON.parse(u.stdout); usage = { cpu: x.CPUPerc, memory: x.MemUsage }; } catch { /* no stats */ } }
  return { state: st, usage };
}

// ---------------- files (local and remote) ----------------
async function readFile(id, rel) {
  const s = getServer(id);
  if (rel.includes('..')) throw new Error('Bad path');
  if (s.target.kind === 'local' || s.target.kind === 'docker') { const p = path.join(s.dir, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
  const r = await remote(s.target, `tail -n +1 ${s.dir}/${q(rel)} 2>/dev/null || true`);
  return r.stdout || null;
}
async function writeFile(id, rel, text) {
  const s = getServer(id);
  if (rel.includes('..')) throw new Error('Bad path');
  if (s.target.kind === 'local' || s.target.kind === 'docker') {
    const p = path.join(s.dir, rel);
    if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
    const tmp = p + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, p);
    return { path: p };
  }
  const r = await remote(s.target, `cd ${s.dir} && cp ${q(rel)} ${q(rel + '.bak')} 2>/dev/null; tee ${q(rel + '.tmp')} > /dev/null && mv ${q(rel + '.tmp')} ${q(rel)}`, { input: text });
  if (r.code !== 0) throw new Error(r.stderr.trim());
  return { remote: true };
}

/** Parses server.properties keeping comments, order and unknown keys. */
function parseProps(text) { return (text || '').split(/\r?\n/).map((raw) => { const m = raw.match(/^([^#!][^=:]*?)\s*[=:]\s*(.*)$/); return m ? { key: m[1].trim(), value: m[2], raw } : { raw }; }); }
function serializeProps(lines, values) {
  const seen = new Set();
  const out = lines.map((l) => { if (!l.key) return l.raw; seen.add(l.key); return l.key in values ? `${l.key}=${values[l.key]}` : l.raw; });
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) out.push(`${k}=${v}`);
  return out.join('\n').replace(/\n*$/, '\n');
}

// ---------------- plugins and mods (Modrinth) ----------------
async function searchExtensions({ query, version, loader, kind = 'plugin', offset = 0 }) {
  const facets = [[`versions:${version}`], [`categories:${loader}`], [`project_type:${kind}`]];
  const r = await j(`https://api.modrinth.com/v2/search?limit=20&offset=${offset}&query=${encodeURIComponent(query || '')}&facets=${encodeURIComponent(JSON.stringify(facets))}`);
  return r;
}
async function installExtension(id, projectId, { version, loader }, job) {
  const s = getServer(id);
  const vers = await j(`https://api.modrinth.com/v2/project/${projectId}/version?loaders=${encodeURIComponent(JSON.stringify([loader]))}&game_versions=${encodeURIComponent(JSON.stringify([version]))}`);
  if (!vers.length) throw new Error('This project has no release for this Minecraft version and loader.');
  const v = vers[0]; const f = v.files.find((x) => x.primary) || v.files[0];
  const folder = ['fabric', 'forge', 'neoforge', 'quilt'].includes(loader) ? 'mods' : 'plugins';
  if (s.target.kind === 'local' || s.target.kind === 'docker') {
    const dest = path.join(s.dir, folder, f.filename);
    if (fs.existsSync(dest)) throw new Error(`${f.filename} is already installed.`);
    await verifiedDownload(f.url, dest, { algo: 'sha512', value: f.hashes.sha512 }, job);
  } else {
    const r = await remote(s.target, `set -e; mkdir -p ${s.dir}/${folder}; cd ${s.dir}/${folder}; curl -fsSL -o ${q(f.filename)} ${q(f.url)}; sha512sum ${q(f.filename)} | cut -d' ' -f1`, { timeout: 600000 });
    if (r.stdout.trim().split('\n').pop() !== f.hashes.sha512) { await remote(s.target, `rm -f ${s.dir}/${folder}/${q(f.filename)}`); throw new Error('The remote download did not match its SHA-512 and was removed.'); }
  }
  const deps = (v.dependencies || []).filter((d) => d.dependency_type === 'required').map((d) => d.project_id);
  updateServer(id, { history: [...(s.history || []), { at: new Date().toISOString(), action: `Installed ${f.filename}` }] });
  return { file: f.filename, folder, version: v.version_number, requiredDependencies: deps, license: null };
}
async function listExtensions(id) {
  const s = getServer(id);
  const out = [];
  for (const folder of ['plugins', 'mods']) {
    if (s.target.kind === 'local' || s.target.kind === 'docker') { const d = path.join(s.dir, folder); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/\.jar(\.disabled)?$/.test(f)) out.push({ folder, file: f, enabled: !f.endsWith('.disabled'), bytes: fs.statSync(path.join(d, f)).size }); }
    else { const r = await remote(s.target, `ls -1 ${s.dir}/${folder} 2>/dev/null || true`); r.stdout.split('\n').filter((f) => /\.jar(\.disabled)?$/.test(f)).forEach((f) => out.push({ folder, file: f, enabled: !f.endsWith('.disabled') })); }
  }
  return out;
}
async function toggleExtension(id, folder, file, enable) {
  const s = getServer(id);
  if (!['plugins', 'mods'].includes(folder) || file.includes('/') || file.includes('\\')) throw new Error('Bad path');
  const to = enable ? file.replace(/\.disabled$/, '') : file + '.disabled';
  if (s.target.kind === 'local' || s.target.kind === 'docker') fs.renameSync(path.join(s.dir, folder, file), path.join(s.dir, folder, to));
  else await remote(s.target, `mv ${s.dir}/${folder}/${q(file)} ${s.dir}/${folder}/${q(to)}`);
  return { file: to };
}
async function removeExtension(id, folder, file) {
  const s = getServer(id);
  if (!['plugins', 'mods'].includes(folder) || file.includes('/') || file.includes('\\')) throw new Error('Bad path');
  if (s.target.kind === 'local' || s.target.kind === 'docker') { const p = path.join(s.dir, folder, file); fs.mkdirSync(path.join(s.dir, '.removed'), { recursive: true }); fs.renameSync(p, path.join(s.dir, '.removed', `${Date.now()}-${file}`)); }
  else await remote(s.target, `mkdir -p ${s.dir}/.removed && mv ${s.dir}/${folder}/${q(file)} ${s.dir}/.removed/$(date +%s)-${q(file)}`);
  return { removed: file, recoverable: true };
}

// ---------------- worlds and backups ----------------
async function backup(id, job) {
  const s = getServer(id);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (s.target.kind === 'local' || s.target.kind === 'docker') {
    const dir = path.join(s.dir, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `backup-${stamp}.7z`);
    const items = fs.readdirSync(s.dir).filter((f) => !['backups', 'cache', 'libraries', 'logs', '.removed'].includes(f) && !/\.jar$/.test(f));
    if (procs.has(id)) { await command(id, 'save-off').catch(() => {}); await command(id, 'save-all flush').catch(() => {}); await new Promise((r) => setTimeout(r, 3000)); }
    try { await tools.archiveCreate({ files: items.map((f) => path.join(s.dir, f)), dest, format: '7z' }, (p) => emit('progress', { job, phase: 'Backing up', ...p })); }
    finally { if (procs.has(id)) await command(id, 'save-on').catch(() => {}); }
    return { path: dest, bytes: fs.statSync(dest).size };
  }
  const r = await remote(s.target, `cd ${s.dir} && mkdir -p backups && tar --exclude=./backups -czf backups/backup-${stamp}.tgz . && ls -l backups/backup-${stamp}.tgz`, { timeout: 30 * 60000 });
  if (r.code !== 0) throw new Error(r.stderr.trim());
  return { remote: `backups/backup-${stamp}.tgz` };
}
function listBackups(id) {
  const s = getServer(id);
  if (!(s.target.kind === 'local' || s.target.kind === 'docker')) return remote(s.target, `ls -1 ${s.dir}/backups 2>/dev/null || true`).then((r) => r.stdout.split('\n').filter(Boolean).map((f) => ({ file: f })));
  const dir = path.join(s.dir, 'backups');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => ({ file: f, bytes: fs.statSync(path.join(dir, f)).size, at: fs.statSync(path.join(dir, f)).mtime })) : [];
}
async function restore(id, file, job) {
  const s = getServer(id);
  if (procs.has(id) || (await status(id)).state === 'running') throw new Error('Stop the server before restoring a backup.');
  if (file.includes('/') || file.includes('\\')) throw new Error('Bad file');
  const safety = await backup(id, job); // back up the current state first
  if (s.target.kind === 'local' || s.target.kind === 'docker') { await tools.archiveExtract({ file: path.join(s.dir, 'backups', file), dest: s.dir }, (p) => emit('progress', { job, phase: 'Restoring', ...p })); }
  else { const r = await remote(s.target, `cd ${s.dir} && tar -xzf backups/${q(file)}`); if (r.code !== 0) throw new Error(r.stderr.trim()); }
  return { restored: file, safetyBackup: safety.path || safety.remote };
}

// ---------------- world generator ----------------
/** Extracts per-version pickers from the server jar without running a server. */
async function extractWorldgen(id, job) {
  const s = getServer(id);
  if (s.edition === 'bedrock') return { unavailable: true, reason: 'Bedrock has no machine-readable world generator route.' };
  if (s.target.kind !== 'local') return { unavailable: true, reason: 'World generation runs on a local copy of the exact server version; create a local server of the same version to generate.' };
  const out = cacheDir('worldgen', s.version);
  const done = path.join(out, 'pickers.json');
  if (fs.existsSync(done)) return JSON.parse(fs.readFileSync(done, 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  // Use the vanilla server jar of the same version for extraction.
  const r = await resolve('java', 'vanilla', s.version);
  if (r.unavailable) return { unavailable: true, reason: r.reason };
  const jar = path.join(out, 'server.jar');
  if (!fs.existsSync(jar)) await verifiedDownload(r.url, jar, r.digest, job);
  const java = s.java || (await tools.ensureJava(r.java || 21, (p) => emit('progress', { job, ...p }))).java;
  emit('progress', { job, phase: 'Running the data generator (no server is started)' });
  const gen = await execP(java, ['-DbundlerMainClass=net.minecraft.data.Main', '-jar', jar, '--reports', '--output', path.join(out, 'generated')], { timeout: 10 * 60000 });
  const reports = path.join(out, 'generated', 'reports');
  if (!fs.existsSync(reports)) return { unavailable: true, reason: `This version's data generator did not produce reports (${gen.stderr.slice(-200) || 'no output'}). Versions before 1.18 do not ship the bundler route.` };
  emit('progress', { job, phase: 'Reading registries from the jar' });
  const inner = path.join(out, 'inner'); fs.mkdirSync(inner, { recursive: true });
  await tools.sevenZip(['x', jar, `-o${inner}`, 'META-INF/versions/*', '-y']);
  const innerJar = fs.readdirSync(path.join(inner, 'META-INF', 'versions')).map((v) => path.join(inner, 'META-INF', 'versions', v)).flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f))).find((f) => f.endsWith('.jar'));
  const data = path.join(out, 'data'); fs.mkdirSync(data, { recursive: true });
  await tools.sevenZip(['x', innerJar, `-o${data}`, 'data/minecraft/worldgen/*', 'data/minecraft/dimension_type/*', 'version.json', '-y']);
  const stems = (rel) => { const d = path.join(data, 'data', 'minecraft', ...rel.split('/')); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => 'minecraft:' + f.replace(/\.json$/, '')).sort() : []; };
  const registries = JSON.parse(fs.readFileSync(path.join(reports, 'registries.json'), 'utf8'));
  const commands = JSON.parse(fs.readFileSync(path.join(reports, 'commands.json'), 'utf8'));
  const gr = commands.children?.gamerule?.children || {};
  const versionJson = JSON.parse(fs.readFileSync(path.join(data, 'version.json'), 'utf8'));
  const pickers = {
    version: s.version, extractedAt: new Date().toISOString(), jarSha1: r.digest?.value,
    dataPackFormat: versionJson.pack_version?.data ?? versionJson.pack_version,
    worldPresets: stems('worldgen/world_preset'), biomes: stems('worldgen/biome'), structureSets: stems('worldgen/structure_set'),
    flatPresets: stems('worldgen/flat_level_generator_preset'), noiseSettings: stems('worldgen/noise_settings'), dimensionTypes: stems('dimension_type'),
    blocks: Object.keys(registries['minecraft:block']?.entries || {}).sort(),
    gameRules: Object.entries(gr).map(([name, node]) => ({ name, type: node.children?.value?.parser || 'unknown' })),
    commands,
    flatPresetData: Object.fromEntries(stems('worldgen/flat_level_generator_preset').map((id) => [id, JSON.parse(fs.readFileSync(path.join(data, 'data', 'minecraft', 'worldgen', 'flat_level_generator_preset', id.split(':')[1] + '.json'), 'utf8'))]))
  };
  fs.writeFileSync(done, JSON.stringify(pickers));
  return pickers;
}

const genJobs = new Map();
/** Generates a new world from the exact version and writes it to a folder or ZIP. */
async function generateWorld(id, opts, job) {
  const s = getServer(id);
  if (!opts.eulaAccepted) throw Object.assign(new Error('Accept the Minecraft EULA in the generator first.'), { code: 'EULA' });
  const pickers = await extractWorldgen(id, job);
  if (pickers.unavailable) throw new Error(pickers.reason);
  if (fs.existsSync(opts.dest)) throw new Error('The destination already exists. Choose a new name; the generator never overwrites.');
  const ns = 'materialtailscale';
  const stage = path.join(root(), 'staging', `${s.version}-${Date.now()}`);
  const level = 'world';
  fs.mkdirSync(stage, { recursive: true });
  fs.copyFileSync(path.join(cacheDir('worldgen', s.version), 'server.jar'), path.join(stage, 'server.jar'));
  const pack = path.join(stage, level, 'datapacks', 'materialtailscale');
  const wp = path.join(pack, 'data', ns, 'worldgen', 'world_preset');
  fs.mkdirSync(wp, { recursive: true });
  fs.writeFileSync(path.join(pack, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: pickers.dataPackFormat, description: 'Generated by Material Tailscale' } }, null, 2));
  const overworld = opts.preset === 'flat'
    ? { type: 'minecraft:overworld', generator: { type: 'minecraft:flat', settings: { biome: opts.flat.biome, features: !!opts.flat.features, lakes: !!opts.flat.lakes, layers: opts.flat.layers.map((l) => ({ block: l.block, height: Number(l.height) })), structure_overrides: opts.flat.structures?.length ? opts.flat.structures : [] } } }
    : opts.preset === 'single_biome_surface'
      ? { type: 'minecraft:overworld', generator: { type: 'minecraft:noise', biome_source: { type: 'minecraft:fixed', biome: opts.singleBiome }, settings: opts.noiseSettings || 'minecraft:overworld' } }
      : { type: 'minecraft:overworld', generator: { type: 'minecraft:noise', biome_source: { type: 'minecraft:multi_noise', preset: 'minecraft:overworld' }, settings: opts.preset === 'amplified' ? 'minecraft:amplified' : opts.preset === 'large_biomes' ? 'minecraft:large_biomes' : (opts.noiseSettings || 'minecraft:overworld') } };
  fs.writeFileSync(path.join(wp, 'generated.json'), JSON.stringify({ dimensions: { 'minecraft:overworld': overworld, 'minecraft:the_nether': { type: 'minecraft:the_nether', generator: { type: 'minecraft:noise', biome_source: { type: 'minecraft:multi_noise', preset: 'minecraft:nether' }, settings: 'minecraft:nether' } }, 'minecraft:the_end': { type: 'minecraft:the_end', generator: { type: 'minecraft:noise', biome_source: { type: 'minecraft:the_end' }, settings: 'minecraft:end' } } } }, null, 2));
  const port = 40000 + crypto.randomInt(20000);
  const usePreset = ['normal', 'flat', 'large_biomes', 'amplified', 'single_biome_surface'].includes(opts.preset);
  fs.writeFileSync(path.join(stage, 'server.properties'), [`level-name=${level}`, `level-seed=${opts.seed || ''}`, `level-type=${usePreset ? `${ns}\\:generated` : 'minecraft\\:' + String(opts.preset).replace(/^minecraft:/, '')}`, `generate-structures=${opts.structures !== false}`, `difficulty=${opts.difficulty || 'normal'}`, `gamemode=${opts.gamemode || 'survival'}`, `hardcore=${!!opts.hardcore}`, 'spawn-protection=0', `server-port=${port}`, 'server-ip=127.0.0.1', 'online-mode=false', 'max-players=1', 'enable-rcon=false'].join('\n') + '\n');
  fs.writeFileSync(path.join(stage, 'eula.txt'), `# Accepted in Material Tailscale world generator by the user on ${new Date().toISOString()}\neula=true\n`);
  const java = s.java || (await tools.ensureJava((await resolve('java', 'vanilla', s.version)).java || 21)).java;
  const p = spawn(java, ['-Xmx2G', '-jar', 'server.jar', 'nogui'], { cwd: stage, windowsHide: true });
  const state = { p, cancelled: false };
  genJobs.set(job, state);
  let buffer = '';
  const waiters = [];
  const onLine = (l) => { emit('log', { id, line: `[generator] ${l}`, stream: 'out' }); for (const w of [...waiters]) if (w.re.test(l)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(l); } };
  p.stdout.on('data', (d) => { buffer += d; const parts = buffer.split(/\r?\n/); buffer = parts.pop(); parts.forEach(onLine); });
  p.stderr.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach(onLine));
  const waitFor = (re, ms) => new Promise((resolve, reject) => { const w = { re, resolve }; waiters.push(w); setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error(`Timed out waiting for the server (${re}).`)); } }, ms); });
  const send = (c) => p.stdin.write(c + '\n');
  const exited = new Promise((r) => p.on('close', r));
  try {
    emit('progress', { job, phase: 'Starting the generator server' });
    await Promise.race([waitFor(/Done \(/, 15 * 60000), exited.then(() => { throw new Error('The server exited during start-up. Check the log for the reason.'); })]);
    for (const [rule, v] of Object.entries(opts.gameRules || {})) send(`gamerule ${rule} ${v}`);
    if (opts.spawn) send(`setworldspawn ${opts.spawn.x} ${opts.spawn.y ?? 100} ${opts.spawn.z}`);
    const { cx = 0, cz = 0, w = 100, d = 100 } = opts.area || {};
    if (opts.borderFollows !== false) { send(`worldborder center ${cx * 16 + 8} ${cz * 16 + 8}`); send(`worldborder set ${Math.max(w, d) * 16}`); }
    const x0 = cx - Math.floor(w / 2), z0 = cz - Math.floor(d / 2);
    const batches = [];
    for (let x = 0; x < w; x += 16) for (let z = 0; z < d; z += 16) batches.push([x0 + x, z0 + z, x0 + Math.min(x + 16, w) - 1, z0 + Math.min(z + 16, d) - 1]);
    let n = 0;
    for (const [ax, az, bx, bz] of batches) {
      if (state.cancelled) throw new Error('Generation was cancelled between batches. The staging folder was removed; nothing was written to the destination.');
      if ((bx - ax + 1) * (bz - az + 1) > 256) throw new Error('Internal error: a forceload rectangle exceeded 256 chunks.');
      send(`forceload add ${ax * 16} ${az * 16} ${bx * 16 + 15} ${bz * 16 + 15}`);
      // Wait until the far corner chunk reports loaded, then release the batch.
      const probe = `execute if loaded ${bx * 16 + 8} 64 ${bz * 16 + 8} run say mt-loaded-${n}`;
      let ok = false;
      for (let tries = 0; tries < 240 && !ok && !state.cancelled; tries++) { send(probe); ok = await waitFor(new RegExp(`mt-loaded-${n}`), 1500).then(() => true, () => false); }
      send('forceload remove all');
      n++;
      emit('progress', { job, phase: `Generated batch ${n} of ${batches.length}`, percent: (n / batches.length) * 100 });
    }
    send('save-all flush'); await waitFor(/Saved the game|Saved the world/i, 5 * 60000).catch(() => {});
    send('stop'); await exited;
    emit('progress', { job, phase: 'Copying and verifying the world' });
    const src = path.join(stage, level);
    const manifest = digestTree(src);
    if (opts.output === 'zip') {
      const tmp = opts.dest + '.partial.zip';
      await tools.archiveCreate({ files: [src], dest: tmp, format: 'zip' });
      const list = await tools.archiveList(tmp);
      if (list.filter((e) => e.Folder !== '+').length < Object.keys(manifest).length) throw new Error('The ZIP is missing files compared with the generated world.');
      fs.renameSync(tmp, opts.dest);
    } else {
      fs.cpSync(src, opts.dest, { recursive: true, errorOnExist: true, force: false });
      const copy = digestTree(opts.dest);
      for (const [f, h] of Object.entries(manifest)) if (copy[f] !== h) throw new Error(`Verification failed for ${f}; the copy differs from the generated world.`);
    }
    fs.rmSync(stage, { recursive: true, force: true });
    return { dest: opts.dest, files: Object.keys(manifest).length, batches: batches.length, chunks: w * d, verified: true };
  } catch (e) {
    try { send('stop'); } catch { /* already gone */ }
    setTimeout(() => { try { p.kill(); } catch { /* gone */ } fs.rmSync(stage, { recursive: true, force: true }); }, 15000);
    throw e;
  } finally { genJobs.delete(job); }
}
function cancelGenerate(job) { const s = genJobs.get(job); if (s) s.cancelled = true; return !!s; }
function digestTree(dir) {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name !== 'session.lock') out[path.relative(dir, p).replace(/\\/g, '/')] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } };
  walk(dir);
  return out;
}

// ---------------- players ----------------
async function lookupPlayer(name) {
  const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, { headers: UA });
  if (r.status === 404 || r.status === 204) return { found: false };
  const p = await r.json();
  return { found: true, name: p.name, uuid: p.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5') };
}

async function remove(id, { deleteFiles } = {}) {
  const s = getServer(id);
  if ((await status(id)).state === 'running') throw new Error('Stop the server first.');
  if (s.container) await docker(s.target, ['rm', s.container]).catch(() => {});
  if (deleteFiles && s.target.kind === 'local' && s.dir?.startsWith(path.join(root(), 'servers'))) fs.rmSync(s.dir, { recursive: true, force: true });
  const reg = loadRegistry(); reg.servers = reg.servers.filter((x) => x.id !== id); saveRegistry(reg);
  return { removed: id, filesDeleted: !!deleteFiles };
}

module.exports = { setEmitter, loadRegistry, getServer, updateServer, catalog, resolve, probeTarget, discover, create, adopt, acceptEula, start, stop, command, status, readFile, writeFile, parseProps, serializeProps, searchExtensions, installExtension, listExtensions, toggleExtension, removeExtension, backup, listBackups, restore, extractWorldgen, generateWorld, cancelGenerate, lookupPlayer, remove, followLogs };
