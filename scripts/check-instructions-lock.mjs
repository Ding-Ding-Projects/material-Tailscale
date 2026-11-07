// Confirms the maintainer's private agent instructions have not changed since the sanitised
// mirror in AGENTS.md and README.md was last reviewed against them. Like the wording lock, this
// repository stores neither the instructions nor their hash: the lock file sits beside the
// private source, outside every public repository. When the source is not on this machine (CI,
// contributors) the check is skipped with the reason printed.
//   node scripts/check-instructions-lock.mjs            check
//   node scripts/check-instructions-lock.mjs --update   after reviewing the mirror, record the
//                                                       current hash beside the source
// MT_PRIVATE_INSTRUCTIONS may name the source explicitly; otherwise the same places the wording
// lock searches are used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { candidates, section } from './check-vocabulary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const mirrorLockFor = (source) => path.join(path.dirname(source), path.basename(source).replace(/\.md$/i, '') + '.mirror.lock');

export function checkMirror({ update = false, explicit = process.env.MT_PRIVATE_INSTRUCTIONS, list = candidates() } = {}) {
  const readable = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const source = explicit ? (readable(explicit) ? explicit : null) : list.find((p) => { try { return section(fs.readFileSync(p, 'utf8')) !== null; } catch { return false; } });
  if (!source) return { code: 0, state: 'skipped', message: 'Skipped: the private instructions are not on this machine (set MT_PRIVATE_INSTRUCTIONS to their path to check).' };
  const lockFile = mirrorLockFor(source);
  if (path.resolve(lockFile).startsWith(root + path.sep)) return { code: 1, state: 'refused', message: 'The lock would be written inside this repository; it must stay beside the private source.' };
  const sum = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  if (update) {
    fs.writeFileSync(lockFile, JSON.stringify({ sha256: sum, reviewedAt: new Date().toISOString() }, null, 2) + '\n');
    return { code: 0, state: 'locked', message: `Mirror review recorded beside the private source (${sum.slice(0, 8)}…).` };
  }
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(lockFile, 'utf8')).sha256; } catch { /* missing */ }
  if (!saved) return { code: 1, state: 'unlocked', message: 'The mirror has never been reviewed against this source. Review AGENTS.md and README.md, then run with --update.' };
  if (saved !== sum) return { code: 1, state: 'stale', message: 'The private instructions changed since the mirror was last reviewed. Review AGENTS.md and README.md, then run with --update.' };
  return { code: 0, state: 'current', message: 'Instructions unchanged since the mirror was last reviewed.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkMirror({ update: process.argv.includes('--update') });
  (r.code ? console.error : console.log)(r.message);
  process.exit(r.code);
}
