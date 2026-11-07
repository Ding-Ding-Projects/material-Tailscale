// Writes docs/completeness.md from the feature inventory; --check fails when it is stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { render } from './lib/completeness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = await import(pathToFileURL(path.join(root, 'src/shared/feature-inventory.js')).href);
const file = path.join(root, 'docs/completeness.md');
const text = render(inv);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('docs/completeness.md is stale: run npm run gen:completeness'); process.exit(1); }
  console.log('docs/completeness.md is current.');
} else { fs.writeFileSync(file, text); console.log(`Wrote docs/completeness.md (${inv.FEATURES.length} features).`); }
