// Packages the app with @electron/packager and builds a genuine
// Squirrel.Windows installer (Setup.exe, RELEASES, full .nupkg, and a delta
// when the previous release's .nupkg is supplied). Code signing is never used:
// every signing input is cleared and Setup.exe is verified as NotSigned.
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
await createWindowsInstaller({
  appDirectory: appDir, outputDirectory: installerDir, authors: 'Ding-Ding-Projects', owners: 'Ding-Ding-Projects',
  exe: 'MaterialTailscale.exe', name: 'MaterialTailscale', title: 'Material Tailscale', description: pkg.description,
  version, setupExe: 'MaterialTailscaleSetup.exe', setupIcon: path.join(root, 'assets/icon.ico'), iconUrl: 'https://raw.githubusercontent.com/Ding-Ding-Projects/material-Tailscale/main/assets/icon.ico',
  noMsi: true, remoteReleases: process.env.MT_REMOTE_RELEASES || undefined, certificateFile: undefined, signWithParams: undefined, windowsSign: undefined
});

console.log('[3/4] Verifying the installer is unsigned');
const setup = path.join(installerDir, 'MaterialTailscaleSetup.exe');
if (!fs.existsSync(setup)) throw new Error('Setup.exe was not produced');
if (process.platform === 'win32') {
  const status = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${setup}').Status`], { encoding: 'utf8' }).trim();
  if (status !== 'NotSigned') throw new Error(`Expected NotSigned, got ${status}`);
  console.log('Signature status: NotSigned');
}
console.log('[4/4] Artifacts:', fs.readdirSync(installerDir).join(', '), `in ${Math.round((Date.now() - t0) / 1000)} s`);
