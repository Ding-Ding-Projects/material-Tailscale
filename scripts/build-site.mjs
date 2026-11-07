// Builds the website into site-dist/: bundles site/site.js (which reuses the
// app's renderer modules), copies styles, fonts, icon, screenshots and the social
// preview, and writes site-data.js with provenance and the latest verified
// release (only a published, non-draft release with a Setup.exe counts).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'styles'), { recursive: true });
execFileSync(process.execPath, [path.join(root, 'scripts/build-renderer.mjs')], { stdio: 'inherit', cwd: root, env: { ...process.env, MT_SKIP_APP_BUNDLE: '1' } });
const esbuild = (await import('esbuild')).default;
await esbuild.build({ entryPoints: [path.join(root, 'site/site.js')], bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', outfile: path.join(out, 'site.js'), external: ['node:crypto'], minify: true, logLevel: 'warning' });
for (const css of ['tokens.css', 'app.css', 'mesh2.css']) fs.copyFileSync(path.join(root, 'src/renderer/styles', css), path.join(out, 'styles', css));
fs.copyFileSync(path.join(root, 'site/site.css'), path.join(out, 'styles/site.css'));
fs.copyFileSync(path.join(root, 'site/index.html'), path.join(out, 'index.html'));
fs.cpSync(path.join(root, 'assets/fonts'), path.join(out, 'fonts'), { recursive: true });
fs.copyFileSync(path.join(root, 'social-preview.png'), path.join(out, 'social-preview.png'));
if (fs.existsSync(path.join(root, 'assets/icon.png'))) fs.copyFileSync(path.join(root, 'assets/icon.png'), path.join(out, 'icon.png'));
fs.copyFileSync(path.join(root, 'src/shared/api-catalog.json'), path.join(out, 'api-catalog.json'));
const shotsDir = path.join(root, 'docs/screenshots');
// The hero captures are the home page's own picture, not gallery entries.
const shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter((f) => f.endsWith('.png') && !f.endsWith('-hero.png')).sort() : [];
fs.cpSync(shotsDir, path.join(out, 'screenshots'), { recursive: true });
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; } };
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let release = null;
const fromApi = (j) => {
  const exe = j.assets?.find((a) => /Setup\.exe$/i.test(a.name));
  return !j.draft && exe ? { tag: j.tag_name, publishedAt: j.published_at, codeName: (j.name || '').split(' · ').slice(1).join(' · ') || null, assets: j.assets.map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })) } : null;
};
if (process.env.MT_RELEASE_JSON) {
  // A release JSON saved from the GitHub API, for builds where the API is not reachable directly.
  release = fromApi(JSON.parse(fs.readFileSync(process.env.MT_RELEASE_JSON, 'utf8')));
} else {
  try {
    const headers = { 'User-Agent': 'material-tailscale-site', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) };
    const r = await fetch('https://api.github.com/repos/Ding-Ding-Projects/material-Tailscale/releases/latest', { headers });
    if (r.ok) release = fromApi(await r.json());
  } catch { /* offline: the download button stays absent */ }
}
const site = { version: release?.tag || `v${pkg.version}`, commit: process.env.GITHUB_SHA || git('rev-parse', 'HEAD'), commitTime: git('log', '-1', '--format=%cI'), screenshots: shots };
fs.writeFileSync(path.join(out, 'site-data.js'), `window.__SITE__=${JSON.stringify(site)};window.__RELEASE__=${JSON.stringify(release)};\n`);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Site built: ${shots.length} screenshots, release ${release?.tag || 'none'}`);
