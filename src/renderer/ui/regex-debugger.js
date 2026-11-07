// Step-through debugger for a regular expression: a scrubber over every step the backtracking
// engine in src/shared/regex-debug.js recorded, with the current pattern token and text position
// highlighted and a filterable list of steps. Used by the regex workbench and the Regex debugger
// page. Steps come from a run on at most 4,000 characters and stop at 200,000 steps.
import { h, icon, clear, append } from '../core/dom.js';
import { pair } from '../core/i18n.js';
import RD from '../../shared/regex-debug.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const KIND = {
  start: ['flag', pair('Start', '開始')], match: ['check', pair('Match', '配對')], fail: ['close', pair('Fail', '唔配對')],
  repeat: ['repeat', pair('Repeat', '重複')], backtrack: ['undo', pair('Backtrack', '回溯')],
  success: ['task_alt', pair('Found', '搵到')], nomatch: ['block', pair('No match', '冇配對')]
};
const fmt = (n) => Number(n).toLocaleString('en-US');

export function stepDebugger(getSrc, getFlags, getText, { autorun = false, onRun = null } = {}) {
  const summary = h('div.row');
  const warn = h('div');
  const view = h('div.stack');
  let run = null, at = 0, timer = null, filter = 'all';
  const stop = () => { if (timer) { clearInterval(timer); timer = null; playBtn.replaceChildren(icon('play_arrow')); playBtn.setAttribute('aria-label', pair('Play', '播放')); } };

  const slider = h('input.slider', { type: 'range', min: 1, max: 1, value: 1, 'aria-label': pair('Step', '步驟'), dataset: { el: 'rx-step' }, on: { input: (e) => { stop(); go(Number(e.target.value) - 1); } } });
  const label = h('b');
  const tokRow = h('div.rx-tokens', { 'aria-label': pair('Pattern, with the current token highlighted', '模式，而家嗰部分會標示') });
  const subject = h('div.rx-subject', { 'aria-label': pair('Text, with the current position outlined', '文字，而家位置有框') });
  const note = h('div.small', { role: 'status', 'aria-live': 'polite' });
  const table = h('tbody');
  const ib = (name, label2, fn) => h('button.icon-btn', { type: 'button', 'aria-label': label2, title: label2, on: { click: fn } }, icon(name));
  const playBtn = ib('play_arrow', pair('Play', '播放'), () => {
    if (!run) return;
    if (timer) return stop();
    if (at >= run.steps.length - 1) go(0);
    playBtn.replaceChildren(icon('pause')); playBtn.setAttribute('aria-label', pair('Pause', '暫停'));
    timer = setInterval(() => { if (at >= run.steps.length - 1) stop(); else go(at + 1); }, 140);
  });
  const filterSeg = h('div.seg', { role: 'radiogroup', 'aria-label': pair('Show steps', '顯示步驟') },
    [['all', pair('All', '全部')], ['backtrack', pair('Backtracks', '回溯')], ['match', pair('Matches', '配對')]].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === filter), on: { click: (e) => { filter = k; for (const b of filterSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); drawTable(); } } }, l)));

  const drawTable = () => {
    clear(table);
    if (!run) return;
    const rows = run.steps.map((s, idx) => [s, idx]).filter(([s]) => filter === 'all' || (filter === 'match' ? ['match', 'success'].includes(s.kind) : s.kind === 'backtrack'));
    // A window of rows around the current step keeps a long run quick to draw.
    const pos = Math.max(0, rows.findIndex(([, idx]) => idx >= at));
    const from = Math.max(0, pos - 30);
    for (const [s, idx] of rows.slice(from, from + 80)) {
      const [ico, name] = KIND[s.kind];
      const tone = s.kind === 'match' || s.kind === 'success' ? '.ok' : s.kind === 'fail' || s.kind === 'nomatch' ? '.err' : s.kind === 'backtrack' ? '.warn' : '';
      put(table, h('tr', { 'aria-current': idx === at ? 'step' : null, style: idx === at ? { background: 'var(--surface-2)' } : null, tabindex: '0', on: { click: () => { stop(); go(idx); }, keydown: (e) => { if (e.key === 'Enter') { stop(); go(idx); } } } },
        h('td.mono', String(s.i)), h('td', s.e > s.s ? h('code', getSrc().slice(s.s, s.e)) : '—'), h('td.mono', String(s.pos)),
        h('td', h(`span.badge${tone}`, icon(ico), name), ' ', h('span.small', s.note))));
    }
    if (!rows.length) put(table, h('tr', h('td', { colSpan: 4 }, h('span.small.muted', pair('No steps of this kind.', '冇呢類步驟。')))));
  };

  const go = (idx) => {
    if (!run) return;
    at = Math.max(0, Math.min(idx, run.steps.length - 1));
    const s = run.steps[at];
    slider.value = String(at + 1);
    slider.style.setProperty('--p', `${run.steps.length > 1 ? (at / (run.steps.length - 1)) * 100 : 0}%`);
    label.textContent = pair(`Step ${fmt(s.i)} of ${fmt(run.total)}`, `第 ${fmt(s.i)} 步，共 ${fmt(run.total)} 步`);
    for (const span of tokRow.children) {
      const t = span.__tok;
      span.className = s.e > s.s && t.s >= s.s && t.e <= s.e ? 'now' : '';
    }
    const text = run.text;
    const start = [...run.steps.slice(0, at + 1)].reverse().find((x) => x.kind === 'start')?.pos ?? 0;
    put(clear(subject), text.slice(0, start), h('span.m', text.slice(start, s.pos)), h('span.cur', text[s.pos] === undefined ? ' ' : text[s.pos]), text.slice(s.pos + 1));
    const [, name] = KIND[s.kind];
    note.textContent = `${name}: ${s.note}. ${pair(`Position ${s.pos}.`, `位置 ${s.pos}。`)}`;
    drawTable();
  };

  const runNow = () => {
    stop();
    clear(summary); clear(warn); clear(tokRow); clear(table);
    run = null;
    const src = getSrc(), text = getText().slice(0, 4000), flags = getFlags().replace(/[gy]/g, '');
    if (!src) { note.textContent = pair('Type a pattern first.', '請先輸入模式。'); return; }
    try { run = { ...RD.debug(src, flags, text, { keep: 20000, limit: 200000 }), text }; }
    catch (e) {
      note.textContent = e instanceof RD.Unsupported
        ? pair(`The debugger cannot step through this pattern yet: ${e.message} The attempt trace still runs it with the real engine.`, `除錯器暫時未行到呢個模式：${e.message} 嘗試追蹤仍然會用真引擎行。`)
        : pair(`The pattern is not valid: ${e.message}`, `模式唔啱：${e.message}`);
      return;
    }
    for (const t of RD.tokens(src, flags)) { const span = h('span', t.text); span.__tok = t; put(tokRow, span); }
    slider.max = String(run.steps.length);
    put(summary, h('span.badge', icon('steps'), pair(`${fmt(run.total)} steps`, `${fmt(run.total)} 步`)),
      h(`span.badge${run.backtracks ? '.warn' : '.ok'}`, icon('undo'), pair(`${fmt(run.backtracks)} backtracks`, `${fmt(run.backtracks)} 次回溯`)),
      run.match ? h('span.badge.ok', icon('task_alt'), pair(`match at ${run.match[0]}: ${JSON.stringify(text.slice(...run.match))}`, `喺 ${run.match[0]} 配對：${JSON.stringify(text.slice(...run.match))}`)) : h('span.badge', icon('block'), pair('no match', '冇配對')),
      ...(run.steps.length < run.total ? [h('span.small.muted', pair(`The first ${fmt(run.steps.length)} steps are kept for stepping.`, `保留頭 ${fmt(run.steps.length)} 步俾你逐步睇。`))] : []));
    const heavy = run.limited || run.total > 60 * (text.length + 1);
    if (heavy) put(warn, h('div.flag-card', h('b', icon('warning'), ' ', run.limited ? pair(`Stopped after ${fmt(run.total)} steps`, `行咗 ${fmt(run.total)} 步就停`) : pair('This pattern backtracks a lot', '呢個模式回溯好多')),
      h('div.small', pair('A repeat inside a repeat, or alternatives that can match the same text, make the engine try every way to split the text before it gives up. Use a single repeat, or make the parts unable to overlap.', '重複入面再重複，或者幾個選擇可以配同一段字，引擎就要試晒所有分法先肯放棄。用一個重複就夠，或者令各部分唔會重疊。'))));
    go(0);
    onRun?.(run);
  };

  if (autorun) queueMicrotask(runNow);
  const parts = {
    head: h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: runNow } }, icon('bug_report'), pair('Step through', '逐步行')), summary),
    warn,
    stepper: h('div.stack',
      h('div.rx-step-ctl', ib('first_page', pair('First step', '第一步'), () => { stop(); go(0); }), ib('chevron_left', pair('Previous step', '上一步'), () => { stop(); go(at - 1); }), playBtn,
        ib('chevron_right', pair('Next step', '下一步'), () => { stop(); go(at + 1); }), ib('last_page', pair('Last step', '最後一步'), () => { stop(); go((run?.steps.length || 1) - 1); }), slider, label),
      h('b.small.muted', pair('Pattern', '模式')), tokRow, h('b.small.muted', pair('Text', '文字')), subject, note),
    steps: h('div.stack', h('div.row', filterSeg),
      h('div.tbl-wrap', { style: { maxHeight: '320px', overflow: 'auto' } }, h('table.tbl', h('thead', h('tr', ['#', pair('Pattern', '模式'), pair('Text', '文字'), pair('What happened', '發生咩事')].map((c) => h('th', c)))), table)))
  };
  const el = h('div.stack', { dataset: { el: 'rx-debugger' } }, parts.head, parts.warn, parts.stepper, parts.steps);
  return { el, parts, run: runNow, stop };
}
