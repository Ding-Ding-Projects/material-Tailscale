// Generates every packaged icon from the committed master assets/logo.svg:
// icon.png (512), tray.png (32), and a multi-resolution icon.ico for Windows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets/logo.svg'));
const out = (n) => path.join(root, 'assets', n);
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(out('icon.png'));
await sharp(svg, { density: 384 }).resize(32, 32).png().toFile(out('tray.png'));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()));
fs.writeFileSync(out('icon.ico'), await pngToIco(pngs));
console.log('Icons written: icon.png, tray.png, icon.ico', sizes.join(','));
