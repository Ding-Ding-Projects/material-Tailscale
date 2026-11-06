// Regex search fields and the regex workbench: token palette, flags, live
// match highlighting, replacement preview, plain-language explanation, code
// generation, escaping, safe catastrophic-pattern check, history and a saved
// library. Every search surface pairs a plain-text box with this builder.
import { h, icon, clear } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import { popover, toast } from './overlay.js';

const TOKENS = [
  ['Any character', '.', '任何字元'], ['Digit', '\\d', '數字'], ['Not digit', '\\D', '非數字'], ['Word char', '\\w', '字詞字元'], ['Whitespace', '\\s', '空白'],
  ['Start of line', '^', '行首'], ['End of line', '$', '行尾'], ['Word boundary', '\\b', '字詞邊界'],
  ['Zero or more', '*', '零或多個'], ['One or more', '+', '一或多個'], ['Optional', '?', '可有可無'], ['Lazy', '?', '懶惰'], ['Exactly n', '{3}', '剛好 n 個'], ['Range n-m', '{2,5}', 'n 至 m 個'],
  ['Group', '( )', '分組'], ['Non-capturing', '(?: )', '非捕獲分組'], ['Named group', '(?<name> )', '命名分組'], ['Or', '|', '或'],
  ['Set', '[abc]', '字元集'], ['Not in set', '[^abc]', '排除字元集'], ['Lookahead', '(?= )', '前瞻'], ['Neg. lookahead', '(?! )', '否定前瞻'], ['Lookbehind', '(?<= )', '後顧'],
  ['IPv4', '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', 'IPv4'], ['Tailscale IP', '\\b100\\.(?:6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])\\.\\d{1,3}\\.\\d{1,3}\\b', 'Tailscale IP'], ['CIDR', '\\b(?:\\d{1,3}\\.){3}\\d{1,3}/\\d{1,2}\\b', 'CIDR'], ['Tag', 'tag:[A-Za-z0-9-]+', '標籤'], ['Email', '[\\w.+-]+@[\\w-]+\\.[\\w.]+', '電郵']
];

const EXPLAIN = [
  [/^\\d/, 'a digit 0-9'], [/^\\D/, 'any non-digit'], [/^\\w/, 'a word character (letter, digit, underscore)'], [/^\\W/, 'a non-word character'], [/^\\s/, 'whitespace'], [/^\\S/, 'non-whitespace'], [/^\\b/, 'a word boundary'],
  [/^\\./, 'a literal dot'], [/^\\./, 'an escaped character'], [/^\\./, 'an escaped character'], [/^\./, 'any character except newline'], [/^\^/, 'start of line'], [/^\$/, 'end of line'],
  [/^\*\?|^\+\?|^\?\?/, 'lazy quantifier (as few as possible)'], [/^\*/, 'zero or more of the previous'], [/^\+/, 'one or more of the previous'], [/^\?/, 'optional previous'], [/^\{\d+(,\d*)?\}/, 'repeat the previous a set number of times'],
  [/^\(\?<\w+>/, 'start of a named group'], [/^\(\?:/, 'start of a non-capturing group'], [/^\(\?=/, 'lookahead'], [/^\(\?!/, 'negative lookahead'], [/^\(\?<=/, 'lookbehind'], [/^\(\?<!/, 'negative lookbehind'], [/^\(/, 'start of a capturing group'], [/^\)/, 'end of group'], [/^\|/, 'or'],
  [/^\[\^?(?:\\.|[^\]])*\]/, 'one character from a set'], [/^[^\\^$.|?*+()[\]{}]+/, 'literal text']
];

export function explain(src) {
  const out = [];
  let s = src, guard = 0;
  while (s && guard++ < 500) {
    const hit = EXPLAIN.find(([re]) => re.test(s));
    const m = hit ? s.match(hit[0])[0] : s[0];
    out.push([m, hit ? hit[1] : 'character']);
    s = s.slice(m.length);
  }
  return out;
}

/** Nested quantifiers like (a+)+ can hang the engine; flag them before running. */
export const risky = (src) => /\((?:[^()]*[+*])[^()]*\)[+*{]/.test(src);

export function regexField({ placeholder, onChange, id }) {
  let re = false;
  const input = h('input', { placeholder: placeholder || t('search'), 'aria-label': placeholder || t('search'), dataset: { el: 'search-' + (id || 'x') } });
  const err = h('span.err-text');
  const toggle = h('button.icon-btn.sm', { type: 'button', 'aria-pressed': 'false', 'aria-label': pair('Use a regular expression', '用正則表達式'), title: 'Regex', on: { click: () => { re = !re; toggle.setAttribute('aria-pressed', String(re)); toggle.style.color = re ? 'var(--primary)' : ''; fire(); } } }, h('span.mono', '.*'));
  const builder = h('button.icon-btn.sm', { type: 'button', 'aria-label': pair('Open the regex builder', '開正則表達式工具'), title: pair('Regex builder', '正則工具'), on: { click: (e) => {
    const wb = workbench({ initial: input.value, onUse: (p) => { input.value = p; re = true; toggle.setAttribute('aria-pressed', 'true'); toggle.style.color = 'var(--primary)'; fire(); pop.close(); } });
    const pop = popover(e.currentTarget, wb, { width: 560 });
  } } }, icon('build'));
  const fire = () => {
    err.textContent = '';
    if (re && input.value) { try { new RegExp(input.value); if (risky(input.value)) err.textContent = pair('This pattern may be very slow.', '呢個模式可能好慢。'); } catch (e) { err.textContent = e.message; } }
    onChange?.(input.value, re);
  };
  input.addEventListener('input', fire);
  const el = h('div.stack', { style: { flex: 1, minWidth: '240px' } }, h('div.input-wrap', icon('search'), input, toggle, builder), err);
  return { el, value: () => ({ q: input.value, re }), set: (v) => { input.value = v; } };
}

export function workbench({ initial = '', onUse } = {}) {
  const pat = h('input.input', { value: initial, 'aria-label': pair('Pattern', '模式'), style: { fontFamily: 'var(--font-mono)' }, spellcheck: false });
  const flags = { g: true, i: true, m: false, s: false, u: true, y: false };
  const flagRow = h('div.row', Object.keys(flags).map((f) => { const b = h('button.chip.choice', { type: 'button', 'aria-pressed': String(flags[f]), title: { g: 'global', i: 'ignore case', m: 'multiline', s: 'dot matches newline', u: 'unicode', y: 'sticky' }[f], on: { click: () => { flags[f] = !flags[f]; b.setAttribute('aria-pressed', String(flags[f])); run(); } } }, f); return b; }));
  const sample = h('textarea.input', { 'aria-label': pair('Test text', '測試文字'), style: { minHeight: '90px' } });
  sample.value = 'nas-01 100.88.12.4 tag:server\npixel-9 100.71.3.19\nbuild-box 192.168.1.0/24 tag:ci';
  const repl = h('input.input', { placeholder: pair('Replacement, e.g. [$1]', '替換，例如 [$1]'), 'aria-label': pair('Replacement', '替換'), style: { fontFamily: 'var(--font-mono)' } });
  const hl = h('div.out', { style: { maxHeight: '160px' } });
  const repOut = h('div.out', { style: { maxHeight: '120px' } });
  const expl = h('div.stack.small');
  const groups = h('div.small');
  const code = h('div.out', { style: { maxHeight: '140px' } });
  const status = h('div.small');
  const lib = JSON.parse(localStorage.getItem('mt.regex.lib') || '[]');
  const libBox = h('div.suggest');
  const drawLib = () => { clear(libBox).append(...lib.map((p) => h('button.chip.choice.mono', { type: 'button', on: { click: () => { pat.value = p; run(); } } }, p.length > 30 ? p.slice(0, 30) + '…' : p))); };
  const insert = (tok) => { const s = pat.selectionStart ?? pat.value.length; pat.setRangeText(tok.replace(' ', ''), s, pat.selectionEnd ?? s, 'end'); pat.focus(); run(); };
  const run = () => {
    const src = pat.value;
    clear(hl); clear(expl); clear(groups); status.textContent = '';
    let re;
    try { re = new RegExp(src, Object.keys(flags).filter((f) => flags[f]).join('')); } catch (e) { status.textContent = e.message; status.className = 'err-text'; hl.textContent = sample.value; return; }
    if (risky(src)) { status.textContent = pair('Nested quantifiers can take very long; matching is limited to 5,000 characters.', '巢狀量詞可能好慢，只測 5,000 字元。'); status.className = 'err-text'; }
    else { status.className = 'small muted'; }
    const text = sample.value.slice(0, risky(src) ? 5000 : 200000);
    let last = 0, n = 0;
    const t0 = performance.now();
    if (src) for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      if (m[0] === '' && m.index === last) { if (++n > 10000) break; continue; }
      hl.append(text.slice(last, m.index), h('mark', { style: { background: 'var(--tertiary-cont)', color: 'var(--on)', borderRadius: '4px' } }, m[0]));
      last = m.index + m[0].length; n++;
      if (n <= 5 && m.length > 1) groups.append(h('div.mono', `#${n}: ${m.slice(1).map((g, i) => `$${i + 1}=${JSON.stringify(g)}`).join(' ')}${m.groups ? ' ' + JSON.stringify(m.groups) : ''}`));
      if (n > 10000) break;
    }
    hl.append(text.slice(last));
    status.textContent ||= pair(`${n} match(es) in ${(performance.now() - t0).toFixed(1)} ms`, `${n} 個配對，${(performance.now() - t0).toFixed(1)} 毫秒`);
    repOut.textContent = src ? text.replace(re, repl.value) : '';
    for (const [tok, what] of explain(src)) expl.append(h('div.row.nowrap', h('code.chip.mono', tok), h('span', what)));
    const esc = JSON.stringify(src);
    code.textContent = `JavaScript: const re = /${src.replace(/\//g, '\\/')}/${re.flags};\nPython:     re.compile(r${esc}${flags.i ? ', re.I' : ''})\nGo:         regexp.MustCompile(\`${flags.i ? '(?i)' : ''}${src}\`)\nC#:         new Regex(@"${src.replace(/"/g, '""')}"${flags.i ? ', RegexOptions.IgnoreCase' : ''})\nPowerShell: [regex]'${src.replace(/'/g, "''")}'`;
  };
  [pat, sample, repl].forEach((x) => x.addEventListener('input', run));
  drawLib(); run();
  return h('div.stack', { style: { padding: '4px' } },
    h('div.row.nowrap', pat, onUse ? h('button.btn.small', { type: 'button', on: { click: () => onUse(pat.value) } }, pair('Use', '使用')) : null),
    flagRow, status,
    h('div.suggest', TOKENS.map(([en, tok, yue]) => h('button.chip.choice', { type: 'button', title: tok, on: { click: () => insert(tok) } }, pair(en, yue)))),
    h('b.small', pair('Test text', '測試文字')), sample, h('b.small', pair('Matches', '配對')), hl, groups,
    h('b.small', pair('Replace', '替換')), repl, repOut,
    h('b.small', pair('Explanation', '解釋')), expl,
    h('b.small', pair('Code', '程式碼')), code,
    h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: () => { pat.value = pat.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); run(); } } }, pair('Escape as literal', '轉成字面')),
      h('button.btn.small.outline', { type: 'button', on: { click: () => { if (pat.value && !lib.includes(pat.value)) { lib.unshift(pat.value); localStorage.setItem('mt.regex.lib', JSON.stringify(lib.slice(0, 40))); drawLib(); toast(pair('Saved to your pattern library.', '已存入模式庫。'), { kind: 'ok' }); } } } }, icon('bookmark_add'), pair('Save', '儲存'))),
    h('b.small', pair('Library', '模式庫')), libBox);
}
