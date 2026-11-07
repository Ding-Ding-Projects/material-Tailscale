// Regex debugger page: type a pattern and a text, then step through every attempt, match,
// failure and backtrack the engine makes, with a warning when the pattern backtracks heavily.
import { h, icon } from '../core/dom.js';
import { pair } from '../core/i18n.js';
import { registerPage } from '../ui/shell.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { stepDebugger } from '../ui/regex-debugger.js';

const fmt = (n) => Number(n).toLocaleString('en-US');

registerPage('regex-debug', (ctx) => {
  const flags = { i: false, m: false, s: false, u: false };
  const pat = h('input.input.mono', { value: '^(a+)+b', 'aria-label': pair('Pattern', '模式'), dataset: { el: 'rxd-pattern' }, spellcheck: false });
  const text = h('input.input.mono', { value: 'aaaac', 'aria-label': pair('Text to test', '測試文字'), dataset: { el: 'rxd-text' }, spellcheck: false });
  const stats = h('div.hero-stats');
  const dbg = stepDebugger(() => pat.value, () => Object.keys(flags).filter((f) => flags[f]).join(''), () => text.value, {
    autorun: true,
    onRun: (r) => stats.replaceChildren(...heroStats([
      { value: fmt(r.total), label: pair('steps', '步') },
      { value: fmt(r.backtracks), label: pair('backtracks', '次回溯'), tone: r.backtracks ? 'warn' : 'ok' },
      { value: r.match ? pair('match', '配對') : pair('no match', '冇配對'), label: pair('result', '結果'), tone: r.match ? 'ok' : null }
    ]).children)
  });
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(dbg.run, 300); };
  pat.addEventListener('input', later); text.addEventListener('input', later);
  ctx.onCleanup(() => { clearTimeout(t); dbg.stop(); });
  const flagChips = h('div.suggest', { role: 'group', 'aria-label': pair('Flags', '旗標') }, [['i', pair('ignore case', '唔理大細階')], ['m', pair('multiline', '多行')], ['s', pair('dot matches newline', '點配換行')], ['u', 'Unicode']].map(([f, l]) =>
    h('button.chip.choice', { type: 'button', 'aria-pressed': 'false', on: { click: (e) => { flags[f] = !flags[f]; e.currentTarget.setAttribute('aria-pressed', String(flags[f])); dbg.run(); } } }, h('code', f), ' ', l)));
  return h('div.page',
    pageHero(pair('Patterns', '模式'), pair('Regex debugger', '正則除錯'), pair('Watch the engine work through a pattern one step at a time: every attempt, every match and every backtrack.', '睇住引擎一步一步行：每次嘗試、每次配對、每次回溯。'), stats),
    h('div.grid',
      h('section.card.span-5.stack', h('div.card-head', h('span.ic', icon('edit')), h('h2.h3', pair('Pattern and text', '模式同文字'))),
        h('div.input-wrap', { style: { width: '100%' } }, icon('regular_expression'), pat), h('div.input-wrap', { style: { width: '100%' } }, icon('text_fields'), text), flagChips, dbg.parts.head, dbg.parts.warn),
      h('section.card.span-7.tonal.stack', h('div.card-head', h('span.ic.alt', icon('bug_report')), h('h2.h3', pair('Steps', '步驟'))), dbg.parts.stepper),
      h('section.card.span-12.stack', h('div.card-head', h('span.ic', icon('format_list_numbered')), h('h2.h3', pair('Every step', '每一步'))), dbg.parts.steps)));
});
