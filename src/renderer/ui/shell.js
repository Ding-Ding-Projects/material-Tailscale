import { h, icon, clear, transition, fmtDateTime } from '../core/dom.js';
import { t, tl, pair, onChange as onLang } from '../core/i18n.js';
import * as store from '../core/store.js';
import { menu } from './overlay.js';
import { logoSvg } from './logo.js';

// Every destination. `rail` ones show in the navigation rail; all of them are
// in the New tab catalogue and the command palette.
export const DESTS = [
  { id: 'home', icon: 'home', rail: true },
  { id: 'peers', icon: 'hub', rail: true },
  { id: 'exit', icon: 'travel_explore', rail: true },
  { id: 'routes', icon: 'alt_route', rail: true },
  { id: 'serve', icon: 'lan', rail: true },
  { id: 'taildrop', icon: 'move_to_inbox', rail: true },
  { id: 'dns', icon: 'dns', rail: true },
  { id: 'lock', icon: 'enhanced_encryption', rail: true },
  { id: 'drive', icon: 'folder_shared', rail: true },
  { id: 'certs', icon: 'verified', rail: false },
  { id: 'accounts', icon: 'group', rail: true },
  { id: 'diagnostics', icon: 'monitor_heart', rail: true },
  { id: 'cli', icon: 'terminal', rail: true, sep: true },
  { id: 'admin', icon: 'admin_panel_settings', rail: true },
  { id: 'console', icon: 'keyboard', rail: false },
  { id: 'tools', icon: 'construction', rail: true, sep: true },
  { id: 'authenticator', icon: 'pin', rail: false },
  { id: 'base64', icon: 'data_object', rail: false },
  { id: 'converter', icon: 'swap_horiz', rail: false },
  { id: 'regex', icon: 'regular_expression', rail: false },
  { id: 'draw', icon: 'draw', rail: false },
  { id: 'ollama', icon: 'smart_toy', rail: false },
  { id: 'minecraft', icon: 'grass', rail: false },
  { id: 'docs', icon: 'menu_book', rail: true },
  { id: 'status', icon: 'monitoring', rail: false },
  { id: 'history', icon: 'history', rail: false },
  { id: 'changelog', icon: 'update', rail: false },
  { id: 'notifications', icon: 'notifications', rail: false },
  { id: 'settings', icon: 'settings', rail: true, sep: true },
  { id: 'about', icon: 'info', rail: false }
];

const pages = new Map();
export function registerPage(id, render) { pages.set(id, render); }

let tabs = store.get('tabs') || [{ id: 'ws', kind: 'workspace', dest: 'home' }];
let active = tabs[0].id;
let outlet, strip, railEl, titleEl, provEl;
const tabViews = new Map();
let currentCleanup = null;

export const appName = () => store.get('displayName') || t('appName');

function saveTabs() { store.set('tabs', tabs.map(({ id, kind, dest, arg }) => ({ id, kind, dest, arg })), { record: false }); }

export function mountShell(info) {
  const maxBtn = h('button.win-btn', { 'aria-label': pair('Maximise', '放大'), on: { click: () => window.mt.win.maximize() } }, icon('crop_square'));
  window.mt.win.onState(({ maximized }) => { maxBtn.firstChild.textContent = maximized ? 'filter_none' : 'crop_square'; });
  titleEl = h('span', appName());
  const b = info.build;
  provEl = h('span.prov', { dataset: { el: 'provenance' } }, b ? `v${b.version} · ${b.codeName || ''} · ${t('updated')} ${fmtDateTime(b.commitTime)}` : pair(`v${info.version} · build provenance unavailable`, `v${info.version} · 冇建置來源資料`));
  const titlebar = h('header.titlebar', { dataset: { el: 'titlebar' } },
    h('div.brand', logoSvg(22), titleEl), provEl, h('div.grow'),
    h('button.palette-trigger', { dataset: { el: 'palette-trigger' }, on: { click: () => window.dispatchEvent(new CustomEvent('mt:palette')) } }, icon('search'), h('span', pair('Search everything', '搜尋全部')), h('kbd', 'Ctrl+Shift+F')),
    h('button.win-btn', { 'aria-label': t('notifications'), on: { click: () => openDest('notifications') } }, icon('notifications')),
    h('button.win-btn', { 'aria-label': pair('Accessibility tools', '無障礙工具'), dataset: { el: 'a11y-button' }, on: { click: (e) => window.dispatchEvent(new CustomEvent('mt:a11y', { detail: e.currentTarget })) } }, icon('accessibility_new')),
    h('button.win-btn', { 'aria-label': pair('Minimise', '縮細'), on: { click: () => window.mt.win.minimize() } }, icon('remove')),
    maxBtn,
    h('button.win-btn.close', { 'aria-label': t('close'), on: { click: () => window.mt.win.close() } }, icon('close')));
  titlebar.addEventListener('dblclick', (e) => { if (e.target.classList.contains('grow')) window.mt.win.maximize(); });
  railEl = h('nav.rail', { 'aria-label': pair('Destinations', '目的地'), dataset: { el: 'rail' } });
  strip = h('div.tabstrip', { role: 'tablist', 'aria-label': pair('Tabs', '分頁'), dataset: { el: 'tabstrip' } });
  outlet = h('main.outlet', { id: 'outlet', tabindex: '-1' });
  const app = h('div#app', titlebar, h('div.body', railEl, h('div.main', strip, outlet)));
  document.body.append(h('div.ambient', { 'aria-hidden': 'true' }), app);
  renderRail(); renderTabs(); render();
  onLang(() => { titleEl.textContent = appName(); renderRail(); renderTabs(); render(); });
  store.on((k) => { if (k === 'displayName') { titleEl.textContent = appName(); window.mt.win.title(appName()); } });
  window.mt.win.title(appName());
}

function renderRail() {
  clear(railEl);
  const cur = tabs.find((x) => x.id === active);
  for (const d of DESTS.filter((x) => x.rail)) {
    if (d.sep) railEl.append(h('div.rail-sep'));
    railEl.append(h('button.rail-item', { 'aria-current': cur?.dest === d.id ? 'page' : null, dataset: { el: 'rail-' + d.id }, on: { click: () => openDest(d.id) } }, h('span.pill', icon(d.icon)), tl(d.id)));
  }
}

function renderTabs() {
  clear(strip);
  for (const tb of tabs) {
    const d = DESTS.find((x) => x.id === tb.dest) || DESTS[0];
    const label = tb.kind === 'workspace' ? pair('Tailnet', 'Tailnet') + ' · ' + t(d.id) : t(d.id) + (tb.arg ? ` · ${tb.arg}` : '');
    const el = h('div.tab', { role: 'tab', tabindex: tb.id === active ? '0' : '-1', 'aria-selected': String(tb.id === active), dataset: { el: 'tab-' + tb.id }, on: { click: () => selectTab(tb.id), auxclick: (e) => { if (e.button === 1 && tb.kind !== 'workspace') closeTab(tb.id); } } },
      icon(tb.kind === 'workspace' ? 'lan' : d.icon), h('span.label', label),
      tb.kind !== 'workspace' ? h('button.x', { 'aria-label': pair(`Close ${label}`, `關閉 ${label}`), on: { click: (e) => { e.stopPropagation(); closeTab(tb.id); } } }, icon('close')) : null);
    el.addEventListener('keydown', (e) => {
      const i = tabs.findIndex((x) => x.id === tb.id);
      if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length].id, true);
      if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length].id, true);
      if (e.key === 'Delete' && tb.kind !== 'workspace') closeTab(tb.id);
    });
    strip.append(el);
  }
  strip.append(h('button.tab-new', { 'aria-label': t('newTab'), title: `${t('newTab')} (Ctrl+T)`, dataset: { el: 'tab-new' }, on: { click: (e) => newTabCatalog(e.currentTarget) } }, icon('add')));
}

export function newTabCatalog(anchor) {
  menu(anchor || strip, DESTS.map((d) => ({ label: t(d.id), icon: d.icon, run: () => openInNewTab(d.id) })), { title: t('newTab') });
}

export function openInNewTab(dest, arg) {
  const id = 't' + Date.now();
  tabs.push({ id, kind: 'utility', dest, arg });
  active = id; saveTabs(); renderTabs(); renderRail(); render();
}

export function selectTab(id, focus) {
  if (active === id) { outlet.focus(); return; }
  active = id; renderTabs(); renderRail(); render();
  if (focus) strip.querySelector('[aria-selected="true"]')?.focus();
}

export function closeTab(id) {
  const i = tabs.findIndex((x) => x.id === id);
  if (i < 0 || tabs[i].kind === 'workspace') return;
  tabs.splice(i, 1); tabViews.delete(id);
  if (active === id) active = tabs[Math.max(0, i - 1)].id;
  saveTabs(); renderTabs(); renderRail(); render();
}

/** Ordinary navigation reuses the workspace tab; it never adds tabs. */
export function openDest(dest, arg) {
  const ws = tabs.find((x) => x.kind === 'workspace');
  const cur = tabs.find((x) => x.id === active);
  if (cur && cur.kind !== 'workspace' && cur.dest === dest) { cur.arg = arg; render(); return; }
  ws.dest = dest; ws.arg = arg; active = ws.id;
  saveTabs(); renderTabs(); renderRail(); render();
}

export function currentDest() { return tabs.find((x) => x.id === active)?.dest; }

export function render() {
  const tb = tabs.find((x) => x.id === active) || tabs[0];
  const fn = pages.get(tb.dest) || pages.get('home');
  transition(() => {
    currentCleanup?.(); currentCleanup = null;
    clear(outlet);
    const ctx = { arg: tb.arg, onCleanup: (f) => { currentCleanup = f; } };
    try { outlet.append(fn(ctx)); } catch (e) { outlet.append(h('div.card', h('h2', pair('This page failed to render', '呢頁顯示唔到')), h('div.out', String(e.stack || e)))); console.error(e); }
    outlet.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('mt:rendered', { detail: tb.dest }));
  });
}

export const getOutlet = () => outlet;
