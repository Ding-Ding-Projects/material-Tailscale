// Ctrl+Shift+F command palette: every destination, CLI command, CLI flag,
// admin API operation, setting (with its live control inline), doc article and
// action. Selecting a result teleports to the exact element and highlights it.
import { h, icon, clear } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import { DESTS, openDest, newTabCatalog } from './shell.js';
import { COMMANDS } from '../../shared/cli-catalog.js';
import { YUE_TITLES } from './cli-yue.js';
import { SETTINGS_INDEX } from '../pages/settings-index.js';
import { ARTICLES } from '../docs-bundle.js';
import { liveOption } from './live-options.js';
import { settingLive } from './setting-live.js';
import { announce, holdFocus } from './overlay.js';
import { current as extensionsState, refresh as refreshExtensions, actionsFor as extensionActions, loc as extLoc } from './extensions-client.js';

let open = null;
let apiOps = [];
window.mt?.apiCatalog().then((c) => { apiOps = c.operations; }).catch(() => {});

export function teleport(selector, dest, arg) {
  if (dest) openDest(dest, arg);
  let tries = 0;
  const find = () => {
    const el = document.querySelector(selector);
    if (!el) { if (tries++ < 40) setTimeout(find, 60); return; }
    el.closest('div[hidden]')?.removeAttribute('hidden');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (el.matches('button,input,select,textarea,[tabindex]') ? el : el.querySelector('button,input,select,textarea,[tabindex]') || el).focus?.({ preventScroll: true });
    el.classList.remove('teleport-hl'); void el.offsetWidth; el.classList.add('teleport-hl');
  };
  setTimeout(find, 80);
}

function entries() {
  const out = [];
  for (const d of DESTS) out.push({ group: pair('Destinations', '目的地'), title: t(d.id), sub: d.id, icon: d.icon, run: () => openDest(d.id) });
  out.push({ group: pair('Actions', '動作'), title: t('newTab'), sub: 'Ctrl+T', icon: 'tab', run: () => newTabCatalog() });
  out.push({ group: pair('Actions', '動作'), title: t('connect'), sub: 'tailscale up', icon: 'power', run: () => window.mt.ts.run('up', {}) });
  out.push({ group: pair('Actions', '動作'), title: t('disconnect'), sub: 'tailscale down', icon: 'power_off', run: () => window.mt.ts.run('down', {}) });
  for (const c of COMMANDS) {
    out.push({ group: pair('Commands', '指令'), title: pair(c.title, YUE_TITLES[c.id]), sub: 'tailscale ' + c.path.join(' '), icon: c.icon || 'terminal', run: () => openDest('cli', c.id) });
    for (const f of c.flags || []) out.push({ group: pair('Flags', '旗標'), title: `--${f.name}`, sub: `tailscale ${c.path.join(' ')} · ${f.desc}`, icon: 'flag', run: () => teleport(`[data-el="cmd-${c.id}-flag-${f.name}"]`, 'cli', c.id) });
  }
  if (window.mt?.ext) {
    const g = t('extensions');
    out.push({ group: g, title: pair('Add an extension from a folder', '由資料夾加入擴充功能'), sub: 'extensions', icon: 'create_new_folder', run: () => teleport('[data-el="ext-add"]', 'extensions') });
    out.push({ group: g, title: pair('Open the extensions folder', '打開擴充功能資料夾'), sub: 'extensions', icon: 'folder_open', run: () => window.mt.ext.openFolder() });
    out.push({ group: g, title: pair('Extensions can run', '擴充功能可以執行'), sub: pair('Turn every extension off or on at once', '一次過開關所有擴充功能'), icon: 'power_settings_new', run: () => teleport('[data-el="ext-master"]', 'extensions'),
      live: { kind: 'switch', get: () => !extensionsState().masterOff, set: (on) => window.mt.ext.setMasterOff(!on).then(() => refreshExtensions()) } });
    for (const { ext, action } of extensionActions('peer.action')) out.push({ group: g, title: `${extLoc(ext.manifest.name)}: ${extLoc(action.title)}`, sub: pair('On a device: open Peers and use its menu', '用喺裝置：打開裝置頁再用佢嘅選單'), icon: action.icon || 'extension', run: () => openDest('peers') });
  }
  for (const op of apiOps) out.push({ group: pair('Admin API', '管理 API'), title: op.summary, sub: `${op.method} ${op.path}`, icon: 'api', run: () => { openDest('admin', 'Everything'); } });
  for (const s of SETTINGS_INDEX) out.push({ group: t('settings'), title: pair(s.en, s.yue), sub: s.help, icon: 'tune', live: settingLive(s.key)?.live, run: () => teleport(`[data-el="set-${s.key}"]`, 'settings', s.section) });
  for (const a of ARTICLES) out.push({ group: t('docs'), title: a.title, sub: a.path, icon: 'article', run: () => openDest('docs', a.path) });
  return out;
}

export function closePalette() { open?.close(); }

export function openPalette() {
  if (open) { open.close(); return; }
  const size = store.get('paletteSize');
  const prev = document.activeElement;
  const input = h('input', { placeholder: pair('Search commands, flags, settings, docs, API…', '搜尋指令、旗標、設定、文件、API…'), 'aria-label': t('search'), role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-results' });
  let re = false;
  const reBtn = h('button.icon-btn', { 'aria-pressed': 'false', 'aria-label': pair('Regex search', '正則搜尋'), on: { click: () => { re = !re; reBtn.setAttribute('aria-pressed', String(re)); reBtn.style.color = re ? 'var(--primary)' : ''; draw(); input.focus(); } } }, h('span.mono', '.*'));
  const sizeBtn = h('button.icon-btn', { 'aria-label': pair('Toggle full window', '切換全視窗'), on: { click: () => { const n = store.get('paletteSize') === 'card' ? 'full' : 'card'; store.set('paletteSize', n); box.classList.toggle('full', n === 'full'); input.focus(); } } }, icon('open_in_full'));
  const results = h('div.results#pal-results', { role: 'listbox' });
  const all = entries();
  let sel = 0, shown = [], lives = [];
  const draw = () => {
    clear(results);
    lives = [];
    const q = input.value.trim();
    let test = (s) => s.toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (s) => r.test(s); } catch { test = () => false; } }
    shown = (q ? all.filter((e) => test(`${e.title} ${e.sub || ''} ${e.group}`)) : all.filter((e) => !['Flags', '旗標', 'Admin API', '管理 API'].some((g) => e.group.includes(g)))).slice(0, 400);
    let g = null;
    shown.forEach((e, i) => {
      if (e.group !== g) { g = e.group; results.append(h('div.pal-group', g)); }
      // A setting's live value is drawn inside its option; Left and Right change it, Enter goes to it.
      const live = e.live ? liveOption(e.live, { announce }) : null;
      const row = h('div.pal-row', { role: 'option', id: 'pal-' + i, 'aria-selected': String(i === sel), on: { click: () => choose(i), mousemove: () => { if (sel !== i) { sel = i; mark(); } } } }, icon(e.icon), h('div.ttl', h('b', e.title), e.sub ? h('span', e.sub) : null), live?.visual);
      if (live) {
        // The option keeps its visible text as its name; the value and the keys go in its description.
        const desc = () => { row.setAttribute('aria-description', `${live.state()}. ${live.hint()}. ${pair('Enter goes to the setting', '撳 Enter 去設定')}`); if (live.checked() !== null) row.setAttribute('aria-checked', String(live.checked())); };
        live.onChange(desc); desc();
      }
      lives[i] = live;
      results.append(row);
    });
    if (!shown.length) results.append(h('div.empty', icon('search_off'), pair('Nothing matches.', '冇嘢符合。')));
    mark();
  };
  const mark = () => { results.querySelectorAll('.pal-row').forEach((r, i) => r.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', 'pal-' + sel); results.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); };
  const choose = (i) => { const e = shown[i]; if (!e) return; close(); e.run(); };
  input.addEventListener('input', () => { sel = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && lives[sel]) { if (lives[sel].key(e)) e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  const box = h('div.palette' + (size === 'full' ? '.full' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': pair('Command palette', '指令面板') }, h('div.head', icon('search'), input, reBtn, sizeBtn, h('button.icon-btn', { 'aria-label': t('close'), on: { click: () => close() } }, icon('close'))), results);
  const scrim = h('div.scrim', { style: { background: 'rgba(4,6,14,.35)' }, on: { mousedown: (e) => { if (e.target === scrim) close(); } } });
  document.body.append(scrim, box);
  const release = holdFocus(box);
  const unlisten = store.on(() => lives.forEach((l) => l?.sync()));
  const close = () => { release(); unlisten(); box.remove(); scrim.remove(); open = null; prev?.focus?.(); };
  open = { close };
  draw();
  input.focus();
}
