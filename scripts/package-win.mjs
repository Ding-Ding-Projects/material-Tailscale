// Packages the app with @electron/packager and builds a genuine
// Squirrel.Windows installer (Setup.exe, RELEASES, full .nupkg, and a delta
// when the previous release's .nupkg is supplied). Code signing is never used:
// every signing input is cleared and Setup.exe is verified as NotSigned.
//
// Delta packages: when MT_PREVIOUS_RELEASE names a published tag, its RELEASES
// index and its newest full package are downloaded first, so Squirrel builds a
// delta from that release. Afterwards the seeded package is removed and RELEASES
// lists only the packages this release ships (its full package and that one
// delta). Clients a version behind take the delta; older clients fall back to
// the full package, which Update.exe does on its own. Each release therefore
// stays the same size instead of carrying every historic package.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';
import { createWindowsInstaller } from 'electron-winstaller';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.MT_VERSION || pkg.version;
const out = path.join(root, 'out');
const t0 = Date.now();
for (const k of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'SIGNTOOL_PATH']) delete process.env[k];

console.log(`[1/4] Packaging ${pkg.productName} ${version}`);
const [appDir] = await packager({
  dir: root, out: path.join(out, 'packaged'), overwrite: true, platform: 'win32', arch: 'x64',
  name: 'MaterialTailscale', executableName: 'MaterialTailscale', appVersion: version, buildVersion: version,
  icon: path.join(root, 'assets/icon.ico'), asar: { unpack: '**/node_modules/{ffmpeg-static,7zip-bin}/**' }, prune: true,
  ignore: [/^\/(out|design|docs|site|site-dist|vendor|scripts|test|\.github|src\/renderer)(\/|$)/, /^\/assets\/fonts(\/|$)/, /\.md$/, /\/node_modules\/7zip-bin\/(mac|linux)\//],
  win32metadata: { CompanyName: 'Ding-Ding-Projects', FileDescription: 'Material Tailscale', ProductName: 'Material Tailscale', InternalName: 'MaterialTailscale' }
});

console.log('[2/4] Building the Squirrel.Windows installer');
const installerDir = path.join(out, 'installer');
fs.mkdirSync(installerDir, { recursive: true });
const releasesFile = path.join(installerDir, 'RELEASES');
const parseReleases = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
  const [sha1, file, size] = line.replace(/^\uFEFF/, '').split(/\s+/);
  const m = /-(\d+(?:\.\d+)*)-(full|delta)\.nupkg$/i.exec(file || '');
  return { line, sha1, file, size: Number(size), version: m ? m[1].split('.').map(Number) : null, kind: m?.[2]?.toLowerCase() };
});
const newer = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d > 0; } return false; };
const gh = (args) => {
  for (let attempt = 1; ; attempt++) {
    try { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) {
      const msg = String(e.stderr || e.message);
      if (attempt >= 4 || !/HTTP (403|429|5\d\d)|timeout|connection/i.test(msg)) throw new Error(`gh ${args.join(' ')} failed: ${msg}`);
      console.log(`gh attempt ${attempt} failed; retrying in ${attempt * 20} s`);
      execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${attempt * 20000})`]);
    }
  }
};
let seeded = null;
const previous = process.env.MT_PREVIOUS_RELEASE;
if (previous) {
  for (const f of fs.readdirSync(installerDir)) if (f === 'RELEASES' || /\.nupkg$/i.test(f)) fs.rmSync(path.join(installerDir, f));
  gh(['release', 'download', previous, '--pattern', 'RELEASES', '--dir', installerDir, '--clobber']);
  const fulls = parseReleases(fs.readFileSync(releasesFile, 'utf8')).filter((e) => e.kind === 'full' && e.version);
  const latest = fulls.reduce((a, b) => (!a || newer(b.version, a.version) ? b : a), null);
  if (!latest) { fs.rmSync(releasesFile); console.log(`No full package listed in ${previous}; building without a delta.`); }
  else {
    gh(['release', 'download', previous, '--pattern', latest.file, '--dir', installerDir, '--clobber']);
    const got = fs.statSync(path.join(installerDir, latest.file)).size;
    if (got !== latest.size) throw new Error(`${latest.file} from ${previous} is ${got} bytes; RELEASES says ${latest.size}`);
    seeded = latest.file;
    console.log(`Delta base: ${latest.file} from ${previous} (${got} bytes)`);
  }
}
await createWindowsInstaller({
  appDirectory: appDir, outputDirectory: installerDir, authors: 'Ding-Ding-Projects', owners: 'Ding-Ding-Projects',
  exe: 'MaterialTailscale.exe', name: 'MaterialTailscale', title: 'Material Tailscale', description: pkg.description,
  version, setupExe: 'MaterialTailscaleSetup.exe', setupIcon: path.join(root, 'assets/icon.ico'), iconUrl: 'https://raw.githubusercontent.com/Ding-Ding-Projects/material-Tailscale/main/assets/icon.ico',
  noMsi: true, certificateFile: undefined, signWithParams: undefined, windowsSign: undefined
});
if (seeded) fs.rmSync(path.join(installerDir, seeded));
if (fs.existsSync(releasesFile)) {
  const entries = parseReleases(fs.readFileSync(releasesFile, 'utf8'));
  const kept = entries.filter((e) => e.file && fs.existsSync(path.join(installerDir, e.file)));
  if (!kept.some((e) => e.kind === 'full')) throw new Error('RELEASES lists no full package that this release ships');
  fs.writeFileSync(releasesFile, kept.map((e) => e.line).join('\n'));
  console.log(`RELEASES lists ${kept.length} package(s): ${kept.map((e) => e.file).join(', ')}`);
}

console.log('[3/4] Verifying the installer is unsigned');
const setup = path.join(installerDir, 'MaterialTailscaleSetup.exe');
if (!fs.existsSync(setup)) throw new Error('Setup.exe was not produced');
if (process.platform === 'win32') {
  const status = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${setup}').Status`], { encoding: 'utf8' }).trim();
  if (status !== 'NotSigned') throw new Error(`Expected NotSigned, got ${status}`);
  console.log('Signature status: NotSigned');
}
console.log('[4/4] Artifacts:', fs.readdirSync(installerDir).join(', '), `in ${Math.round((Date.now() - t0) / 1000)} s`);
