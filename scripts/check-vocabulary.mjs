// Wording lock. The maintainer keeps private wording rules outside this repository; builds and
// pushes check that whoever runs them holds the current rules. This file stores neither the rules
// nor their hash: at run time it finds the private source, hashes the rules section, and compares
// the hash with a lock file kept beside that source. A changed source fails the check until
// someone reads it and re-locks it with --lock.
//
// No private source on this machine (an outside contributor, or CI): the check is skipped and
// says why. A source whose lock is missing or stale: the check fails.
//   node scripts/check-vocabulary.mjs          check
//   node scripts/check-vocabulary.mjs --lock   record the current hash beside the source
// It cannot see whether anyone uses the rules in conversation; it only proves the current rules
// are present and were re-locked after the last change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADING = '## Vocabulary and locations';

/** Candidate private sources, in order. Each is checked for the rules section before use. */
export function candidates(env = process.env, home = os.homedir()) {
  // A checkout of the private instructions next to this one, found by its layout, not its name.
  const parent = path.dirname(root);
  let siblings = [];
  try { siblings = fs.readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).slice(0, 300).map((d) => path.join(parent, d.name, 'memory', 'SHARED_INSTRUCTIONS.md')); } catch { /* none */ }
  // Installed copies of the same rules for coding assistants on this machine.
  const rulesDir = path.join(home, '.claude', 'rules');
  let rules = [];
  try { rules = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(rulesDir, f)); } catch { /* none */ }
  return [
    env.UH_ROOT && path.join(env.UH_ROOT, 'memory', 'SHARED_INSTRUCTIONS.md'),
    ...siblings,
    ...rules,
    path.join(home, '.codex', 'AGENTS.md')
  ].filter(Boolean);
}
/** The rules section: from its heading to the next second-level heading. Null when absent. */
export function section(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === HEADING);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join('\n').trim() + '\n';
}
export const digest = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
export const lockPathFor = (source) => path.join(path.dirname(source), path.basename(source).replace(/\.md$/i, '') + '.wording.lock');

export function check({ lock = false, list = candidates() } = {}) {
  const source = list.find((p) => { try { return section(fs.readFileSync(p, 'utf8')) !== null; } catch { return false; } });
  if (!source) return { code: 0, state: 'skipped', message: 'Wording lock skipped: no private wording source on this machine.' };
  const sum = digest(section(fs.readFileSync(source, 'utf8')));
  const lockFile = lockPathFor(source);
  if (path.resolve(lockFile).startsWith(root + path.sep)) return { code: 1, state: 'refused', message: 'The lock would be written inside this repository; it must stay beside the private source.' };
  if (lock) {
    fs.writeFileSync(lockFile, JSON.stringify({ sha256: sum, lockedAt: new Date().toISOString() }, null, 2) + '\n');
    return { code: 0, state: 'locked', message: `Wording lock recorded beside the private source (${sum.slice(0, 8)}…).` };
  }
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(lockFile, 'utf8')).sha256; } catch { /* missing */ }
  if (!saved) return { code: 1, state: 'unlocked', message: 'The private wording source has no lock yet. Read the rules, then run: node scripts/check-vocabulary.mjs --lock' };
  if (saved !== sum) return { code: 1, state: 'stale', message: 'The private wording rules changed since they were last locked. Read the rules again, then run: node scripts/check-vocabulary.mjs --lock' };
  return { code: 0, state: 'current', message: `Wording lock current (${sum.slice(0, 8)}…).` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = check({ lock: process.argv.includes('--lock') });
  (r.code ? console.error : console.log)(r.message);
  process.exit(r.code);
}
