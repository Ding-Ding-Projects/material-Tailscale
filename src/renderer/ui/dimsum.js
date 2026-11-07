// Dim sum surprise: a 10% chance per launch to show one dish from the public
// Ding-Ding-Projects/dim-sum-photos catalogue (names from catalog/index.json,
// photos only from published catalog-v1* release assets). Nothing is vendored;
// a small cache lives in this app's local storage with its source and time.
// The surprise cannot be turned off; its switch says so.
import { h, icon, reducedMotion } from '../core/dom.js';
import { pair, schoolOn } from '../core/i18n.js';

const CATALOG_URL = 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const RELEASES_URL = 'https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases?per_page=100';
const CACHE = 'mt.dimsum.cache.v1';
let mem = null;

export async function dimsumCatalog() {
  if (mem) return mem;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && Date.now() - c.at < 24 * 3600 * 1000) { mem = c.dishes; return mem; }
  } catch { /* ignore a corrupt cache */ }
  try {
    const [catalogue, rel] = await Promise.all([fetch(CATALOG_URL).then((r) => r.json()), fetch(RELEASES_URL).then((r) => r.json())]);
    const assets = new Map();
    for (const r of Array.isArray(rel) ? rel : []) {
      if (r.draft || !/^catalog-v1(?:-part-\d+)?$/.test(r.tag_name)) continue;
      for (const a of r.assets || []) if (/\.png$/i.test(a.name)) assets.set(a.name, a.browser_download_url);
    }
    const dishes = (catalogue.dishes || []).map((d) => ({ id: d.id, name: d.name, description: d.description, alt: d.image?.alt, photo: assets.get(d.image?.path?.split('/').pop()) || null })).filter((d) => d.name?.en && d.name?.zhHant);
    mem = dishes;
    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), source: CATALOG_URL, dishes })); } catch { /* quota */ }
    return dishes;
  } catch { return []; }
}

export const dishImage = (d) => d.photo || null;

export async function maybeSurprise({ firstRun, busy }) {
  if (schoolOn() || firstRun || busy?.()) return;
  if (Math.random() >= 0.1) return;
  const dishes = (await dimsumCatalog()).filter((d) => d.photo);
  if (!dishes.length || busy?.()) return;
  showSurprise(dishes[Math.floor(Math.random() * dishes.length)]);
}

/** Shows one dish. The card waits while it has focus or the pointer, and hands focus back when it leaves. */
export function showSurprise(d) {
  document.querySelector('.dimsum')?.remove();
  const missing = () => h('div.empty.small', icon('image_not_supported'), pair('Photo unavailable right now.', '暫時睇唔到相。'));
  const img = d.photo ? h('img', { src: d.photo, alt: d.alt?.en || d.name.en, loading: 'lazy' }) : missing();
  if (d.photo) img.addEventListener('error', () => img.replaceWith(missing()));
  let cameFrom = null, timer = 0, left = reducedMotion() ? 6000 : 8000, since = 0;
  const card = h('div.dimsum', { role: 'status', 'aria-label': pair('Dim sum surprise', '點心驚喜') }, img,
    h('div', { style: { padding: '14px' } }, h('div.small.muted', pair('Dim sum surprise', '點心驚喜')), h('b', { style: { fontSize: '18px', display: 'block' } }, d.name.en), h('div', d.name.zhHant)),
    h('button.icon-btn.sm', { style: { position: 'absolute', top: '8px', right: '8px', background: 'var(--surface)' }, 'aria-label': pair('Dismiss', '關閉'), on: { click: () => leave() } }, icon('close')));
  const leave = () => {
    clearTimeout(timer);
    if (card.contains(document.activeElement)) (cameFrom?.isConnected ? cameFrom : document.getElementById('outlet'))?.focus({ preventScroll: true });
    card.remove();
  };
  const held = () => card.matches(':hover') || card.contains(document.activeElement);
  const run = () => { if (timer || !card.isConnected || held()) return; since = Date.now(); timer = setTimeout(leave, Math.max(left, 2000)); };
  const hold = () => { if (!timer) return; clearTimeout(timer); timer = 0; left -= Date.now() - since; };
  card.addEventListener('focusin', (e) => { if (e.relatedTarget && !card.contains(e.relatedTarget)) cameFrom = e.relatedTarget; hold(); });
  card.addEventListener('pointerenter', hold);
  card.addEventListener('focusout', (e) => { if (!card.contains(e.relatedTarget)) setTimeout(run, 0); });
  card.addEventListener('pointerleave', () => setTimeout(run, 0));
  card.addEventListener('keydown', (e) => { if (e.key === 'Escape') leave(); });
  document.body.append(card);
  run();
  return card;
}
