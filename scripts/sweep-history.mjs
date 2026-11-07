// Records a finished every-surface sweep as the release evidence: copies its summary and
// report into docs/sweep/ and fills the "after" score of every slice in docs/sweep/history.json
// from the same run, so the design canvas's sweep board shows an honest before and after.
//   node scripts/sweep-history.mjs [out/sweep]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] || path.join(root, 'out', 'sweep'));
const dest = path.join(root, 'docs', 'sweep');
const read = (f) => (fs.existsSync(path.join(src, f)) ? fs.readFileSync(path.join(src, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const records = [...read('app.jsonl'), ...read('site.jsonl')];
if (!records.length) { console.error(`No sweep records in ${src}`); process.exit(2); }
const report = JSON.parse(fs.readFileSync(path.join(src, 'report.json'), 'utf8'));

const count = (r) => r.axe.length + r.layout.length + r.focus.length + r.console.length + (r.error ? 1 : 0);
const key = (r) => [...r.axe.map((v) => `axe|${v.id}|${v.nodes[0]?.target}`), ...r.layout.map((v) => `layout|${v.kind}|${v.target}`), ...r.focus.map((v) => `focus|${v.kind}|${v.target}`), ...r.console.map((v) => `console|${v.message}`)];
const history = JSON.parse(fs.readFileSync(path.join(dest, 'history.json'), 'utf8'));
const date = report.generated.slice(0, 10);
for (const s of history.slices) {
  const rs = records.filter((r) => r.surface === s.surface && s.sizes.includes(r.size) && s.themes.includes(r.theme) && s.langs.includes(r.lang));
  if (!rs.length) continue;
  s.after = { date, checks: rs.length, findings: rs.reduce((n, r) => n + count(r), 0), distinct: new Set(rs.flatMap(key)).size };
}
history.final = { date, generated: report.generated, seconds: report.seconds, tuples: report.tuples, checks: report.surfacesChecked, findings: report.findings, distinct: report.distinct, byType: report.byType,
  app: records.filter((r) => r.surface === 'app').length, site: records.filter((r) => r.surface === 'site').length };
fs.writeFileSync(path.join(dest, 'history.json'), JSON.stringify(history, null, 2) + '\n');
fs.copyFileSync(path.join(src, 'summary.md'), path.join(dest, 'summary.md'));
fs.writeFileSync(path.join(dest, 'report.json'), JSON.stringify({ ...report, problems: report.problems.slice(0, 500) }, null, 2) + '\n');
console.log(`Sweep evidence: ${report.surfacesChecked} checks, ${report.findings} findings -> docs/sweep/`);
