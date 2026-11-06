// Launches the built app in capture mode: it walks every destination in both
// themes and writes PNGs to MT_CAPTURE_DIR (default out/screenshots).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.MT_CAPTURE_DIR || path.join(root, 'out', 'screenshots');
const r = spawnSync(electron, [root, '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { stdio: 'inherit', env: { ...process.env, MT_CAPTURE_DIR: dir } });
console.log(`Screenshots in ${dir}`);
process.exit(r.status ?? 1);
