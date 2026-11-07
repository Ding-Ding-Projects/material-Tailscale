// Photographs both portable companions from their staged folders (made by build-companions.mjs)
// with Playwright's Electron driver: the build companion's window and the offline website's
// home and Features pages, in dark and light. Needs a display (xvfb-run on Linux).
//   NODE_PATH=$(npm root -g) xvfb-run -a node scripts/capture-companions.mjs <output folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'out', 'companion-shots'));
fs.mkdirSync(out, { recursive: true });
const electronPath = require('electron');
const shots = [];
for (const theme of ['dark', 'light']) {
  for (const [name, dir, routes] of [['build', 'stage-build', ['']], ['site', 'stage-site', ['#/home', '#/features']]]) {
    const app = await _electron.launch({ executablePath: electronPath, args: [path.join(root, 'out', 'companions', dir), '--no-sandbox', '--disable-gpu'], colorScheme: theme });
    const win = await app.firstWindow();
    await win.setViewportSize({ width: 1180, height: 820 });
    for (const r of routes) {
      if (r) { await win.evaluate((h) => { location.hash = h; }, r); }
      if (name === 'site') await win.evaluate((t) => { try { localStorage.setItem('mt.theme.pref', t); } catch { /* none */ } document.documentElement.dataset.theme = t; }, theme);
      await win.waitForTimeout(1500);
      const file = path.join(out, `${theme}-companion-${name}${r ? '-' + r.replace(/[#/]/g, '') : ''}.png`);
      await win.screenshot({ path: file });
      shots.push(path.basename(file));
    }
    await app.close();
  }
}
console.log(`${shots.length} companion captures in ${out}: ${shots.join(', ')}`);
