// Page hero band: eyebrow, display title (bilingual titles split onto two lines),
// description, actions and an animated illustration for the page's family.
import { h, icon } from '../core/dom.js';
import { DESTS, currentDest } from './shell.js';
import { artFor } from '../../shared/hero-art.js';

/** Same call shape as the old per-page head helpers: (eyebrow, title, description, ...actions). */
export function pageHero(eyebrow, title, desc, ...actions) {
  const dest = currentDest() || 'home';
  const d = DESTS.find((x) => x.id === dest);
  const [main, ...rest] = String(title ?? '').split(' · ');
  const art = h('div.hero-art');
  art.innerHTML = artFor(dest); // static, bundled markup with no data in it
  const acts = actions.filter(Boolean);
  return h('section.hero-band', { dataset: { el: `hero-${dest}` } },
    h('div.hero-text',
      h('span.hero-eyebrow', icon(d?.icon || 'auto_awesome'), eyebrow),
      h('h1', main, rest.length ? h('span.yue', rest.join(' · ')) : null),
      desc ? h('p', desc) : null,
      acts.length ? h('div.hero-actions', ...acts) : null),
    art);
}

/** A row of stat pills for a hero or a card: [{ value, label, tone }]. */
export const heroStats = (items) => h('div.hero-stats', items.map((x) => h(`div.stat${x.tone ? '.' + x.tone : ''}`, h('b', String(x.value)), h('span', x.label))));
