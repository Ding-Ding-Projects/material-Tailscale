// Contact sheets of the design reference frames, four views to a sheet in inventory order, one
// set per canvas, made from the design-parity reference captures (dark, 1440 by 960, scale 1).
//   node scripts/design-frames.mjs     (after npm run design:parity)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'design', 'frames');
const inv = JSON.parse(fs.readFileSync(path.join(root, 'docs/design-parity/inventory.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.webp'))) fs.rmSync(path.join(out, f));
const W = 720, H = 480, LABEL = 40;
const label = (text) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#10131f"/><text x="14" y="26" font-family="sans-serif" font-size="17" font-weight="700" fill="#e6e8f2">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
let made = 0;
for (const [canvas, prefix] of [['design/canvas/', ''], ['design/additions/', 'additions-']]) {
  const views = inv.screens.filter((s) => s.reference.startsWith(canvas));
  for (let i = 0; i < views.length; i += 4) {
    const group = views.slice(i, i + 4);
    const tiles = await Promise.all(group.map(async (s, k) => [
      { input: label(`${path.basename(s.reference, '.dc.html')} · ${s.view}`), left: (k % 2) * W, top: Math.floor(k / 2) * (H + LABEL) },
      { input: await sharp(path.join(root, s.captures.reference)).resize(W, H).png().toBuffer(), left: (k % 2) * W, top: Math.floor(k / 2) * (H + LABEL) + LABEL }
    ]));
    const name = `${prefix}${String(i / 4 + 1).padStart(2, '0')}-${group[0].view}-to-${group[group.length - 1].view}.webp`;
    await sharp({ create: { width: W * 2, height: (H + LABEL) * Math.ceil(group.length / 2), channels: 3, background: '#0b0f1a' } }).composite(tiles.flat()).webp({ quality: 80 }).toFile(path.join(out, name));
    made++;
  }
}
console.log(`${made} contact sheets in design/frames.`);
