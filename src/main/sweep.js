// Every-surface sweep of the built app (driven by scripts/sweep.mjs). For each window size,
// theme and language mode it opens every page, dialog, menu and overlay listed in
// MT_SWEEP_ROUTES and records:
//   - axe-core WCAG 2.2 A/AA and best-practice violations,
//   - console errors and blocked content,
//   - text that is clipped, outside the window, or covered by something that is not an overlay,
//   - a keyboard walk: focus on hidden or unnamed controls, icon names read aloud, focus with
//     no visible change, and focus escaping an open dialog.
// Results are appended to <dir>/app.jsonl, one line per surface and tuple.
const fs = require('node:fs');
const path = require('node:path');
const { openRoute, wait } = require('./capture-routes.js');
const { LAYOUT_PROBE, FOCUS_BASELINE, FOCUS_STATE, AXE_RUN } = require('../shared/sweep-probes.js');

const SIZES = { mobile: [390, 844], tablet: [820, 1180], small: [960, 540], desktop: [1440, 940] };

async function runSweep(win, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'app.jsonl');
  const wc = win.webContents;
  const js = (code) => wc.executeJavaScript(code);
  const env = process.env;
  const sizes = (env.MT_SWEEP_SIZES || 'desktop,small,tablet,mobile').split(',').filter((s) => SIZES[s]);
  const themes = (env.MT_SWEEP_THEMES || 'dark,light').split(',');
  const langs = (env.MT_SWEEP_LANGS || 'en,yue,both').split(',');
  const routes = (env.MT_SWEEP_ROUTES || '').split(',').filter(Boolean);
  const maxTabs = Number(env.MT_SWEEP_TABS || 60);
  // A resumed run keeps the finished records and skips them. Records that ended in a sweep
  // error, and a last line cut short by an interruption, are dropped and run again.
  const done = new Set();
  if (env.MT_SWEEP_RESUME === '1' && fs.existsSync(out)) {
    const keep = [];
    for (const line of fs.readFileSync(out, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); if (r.error) continue; done.add(`${r.route}|${r.size}|${r.theme}|${r.lang}`); keep.push(line); } catch { /* cut short */ }
    }
    fs.writeFileSync(out, keep.length ? keep.join('\n') + '\n' : '');
  }

  let consoleLog = [];
  wc.on('console-message', (event, legacyLevel, legacyMessage, legacyLine, legacySource) => {
    const level = typeof event?.level === 'string' ? event.level : ['verbose', 'info', 'warning', 'error'][legacyLevel] || 'info';
    const message = String(event?.message ?? legacyMessage ?? '');
    if (level === 'error' || /refused to|blocked|content security policy/i.test(message)) consoleLog.push({ level, message: message.slice(0, 300), source: String(event?.sourceId ?? legacySource ?? '').split('/').pop(), line: event?.lineNumber ?? legacyLine });
  });
  wc.on('did-fail-load', (_e, code, desc, url) => consoleLog.push({ level: 'error', message: `load failed ${code} ${desc}`, source: String(url).slice(0, 120) }));

  for (let i = 0; i < 100 && !(await js('!!window.__mtReady').catch(() => false)); i++) await wait(100);
  await js("document.querySelector('.scrim')?.remove(); document.querySelector('.dimsum')?.remove(); true");
  wc.setZoomFactor(1);
  await js(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8') + '\n;true');
  const savedSettings = await js("localStorage.getItem('mt.settings.v1')").catch(() => null);

  for (const size of sizes) {
    const [w, hgt] = SIZES[size];
    win.setMinimumSize(320, 400);
    win.setSize(w, hgt);
    await wait(400);
    for (const theme of themes) {
      for (const lang of langs) {
        await js(`window.__mtSet('theme', ${JSON.stringify(theme)}); window.__mtSet('motion', 'reduced'); window.__mtSet('lang', ${JSON.stringify(lang)}); true`);
        for (const route of routes) {
          if (done.has(`${route}|${size}|${theme}|${lang}`)) continue;
          consoleLog = [];
          const rec = { surface: 'app', route, size, width: w, height: hgt, theme, lang, axe: [], layout: [], focus: [], console: [] };
          try {
            await openRoute(wc, route, { settle: 700 });
            rec.axe = await js(AXE_RUN).catch((e) => [{ id: 'axe-error', impact: 'critical', help: e.message, nodes: [], count: 1 }]);
            rec.layout = await js(LAYOUT_PROBE).catch((e) => [{ kind: 'probe-error', text: e.message }]);
            rec.focus = await keyboardWalk(wc, js, maxTabs);
            if (env.MT_SWEEP_EVAL) rec.eval = await js(env.MT_SWEEP_EVAL).catch((e) => String(e)); // diagnostics hook
          } catch (e) { rec.error = e.message; }
          rec.console = consoleLog.slice(0, 20);
          fs.appendFileSync(out, JSON.stringify(rec) + '\n');
        }
      }
    }
  }
  // The sweep changes settings only for its run: the user's saved settings come back at the end.
  await js(savedSettings === null ? "localStorage.removeItem('mt.settings.v1'); true" : `localStorage.setItem('mt.settings.v1', ${JSON.stringify(savedSettings)}); true`).catch(() => {});
}

// Presses Tab through the surface and reports focus problems. Focus that never moves, or
// that cycles back to where it started, ends the walk.
async function keyboardWalk(wc, js, maxTabs) {
  const findings = [];
  const base = await js(FOCUS_BASELINE);
  const seen = new Set();
  let first = null;
  for (let i = 0; i < maxTabs; i++) {
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await wait(45);
    const st = await js(FOCUS_STATE).catch(() => ({ none: true }));
    if (st.none) continue;
    if (st.id === first) break;
    if (!first) first = st.id;
    if (seen.has(st.id)) continue;
    seen.add(st.id);
    if (!st.visible) findings.push({ kind: 'focus-hidden', target: st.target, role: st.role, name: st.name });
    if (!st.name) findings.push({ kind: 'focus-unnamed', target: st.target, role: st.role });
    if (st.ligature) findings.push({ kind: 'icon-name-read-aloud', target: st.target, name: st.name });
    if (st.visible && st.ring === false) findings.push({ kind: 'focus-no-ring', target: st.target, role: st.role, name: st.name, style: st.style });
    if (base.modal && st.escaped) findings.push({ kind: 'focus-escaped-dialog', target: st.target, dialog: base.modal });
  }
  return findings;
}

module.exports = { runSweep, SIZES };
