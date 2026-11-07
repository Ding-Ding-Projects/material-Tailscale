// Builds the two portable companions as single Windows .exe files with electron-builder's
// portable target: the build companion (Build, Build and run, Build installer over build.bat and
// build-installer.bat, carrying the commit's complete source as source.zip) and the offline
// website (the whole site-dist folder). Both are unsigned: executable editing and signing are
// turned off, and on Windows each result is checked to report NotSigned.
//   npm run build && node scripts/build-site.mjs && node scripts/build-companions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out', 'companions');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const electronVersion = require('electron/package.json').version;
const { build, Platform, Arch } = require('electron-builder');

const copy = (from, to) => fs.cpSync(path.join(root, from), to, { recursive: true });
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();

function stage(name, files) {
  const dir = path.join(out, `stage-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [from, to] of files) copy(from, path.join(dir, to));
  return dir;
}

async function make(name, productName, appDir, artifact, extraResources = []) {
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: `material-tailscale-${name}`, productName, version: pkg.version, description: `${productName}, a portable companion to Material Tailscale.`, author: pkg.author, license: pkg.license, main: 'main.js' }, null, 2));
  const files = await build({
    targets: Platform.WINDOWS.createTarget(['portable'], Arch.x64),
    projectDir: appDir,
    config: {
      appId: `io.github.ding-ding-projects.material-tailscale.${name}`,
      productName,
      electronVersion,
      directories: { app: appDir, output: path.join(out, `dist-${name}`) },
      files: ['**/*', '!dist-*'],
      extraResources,
      asar: true,
      npmRebuild: false,
      compression: 'normal',
      // Never signed: no executable editing, no signing, and a signing certificate is never looked for.
      forceCodeSigning: false,
      // On Windows the icon and version details are written into the program (signing stays off);
      // elsewhere the program is left unedited, because editing it there needs Wine.
      win: process.platform === 'win32' ? { signExecutable: false, icon: path.join(root, 'assets', 'icon.ico'), artifactName: artifact } : { signAndEditExecutable: false, artifactName: artifact },
      publish: null,
      portable: { artifactName: artifact }
    }
  });
  const exe = files.find((f) => f.endsWith('.exe'));
  if (!exe) throw new Error(`${name}: electron-builder produced no .exe (${files.join(', ')})`);
  const dest = path.join(out, path.basename(exe));
  fs.copyFileSync(exe, dest);
  if (process.platform === 'win32') {
    const status = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${dest.replace(/'/g, "''")}').Status`], { encoding: 'utf8' }).trim();
    if (status !== 'NotSigned') throw new Error(`${dest} reports ${status}; companions must be unsigned.`);
    console.log(`${path.basename(dest)}: signature status ${status}`);
  }
  return dest;
}

fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(root, 'site-dist', 'index.html'))) throw new Error('Build the website first: node scripts/build-site.mjs');

// Build companion: the window, the app's stylesheets and fonts, and the commit's whole source.
const buildDir = stage('build', [['companions/build', '.'], ['src/renderer/styles/tokens.css', 'styles/tokens.css'], ['src/renderer/styles/app.css', 'styles/app.css'], ['src/renderer/styles/mesh2.css', 'styles/mesh2.css'], ['site-dist/fonts', 'fonts']]);
const zip = path.join(out, 'source.zip');
fs.rmSync(zip, { force: true });
git('archive', '--format=zip', '-o', zip, 'HEAD');
const commit = git('rev-parse', 'HEAD');
const fileCount = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean).length;
fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify({ commit, version: pkg.version, files: fileCount, made: new Date().toISOString() }, null, 2));
// --stage-only lays both companions out for photographs and parity without packaging them.
const stageOnly = process.argv.includes('--stage-only');
const siteStage = () => stage('site', [['companions/site', '.'], ['site-dist', 'site']]);
if (stageOnly) {
  for (const [dir, name] of [[buildDir, 'build'], [siteStage(), 'site']]) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `material-tailscale-${name}`, version: pkg.version, main: 'main.js' }, null, 2));
  console.log('Staged both companions in out/companions (not packaged).');
  process.exit(0);
}
const buildExe = await make('build', 'Material Tailscale Build Companion', buildDir, `MaterialTailscaleBuildCompanion-${pkg.version}.exe`, [{ from: zip, to: 'source.zip' }, { from: path.join(out, 'source.json'), to: 'source.json' }]);

// Offline website: the built site, every article included.
const siteDir = siteStage();
const siteExe = await make('site', 'Material Tailscale Offline Website', siteDir, `MaterialTailscaleOfflineWebsite-${pkg.version}.exe`);

for (const f of [buildExe, siteExe]) console.log(`${path.relative(root, f)}  ${(fs.statSync(f).size / 1048576).toFixed(1)} MB`);
console.log(`Build companion carries commit ${commit.slice(0, 12)} (${fileCount} files).`);
