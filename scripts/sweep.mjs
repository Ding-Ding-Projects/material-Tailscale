// Every-surface sweep: the release check for the app and the website.
//
// Opens every page, dialog, menu and overlay of the built app (src/main/sweep.js) and every
// page of the built website, in both themes, every language mode and four window sizes
// (desktop 1440x940, a 1080p screen at 200% = 960x540, tablet 820x1180, phone 390x844), and
// reports axe-core WCAG 2.2 AA and best-practice violations, console errors and blocked
// content, clipped, off-screen and overlapping text, and keyboard-focus problems.
//
//   npm run build && node scripts/build-site.mjs
//   xvfb-run -a -s "-screen 0 1600x1300x24" node scripts/sweep.mjs [--app-only|--site-only] [--quick]
//
// --quick runs one size, theme and language for a fast look. --resume continues an interrupted
// run in the same output folder: finished checks are kept, and the run refuses to resume when
// the build or the matrix changed, so one report never mixes two builds. --merge=dirA,dirB
// joins parts that ran side by side (for example one per window size, and the website) into
// one report, and refuses parts that checked different builds or have not finished. Results:
// out/sweep/report.json and out/sweep/summary.md. Exit code 1 when anything is found, 0 when
// the sweep is clean.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { APP_ROUTES, SIZES, SIZE_PX, THEMES, LANGS, siteRoutes } from './lib/sweep-routes.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const resume = args.has('--resume');
const mergeArg = process.argv.slice(2).find((a) => a.startsWith('--merge='))?.slice('--merge='.length);
const pick = (envName, all) => (process.env[envName] ? process.env[envName].split(',') : quick ? all.slice(0, 1) : [...all]);
const sizes = pick('MT_SWEEP_SIZES', SIZES);
const themes = pick('MT_SWEEP_THEMES', THEMES);
const langs = pick('MT_SWEEP_LANGS', LANGS);
const out = process.env.MT_SWEEP_OUT || path.join(root, 'out', 'sweep');
const mergeDirs = mergeArg ? mergeArg.split(',').map((d) => path.resolve(d)) : [];
if (mergeDirs.includes(path.resolve(out))) { console.error('Merge into a new folder, not into one of the parts.'); process.exit(2); }
if (!resume) fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now();

// The build this run checks, by content hash, and the matrix it covers.
const builtFiles = (dir) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true }).map((f) => path.join(dir, String(f)).replace(/\\/g, '/')).filter((f) => /\.(js|html|css|json)$/.test(f) && !f.includes('/screenshots/')).sort() : []);
const stamp = {
  build: Object.fromEntries([...builtFiles('dist'), ...builtFiles('site-dist')].map((f) => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')])),
  matrix: { sizes, themes, langs, routes: process.env.MT_SWEEP_ROUTES || 'all', siteRoutes: process.env.MT_SWEEP_SITE_ROUTES || 'all', parts: [...args].filter((a) => /only/.test(a)) }
};
const stampFile = path.join(out, 'build.json');
let resumed = 0;
let started = new Date(t0).toISOString();
let wallSeconds = null;
let partsFinished = null;
const union = (xs) => [...new Set(xs.flat())];
if (mergeDirs.length) {
  const parts = mergeDirs.map((d) => ({ dir: d, ...JSON.parse(fs.readFileSync(path.join(d, 'build.json'), 'utf8')) }));
  if (new Set(parts.map((p) => JSON.stringify(p.build))).size !== 1) { console.error('Cannot merge: the parts checked different builds.'); process.exit(2); }
  if (parts.some((p) => !p.finished)) { console.error('Cannot merge: a part has not finished.'); process.exit(2); }
  for (const f of ['app.jsonl', 'site.jsonl']) {
    const seen = new Set(), lines = [];
    for (const d of mergeDirs) {
      if (!fs.existsSync(path.join(d, f))) continue;
      for (const l of fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean)) {
        const r = JSON.parse(l), k = `${r.surface}|${r.route}|${r.size}|${r.theme}|${r.lang}`;
        if (seen.has(k)) { console.error(`Cannot merge: ${k} was checked by more than one part.`); process.exit(2); }
        seen.add(k); lines.push(l);
      }
    }
    if (lines.length) fs.writeFileSync(path.join(out, f), lines.join('\n') + '\n');
  }
  started = parts.map((p) => p.started).sort()[0];
  partsFinished = parts.map((p) => p.finished).sort().pop();
  wallSeconds = Math.round((Date.parse(partsFinished) - Date.parse(started)) / 1000);
  stamp.build = parts[0].build;
  stamp.matrix = { sizes: union(parts.map((p) => p.matrix.sizes)), themes: union(parts.map((p) => p.matrix.themes)), langs: union(parts.map((p) => p.matrix.langs)),
    parts: parts.map((p) => ({ dir: path.basename(p.dir), matrix: p.matrix, started: p.started, finished: p.finished, resumed: p.resumed || 0 })) };
  sizes.splice(0, sizes.length, ...stamp.matrix.sizes); themes.splice(0, themes.length, ...stamp.matrix.themes); langs.splice(0, langs.length, ...stamp.matrix.langs);
  resumed = parts.reduce((n, p) => n + (p.resumed || 0), 0);
} else if (resume && fs.existsSync(stampFile)) {
  const prev = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
  if (JSON.stringify(prev.build) !== JSON.stringify(stamp.build) || JSON.stringify(prev.matrix) !== JSON.stringify(stamp.matrix)) {
    console.error('Cannot resume: the build or the matrix changed since this sweep started. Run it again without --resume.');
    process.exit(2);
  }
  resumed = (prev.resumed || 0) + 1;
  started = prev.started || started;
}
fs.writeFileSync(stampFile, JSON.stringify({ ...stamp, resumed, started }, null, 2) + '\n');
const doneIn = (file) => {
  const done = new Set();
  if (!resume || !fs.existsSync(file)) return done;
  const keep = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); if (r.error) continue; done.add(`${r.route}|${r.size}|${r.theme}|${r.lang}`); keep.push(line); } catch { /* cut short */ }
  }
  fs.writeFileSync(file, keep.length ? keep.join('\n') + '\n' : '');
  return done;
};

// ---------- app ----------
if (!mergeDirs.length && !args.has('--site-only')) {
  const routes = process.env.MT_SWEEP_ROUTES || APP_ROUTES.join(',');
  const r = spawnSync(electron, [root, '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, MT_SWEEP_DIR: out, MT_SWEEP_ROUTES: routes, MT_SWEEP_SIZES: sizes.join(','), MT_SWEEP_THEMES: themes.join(','), MT_SWEEP_LANGS: langs.join(','), MT_SWEEP_RESUME: resume ? '1' : '' },
    timeout: 4 * 3600 * 1000
  });
  if (r.status) console.error(`app sweep exited with ${r.status}`);
}

// ---------- website ----------
if (!mergeDirs.length && !args.has('--app-only')) {
  const { LAYOUT_PROBE, FOCUS_BASELINE, FOCUS_STATE, AXE_RUN } = require('../src/shared/sweep-probes.js');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.error('Playwright is needed for the website sweep.'); process.exit(2); }
  // Serve the built site over HTTP, as GitHub Pages does; file:// would block same-origin reads.
  const http = await import('node:http');
  const siteRoot = path.join(root, 'site-dist');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.gif': 'image/gif' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(siteRoot, rel);
    if (!file.startsWith(siteRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const index = `http://127.0.0.1:${server.address().port}/index.html`;
  const routes = process.env.MT_SWEEP_SITE_ROUTES ? process.env.MT_SWEEP_SITE_ROUTES.split(',') : siteRoutes(root);
  const axePath = require.resolve('axe-core/axe.min.js');
  const browser = await chromium.launch();
  const file = path.join(out, 'site.jsonl');
  const siteDone = doneIn(file);
  for (const size of sizes) {
    const [w, hgt] = SIZE_PX[size];
    for (const theme of themes) for (const lang of langs) {
      const todo = routes.filter((r) => !siteDone.has(`${r}|${size}|${theme}|${lang}`));
      if (!todo.length) continue;
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      // The random dim sum surprise would fetch the public catalogue on one load in ten; an empty
      // cached catalogue holds it back during page checks. The card itself is checked in the app
      // as its own surface (home>overlay@dimsum).
      await ctx.addInitScript(([th, lg]) => { try { localStorage.setItem('mt.settings.v1', JSON.stringify({ theme: th, lang: lg, motion: 'reduced' })); localStorage.setItem('mt.dimsum.cache.v1', JSON.stringify({ at: Date.now(), source: 'sweep', dishes: [] })); } catch { /* storage blocked */ } }, [theme, lang]);
      const page = await ctx.newPage();
      let consoleLog = [];
      page.on('console', (m) => { if (m.type() === 'error' || /refused to|blocked|content security policy/i.test(m.text())) consoleLog.push({ level: m.type(), message: m.text().slice(0, 300) }); });
      page.on('pageerror', (e) => consoleLog.push({ level: 'error', message: String(e.message).slice(0, 300) }));
      page.on('requestfailed', (q) => { if (!q.url().startsWith('data:')) consoleLog.push({ level: 'error', message: `request failed: ${q.url().slice(0, 160)} ${q.failure()?.errorText || ''}` }); });
      await page.goto(index + '#/home');
      await page.waitForSelector('.site-header', { timeout: 15000 }).catch(() => {});
      await page.addScriptTag({ path: axePath });
      for (const route of todo) {
        consoleLog = [];
        const rec = { surface: 'site', route, size, width: w, height: hgt, theme, lang, axe: [], layout: [], focus: [], console: [] };
        try {
          await page.evaluate((r) => { location.hash = '#/' + r; }, route);
          await page.waitForTimeout(500);
          await page.evaluate("document.querySelectorAll('.dimsum').forEach((x) => x.remove())");
          rec.axe = await page.evaluate(AXE_RUN).catch((e) => [{ id: 'axe-error', impact: 'critical', help: e.message, nodes: [], count: 1 }]);
          rec.layout = await page.evaluate(LAYOUT_PROBE);
          const base = await page.evaluate(FOCUS_BASELINE);
          const seen = new Set(); let first = null;
          for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab');
            const st = await page.evaluate(FOCUS_STATE);
            if (st.none) continue;
            if (st.id === first) break;
            if (!first) first = st.id;
            if (seen.has(st.id)) continue;
            seen.add(st.id);
            if (!st.visible) rec.focus.push({ kind: 'focus-hidden', target: st.target, role: st.role, name: st.name });
            if (!st.name) rec.focus.push({ kind: 'focus-unnamed', target: st.target, role: st.role });
            if (st.ligature) rec.focus.push({ kind: 'icon-name-read-aloud', target: st.target, name: st.name });
            if (st.visible && st.ring === false) rec.focus.push({ kind: 'focus-no-ring', target: st.target, role: st.role, name: st.name });
            if (base.modal && st.escaped) rec.focus.push({ kind: 'focus-escaped-dialog', target: st.target, dialog: base.modal });
          }
        } catch (e) { rec.error = e.message; }
        rec.console = consoleLog.slice(0, 20);
        fs.appendFileSync(file, JSON.stringify(rec) + '\n');
      }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
}

// ---------- report ----------
const records = ['app.jsonl', 'site.jsonl'].flatMap((f) => (fs.existsSync(path.join(out, f)) ? fs.readFileSync(path.join(out, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []));
const findings = [];
for (const r of records) {
  const where = { surface: r.surface, route: r.route, size: r.size, theme: r.theme, lang: r.lang };
  if (r.error) findings.push({ ...where, type: 'error', id: 'sweep-error', detail: r.error });
  for (const v of r.axe) findings.push({ ...where, type: 'axe', id: v.id, impact: v.impact, detail: v.help, targets: v.nodes.map((n) => n.target), count: v.count });
  for (const l of r.layout) findings.push({ ...where, type: 'layout', id: l.kind, detail: l.text, targets: [l.target], by: l.by });
  for (const f of r.focus) findings.push({ ...where, type: 'focus', id: f.kind, detail: f.name || f.role || '', targets: [f.target] });
  for (const c of r.console) findings.push({ ...where, type: 'console', id: c.level, detail: c.message });
}
// Distinct problems: the same rule on the same element counts once, wherever it appeared.
const distinct = new Map();
for (const f of findings) {
  const key = `${f.surface}|${f.type}|${f.id}|${(f.targets || [f.detail]).join(',')}`;
  const d = distinct.get(key) || { surface: f.surface, type: f.type, id: f.id, impact: f.impact, detail: f.detail, targets: f.targets, by: f.by, where: [] };
  d.where.push(`${f.route} ${f.size} ${f.theme} ${f.lang}`);
  distinct.set(key, d);
}
const byType = {};
for (const f of findings) byType[`${f.surface} ${f.type}`] = (byType[`${f.surface} ${f.type}`] || 0) + 1;
const report = {
  generated: new Date().toISOString(), seconds: wallSeconds ?? Math.round((Date.now() - t0) / 1000), resumed, parts: mergeDirs.length || 1,
  tuples: { sizes, themes, langs }, surfacesChecked: records.length, findings: findings.length, distinct: distinct.size, byType,
  problems: [...distinct.values()].sort((a, b) => b.where.length - a.where.length)
};
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# Every-surface sweep', '',
  `${records.length} surface checks (${sizes.join(', ')}; ${themes.join(', ')}; ${langs.join(', ')}) in ${report.seconds} s${mergeDirs.length ? ` of wall-clock time, in ${mergeDirs.length} parts run side by side` : ''}${resumed ? ` (resumed ${resumed} time${resumed > 1 ? 's' : ''} after an interruption)` : ''}.`, '',
  `**${findings.length} findings, ${distinct.size} distinct problems.**`, '',
  '| Where | Findings |', '| --- | ---: |', ...Object.entries(byType).map(([k, v]) => `| ${k} | ${v} |`), '',
  '## Distinct problems', '',
  ...report.problems.slice(0, 200).map((p) => `- **${p.surface} ${p.type} \`${p.id}\`**${p.impact ? ` (${p.impact})` : ''}: ${String(p.detail || '').slice(0, 140)}${p.targets?.length ? ` · \`${p.targets[0]}\`` : ''}${p.by ? ` under \`${p.by}\`` : ''} · ${p.where.length}× (e.g. ${p.where[0]})`)
].join('\n');
fs.writeFileSync(path.join(out, 'summary.md'), md + '\n');
// A finished run records when it finished, so parts can be merged with honest wall-clock time.
fs.writeFileSync(stampFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(stampFile, 'utf8')), finished: partsFinished || report.generated }, null, 2) + '\n');
console.log(`Sweep: ${records.length} surface checks, ${findings.length} findings, ${distinct.size} distinct problems -> ${path.relative(root, out)}/summary.md`);
process.exit(findings.length ? 1 : 0);
