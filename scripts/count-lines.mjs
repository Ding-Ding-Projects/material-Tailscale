// Counts project lines for release notes: source, styles and markup, tests,
// docs; total and non-blank; generated and vendored trees excluded.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const EXCLUDE = [/^vendor\//, /^assets\/fonts\//, /^design\//, /package-lock\.json$/, /api-catalog\.json$/, /\.(png|ico|woff2?|ttf|svg)$/];
const kindOf = (f) => (/^test\//.test(f) ? 'Tests' : /\.(css|html)$/.test(f) ? 'Styles and markup' : /\.(md)$/.test(f) ? 'Docs' : /\.(js|mjs|cjs|bat|sh|ps1|yml|json)$/.test(f) ? 'Source' : null);
const rows = {};
for (const f of files) {
  if (EXCLUDE.some((r) => r.test(f))) continue;
  const c = kindOf(f); if (!c) continue;
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  const lines = text.split('\n');
  rows[c] ||= { files: 0, total: 0, nonBlank: 0 };
  rows[c].files++; rows[c].total += lines.length; rows[c].nonBlank += lines.filter((l) => l.trim()).length;
}
const sum = Object.values(rows).reduce((a, r) => ({ files: a.files + r.files, total: a.total + r.total, nonBlank: a.nonBlank + r.nonBlank }), { files: 0, total: 0, nonBlank: 0 });
let md = '| Category | Files | Lines | Non-blank |\n| --- | ---: | ---: | ---: |\n';
for (const [k, r] of Object.entries(rows)) md += `| ${k} | ${r.files} | ${r.total} | ${r.nonBlank} |\n`;
md += `| **Total** | **${sum.files}** | **${sum.total}** | **${sum.nonBlank}** |\n\nExcluded: vendored OpenAPI spec, vendored fonts, design canvas, generated api-catalog.json, lockfile and binary assets. Command: \`node scripts/count-lines.mjs\`.\n`;
const hours = [Math.round(sum.nonBlank / 30), Math.round(sum.nonBlank / 15)];
md += `\nHuman time estimate: ${sum.nonBlank} non-blank lines at 15 to 30 finished lines per hour is about ${hours[0]} to ${hours[1]} hours (${sum.nonBlank} / 30 = ${hours[0]}, ${sum.nonBlank} / 15 = ${hours[1]}).\n`;
if (process.argv.includes('--json')) console.log(JSON.stringify({ rows, sum, hours })); else console.log(md);
