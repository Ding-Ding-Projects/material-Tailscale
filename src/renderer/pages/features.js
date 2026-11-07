// Features: every feature in the shared list and every Tailscale feature, with what it does for
// you, how to reach it, and its true state on the app, the website and the repository. The
// rows come from src/shared/feature-inventory.js; nothing is shown finished that is not.
import { h, icon, clear } from '../core/dom.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import { registerPage, openDest } from '../ui/shell.js';
import { collapsible } from '../ui/overlay.js';
import { regexField } from '../ui/regex.js';
import { FEATURES, STATES, SURFACES, CATEGORIES, tally } from '../../shared/feature-inventory.js';

const L = (o) => pair(o.en, o.yue);
const P = (a) => pair(a[0], a[1]);
const badge = (state) => h(`span.badge${STATES[state].tone ? '.' + STATES[state].tone : ''}`, icon(STATES[state].icon), L(STATES[state]));
const haystack = (x) => [x.title, x.benefit, x.how, x.note || ['', '']].flat().concat(L(CATEGORIES[x.cat]), x.impl, x.article || '').join('\n');

registerPage('features', () => {
  const onSite = !!window.mt?.site;
  const saved = store.get('featureFilters') || {};
  const f = { surface: saved.surface || (onSite ? 'site' : 'app'), states: new Set(saved.states || []), cats: new Set(saved.cats || []) };
  const keep = () => store.set('featureFilters', { surface: f.surface, states: [...f.states], cats: [...f.cats] }, { record: false });

  const search = regexField({ id: 'features', placeholder: pair('Search what features do and how to reach them', '搜尋功能做乜同點去'), onChange: () => draw() });
  const stats = h('div.hero-stats');
  const status = h('div.small.muted', { role: 'status', 'aria-live': 'polite' });
  const results = h('div.stack', { dataset: { el: 'feature-results' } });
  const filterBox = h('div');

  const chip = (on, label, click, el) => h('button.chip.choice', { type: 'button', 'aria-pressed': String(on), dataset: { el }, on: { click } }, label);
  const toggle = (set, v) => { if (set.has(v)) set.delete(v); else set.add(v); keep(); drawFilters(); draw(); };
  const drawFilters = () => {
    const active = f.states.size + f.cats.size;
    const body = h('div.stack',
      h('div.stack', h('b.small', pair('Show the state on', '顯示邊個介面嘅狀態')),
        h('div.suggest', { role: 'group', 'aria-label': pair('Surface', '介面') }, Object.entries(SURFACES).map(([k, s]) => chip(f.surface === k, [icon(s.icon), L(s)], () => { f.surface = k; keep(); drawFilters(); draw(); }, `feature-surface-${k}`)))),
      h('div.stack', h('b.small', pair('State', '狀態')),
        h('div.suggest', { role: 'group', 'aria-label': pair('State', '狀態') }, Object.keys(STATES).map((k) => chip(f.states.has(k), [icon(STATES[k].icon), L(STATES[k])], () => toggle(f.states, k), `feature-state-${k}`)))),
      h('div.stack', h('b.small', pair('Category', '類別')),
        h('div.suggest', { role: 'group', 'aria-label': pair('Category', '類別') }, Object.entries(CATEGORIES).map(([k, c]) => chip(f.cats.has(k), [icon(c.icon), L(c)], () => toggle(f.cats, k), `feature-cat-${k}`)))),
      active ? h('div.row', h('button.btn.small.text', { type: 'button', on: { click: () => { f.states.clear(); f.cats.clear(); keep(); drawFilters(); draw(); } } }, icon('filter_alt_off'), pair('Clear filters', '清除篩選'))) : null);
    clear(filterBox).append(collapsible('features-filters', pair('Filters', '篩選'), body, { startCollapsed: true, badge: active ? String(active) : null }));
  };

  const card = (x) => {
    const here = x.state[f.surface];
    const art = x.article ? 'docs/' + x.article : null;
    return h('article.card.span-4.feature-card', { role: 'listitem', dataset: { el: `feature-${x.id}` }, 'aria-label': P(x.title) },
      h('div.row.nowrap', { style: { alignItems: 'flex-start', gap: '10px' } }, h('span.ico', icon(CATEGORIES[x.cat].icon)), h('h3', { style: { flex: 1, margin: 0 } }, P(x.title))),
      h('div.row', { style: { marginTop: '8px' } }, badge(here)),
      h('p.small', { style: { margin: '8px 0' } }, P(x.benefit)),
      h('div.suggest', { 'aria-label': pair('State on the other surfaces', '其他介面嘅狀態') }, Object.entries(SURFACES).filter(([k]) => k !== f.surface && x.state[k] !== 'na').map(([k, s]) => h('span.chip', { title: `${L(s)}: ${L(STATES[x.state[k]])}` }, icon(STATES[x.state[k]].icon), `${L(s)}: ${L(STATES[x.state[k]])}`))),
      h('details.feature-more',
        h('summary', pair('How to reach it, and the evidence', '點去，同埋證據')),
        h('div.stack.small', { style: { marginTop: '8px' } },
          h('div', h('b', pair('How: ', '點去：')), P(x.how)),
          x.note ? h('div', h('b', pair('Note: ', '備註：')), P(x.note)) : null,
          x.impl.length ? h('div', h('b', pair('Built in: ', '實作：')), ...x.impl.map((p, i) => [i ? ', ' : '', h('code', p)])) : null,
          art ? h('div', h('button.btn.small.tonal', { type: 'button', on: { click: () => openDest('docs', art) } }, icon('article'), pair('Read the article', '睇文章'))) : null,
          x.capture && onSite ? h('img.feature-shot', { src: `screenshots/${x.capture}`, alt: pair(`Screenshot of ${x.title[0]} from the built app`, `${x.title[1]}嘅程式截圖`), loading: 'lazy', width: 1440, height: 940 }) : null,
          x.capture && !onSite ? h('div', h('b', pair('Screenshot: ', '截圖：')), h('code', `docs/screenshots/${x.capture}`)) : null)));
  };

  const draw = () => {
    const { q, re } = search.value();
    let match = (x) => !q || haystack(x).toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); match = (x) => r.test(haystack(x)); } catch { match = () => false; } }
    const shown = FEATURES.filter((x) => match(x) && (!f.states.size || f.states.has(x.state[f.surface])) && (!f.cats.size || f.cats.has(x.cat)));
    const n = tally(f.surface);
    stats.replaceChildren(...heroStats([
      { value: String(n.done), label: pair('finished', '完成'), tone: 'ok' },
      { value: String(n.built), label: pair('proof pending', '等驗證') },
      { value: String(n.partial), label: pair('partly built', '做咗部分'), tone: n.partial ? 'warn' : null },
      { value: String(n.todo), label: pair('not started', '未開始'), tone: n.todo ? 'err' : null }
    ]).children);
    status.textContent = pair(`${shown.length} of ${FEATURES.length} features shown, states on the ${SURFACES[f.surface].en.toLowerCase()}.`, `顯示 ${FEATURES.length} 個功能入面嘅 ${shown.length} 個，狀態以${SURFACES[f.surface].yue}為準。`);
    clear(results);
    if (!shown.length) {
      results.append(h('div.empty', icon('search_off'), h('p', pair('No feature matches the search and filters.', '冇功能符合搜尋同篩選。')), h('button.btn.small.tonal', { type: 'button', on: { click: () => { search.set(''); f.states.clear(); f.cats.clear(); keep(); drawFilters(); draw(); } } }, pair('Show every feature', '顯示全部功能'))));
      return;
    }
    for (const [k, c] of Object.entries(CATEGORIES)) {
      const rows = shown.filter((x) => x.cat === k);
      if (!rows.length) continue;
      results.append(h('section.stack', { 'aria-label': L(c) }, h('h2.h3', { style: { margin: '6px 0 0' } }, icon(c.icon), ' ', L(c), h('span.small.muted', ` · ${rows.length}`)), h('div.grid', { role: 'list' }, rows.map(card))));
    }
  };

  drawFilters();
  draw();
  return h('div.page',
    pageHero(pair('Everything it does', '佢做到嘅一切'), pair('Features', '功能'), pair('Every feature, what it does for you, how to reach it, and whether it is finished here. Nothing unfinished is shown as done.', '每個功能做乜、點去、喺度做完未。未做完嘅唔會扮做完。'), stats),
    h('div.card.stack', { dataset: { el: 'feature-search' } }, h('div.row', search.el), filterBox, status),
    results);
});
