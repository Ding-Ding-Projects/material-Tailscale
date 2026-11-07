// Runs the built app through every destination at several display scales,
// language modes and themes, plus the minimum window size, and reports any
// visible text that is cut off. Usage: npm run build && xvfb-run -a node scripts/clip-matrix.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.MT_CLIP_DIR || path.join(root, 'out', 'clipping');
const scales = (process.env.MT_CLIP_SCALES || '1,1.25,1.5,2').split(',');
const langs = (process.env.MT_CLIP_LANGS || 'en,yue,both').split(',');
const sizes = [['1440', '940'], ['960', '640']];
const report = [];
for (const [w, hgt] of sizes) for (const z of scales) for (const lang of langs) {
  if (w === '960' && z !== '1') continue; // minimum window at 100% only
  const dir = path.join(base, `${w}x${hgt}-${Math.round(z * 100)}-${lang}`);
  const r = spawnSync(electron, [root, '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { stdio: 'ignore', env: { ...process.env, MT_CAPTURE_DIR: dir, MT_CAPTURE_W: w, MT_CAPTURE_H: hgt, MT_CAPTURE_ZOOM: z, MT_CAPTURE_LANG: lang, MT_CAPTURE_CLIP: '1', MT_CAPTURE_THEMES: process.env.MT_CLIP_THEMES || 'dark', MT_CAPTURE_PALETTE: '0' } });
  let found = [];
  try { found = JSON.parse(fs.readFileSync(path.join(dir, 'clipping.json'), 'utf8')); } catch { found = [{ error: `capture exited with ${r.status}` }]; }
  const count = found.reduce((n, x) => n + (x.found?.length || 1), 0);
  report.push({ size: `${w}x${hgt}`, scale: `${Math.round(z * 100)}%`, lang, issues: count, details: found });
  console.log(`${w}x${hgt} ${Math.round(z * 100)}% ${lang}: ${count} clipped element(s)`);
}
fs.mkdirSync(base, { recursive: true });
fs.writeFileSync(path.join(base, 'report.json'), JSON.stringify(report, null, 2));
const total = report.reduce((n, x) => n + x.issues, 0);
console.log(`Total: ${total}. Report: ${path.join(base, 'report.json')}`);
process.exit(total ? 1 : 0);
