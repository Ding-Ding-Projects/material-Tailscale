// Records an end-to-end path through the built app and writes an animated GIF.
// Usage: npm run build && xvfb-run -a node scripts/record.mjs [out.gif]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import sharp from 'sharp';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs', 'recording', 'end-to-end.gif'));
const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-record-'));
const r = spawnSync(electron, [root, '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { stdio: 'inherit', env: { ...process.env, MT_RECORD_DIR: frames } });
if (r.status) process.exit(r.status);
const files = fs.readdirSync(frames).filter((f) => f.endsWith('.png')).sort();
if (!files.length) { console.error('No frames were recorded.'); process.exit(1); }
const gif = GIFEncoder();
let width, height;
for (const f of files) {
  const { data, info } = await sharp(path.join(frames, f)).resize({ width: 720 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  width = info.width; height = info.height;
  const palette = quantize(data, 256);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 120 });
}
gif.finish();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, gif.bytes());
fs.rmSync(frames, { recursive: true, force: true });
console.log(`${files.length} frames, ${width}x${height}, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB -> ${out}`);
