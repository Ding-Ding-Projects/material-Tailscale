// Confirms the maintainer's private agent instructions have not changed since
// this repository's guide was last reviewed against them. The private source
// is never in this repository; when it is not available (CI, contributors)
// the check is skipped with the reason printed. Only a SHA-256 is stored.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockFile = path.join(root, '.instructions-lock');
const source = process.env.MT_PRIVATE_INSTRUCTIONS;
if (!source || !fs.existsSync(source)) {
  console.log('Skipped: the private instructions are not available on this machine (set MT_PRIVATE_INSTRUCTIONS to their path to check).');
  process.exit(0);
}
const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
if (process.argv.includes('--update')) { fs.writeFileSync(lockFile, hash + '\n'); console.log(`Locked ${hash.slice(0, 12)}…`); process.exit(0); }
const locked = fs.existsSync(lockFile) ? fs.readFileSync(lockFile, 'utf8').trim() : '';
if (locked === hash) { console.log('Instructions unchanged since the last review.'); process.exit(0); }
console.error('The private instructions changed since this repository was last reviewed against them. Review AGENTS.md, then run with --update.');
process.exit(1);
