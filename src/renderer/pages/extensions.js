// Extensions manager: every installed extension with its state, what it adds, what it may
// see or do, its recent runs and any manifest problems, with consent, on and off, add,
// remove, the extensions folder and a switch that turns all of them off.
import { h, icon, clear, fmtDateTime } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import { registerPage, openDest } from '../ui/shell.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { toast, menu, confirmDialog } from '../ui/overlay.js';
import { regexField } from '../ui/regex.js';
import { switchCtl } from '../ui/controls.js';
import * as X from '../ui/extensions-client.js';
import API from '../../shared/extension-api.js';

const AUTHORING = 'docs/features/extensions/writing-extensions.md';

function stateBadge(i) {
  if (!i.valid) return h('span.badge.err', icon('error'), pair('Manifest problems', '清單有問題'));
  if (i.consent === 'needed') return h('span.badge.warn', icon('shield'), pair('Waiting for your permission', '等你批准'));
  if (i.consent === 'changed') return h('span.badge.warn', icon('published_with_changes'), pair('Changed: review again', '有改動：再審閱'));
  return i.enabled ? h('span.badge.ok', icon('check_circle'), pair('On', '開')) : h('span.badge.info', icon('pause_circle'), pair('Off', '關'));
}

async function addFromFolder() {
  let r = await X.act(() => window.mt.ext.add({}));
  if (!r || r.canceled) return;
  if (r.confirm) {
    const ok = await confirmDialog(pair('Replace the installed version?', '取代已安裝嘅版本？'),
      pair(`${r.id} ${r.from || '(unreadable)'} is installed. Replace it with ${r.to}? The new version stays off until you allow it.`, `已安裝 ${r.id} ${r.from || '（讀唔到）'}。要換成 ${r.to} 嗎？新版本要你批准先會開。`), { okLabel: pair('Replace', '取代') });
    if (!ok) return;
    r = await X.act(() => window.mt.ext.add({ replace: true }));
    if (!r) return;
  }
  if (r.added) toast(pair(`Added ${r.added}. Review it to turn it on.`, `已加入 ${r.added}。審閱之後就可以開。`), { kind: 'ok' });
}

function card(i, draw) {
  const m = i.manifest;
  const name = m ? X.loc(m.name) : i.id;
  const n = m ? X.names(m.name) : { en: i.id, yue: i.id };
  const sw = i.valid && i.consent === 'granted' ? switchCtl(!!i.enabled, { label: pair(`${n.en} on or off`, `${n.yue} 開或者關`) }) : null;
  sw?.onChange(async (on) => { await X.act(() => window.mt.ext.setEnabled(i.id, on)); draw(); });
  const more = h('button.icon-btn.sm', { 'aria-label': pair(`More for ${n.en}`, `${n.yue} 更多動作`), on: { click: (e) => menu(e.currentTarget, [
    { label: pair('Show in folder', '喺資料夾顯示'), icon: 'folder_open', run: () => window.mt.shell.openPath(i.folder) },
    i.valid ? { label: pair('Review permissions', '審閱權限'), icon: 'shield', run: async () => { await X.reviewConsent(i); draw(); } } : null,
    '-',
    { label: pair('Remove', '移除'), icon: 'delete', run: async () => {
      if (!(await confirmDialog(pair(`Remove ${n.en}?`, `移除 ${n.yue}？`), pair(`Its folder is deleted${i.builtIn ? '; as a built-in extension it will not come back unless you add it again' : ''}.`, `會刪除佢嘅資料夾${i.builtIn ? '；內置擴充功能唔會自己返嚟，除非你再加' : ''}。`), { okLabel: pair('Remove', '移除'), danger: true }))) return;
      await X.act(() => window.mt.ext.remove(i.id)); toast(pair(`Removed ${n.en}.`, `已移除 ${n.yue}。`), { kind: 'ok' }); draw();
    } }
  ].filter(Boolean)) } }, icon('more_vert'));
  const runs = (i.runs || []).slice(0, 3);
  return h('section.card.span-6.ext-card', { dataset: { el: 'ext-' + i.id } },
    h('div.row.nowrap.ext-head', h('span.ic', icon('extension')),
      h('div.ext-title', h('h2.h3', name), h('span.small.muted.mono', `${i.id}${m ? ' · ' + m.version : ''}`)),
      sw ? sw.el : null, more),
    h('div.row', stateBadge(i), i.builtIn ? h('span.badge.info', icon('verified'), pair('Built in', '內置')) : null, i.modified ? h('span.badge.warn', icon('edit'), pair('Modified', '改過')) : null),
    m ? h('p', X.loc(m.description)) : null,
    m ? h('div.stack.ext-adds', h('b.small', pair('Adds', '加入')), m.actions.map((a) => h('div.ext-line', icon(a.icon || API.HOOKS[a.hook].icon), h('span', h('b', X.loc(a.title)), ' · ', X.hookText(a.hook))))) : null,
    m ? h('div.stack.ext-perms', h('b.small', pair('May', '可以')), m.permissions.map((p) => h('div.ext-line', { title: X.permText(p) }, icon(API.PERMISSIONS[p].icon), h('span', h('code', p), ' ', X.permText(p))))) : null,
    !i.valid ? h('div.stack.ext-errors', h('b.small', pair('What to fix in manifest.json', 'manifest.json 要改嘅地方')), h('ul', i.errors.map((e) => h('li.err-text', e)))) : null,
    runs.length ? h('div.stack.ext-runs', h('b.small', pair('Recent runs', '最近執行')), runs.map((r) => h('div.ext-line', h('span.state-mark', h(`span.dot-live.${r.ok ? 'ok' : 'err'}`, { 'aria-hidden': 'true' }),
      h('span', h('b', r.action), ` · ${r.ok ? pair('worked', '成功') : pair('failed', '失敗')} · ${fmtDateTime(r.at)} · ${r.ms} ms`, r.error ? h('span.err-text', ` · ${r.error}`) : null))))) : null,
    i.valid && i.consent !== 'granted' ? h('div.row', h('button.btn.small', { dataset: { el: 'ext-review-' + i.id }, on: { click: async () => { await X.reviewConsent(i); draw(); } } }, icon('shield'), pair('Review and allow…', '審閱同批准…'))) : null);
}

registerPage('extensions', () => {
  const stats = h('div');
  const list = h('div.grid.stagger');
  const waiting = h('div');
  const master = switchCtl(false, { label: pair('Extensions can run', '擴充功能可以執行') });
  master.el.dataset.el = 'ext-master';
  master.onChange(async (on) => { await X.act(() => window.mt.ext.setMasterOff(!on)); draw(); });
  const search = regexField({ id: 'extensions', placeholder: pair('Search extensions, actions and permissions', '搜尋擴充功能、動作同權限'), onChange: () => draw() });
  const draw = () => {
    const c = X.current();
    master.set(!c.masterOff);
    const { q, re } = search.value();
    let test = (s) => s.toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (s) => r.test(s); } catch { test = () => true; } }
    const text = (i) => [i.id, i.manifest ? [X.loc(i.manifest.name), X.loc(i.manifest.description), ...i.manifest.actions.map((a) => `${X.loc(a.title)} ${a.hook}`), ...i.manifest.permissions].join(' ') : (i.errors || []).join(' ')].join(' ');
    const shown = q ? c.items.filter((i) => test(text(i))) : c.items;
    const need = c.items.filter((i) => i.valid && i.consent !== 'granted');
    clear(stats).append(heroStats([
      { value: c.items.length, label: pair('installed', '已安裝') },
      { value: c.items.filter((i) => i.enabled).length, label: pair('on', '開緊'), tone: 'ok' },
      { value: need.length, label: pair('waiting for you', '等你'), tone: need.length ? 'warn' : undefined }
    ]));
    clear(waiting);
    if (need.length && !c.masterOff) waiting.append(h('section.card.tonal.ext-waiting', { dataset: { el: 'ext-waiting' } },
      h('div.row.nowrap', h('span.ic.warm', icon('shield')), h('div', h('h2.h3', pair(`${need.length} waiting for your permission`, `${need.length} 個等你批准`)), h('p.small.muted', pair('New extensions, and extensions whose version or permissions changed, stay off until you review them.', '新嘅擴充功能，同改過版本或者權限嘅擴充功能，要你審閱先會開。')))),
      h('div.row', need.map((i) => h('button.btn.small.tonal', { on: { click: async () => { await X.reviewConsent(i); draw(); } } }, icon('shield'), X.loc(i.manifest.name))))));
    clear(list);
    if (!c.items.length) list.append(h('section.card.span-12.empty', icon('extension_off'), h('h2.h3', pair('No extensions yet', '仲未有擴充功能')), h('p', pair('Add a folder that holds a manifest.json, or read how to write one.', '加一個有 manifest.json 嘅資料夾，或者睇吓點寫。'))));
    else if (!shown.length) list.append(h('div.empty.span-12', icon('search_off'), pair('No extension matches.', '冇擴充功能符合。')));
    shown.forEach((i, n) => { const el = card(i, draw); el.style.setProperty('--i', n); list.append(el); });
  };
  // Follows changes while the page is on screen; lets go once it has left.
  let shownOnce = false;
  const off = X.onChange(() => { if (page.isConnected) { shownOnce = true; draw(); } else if (shownOnce) off(); });
  const page = h('div.page',
    pageHero(pair('Add-ons', '附加功能'), t('extensions'),
      pair('Small programs, in any language, that add actions to your devices and checks to Diagnostics. Each one waits for your permission and sees only what you allow.', '用任何語言寫嘅小程式，為你嘅裝置加動作、為診斷加檢查。每個都要等你批准，亦只睇到你批准嘅嘢。'),
      h('button.btn', { dataset: { el: 'ext-add' }, on: { click: async () => { await addFromFolder(); draw(); } } }, icon('create_new_folder'), pair('Add from folder…', '由資料夾加入…')),
      h('button.btn.outline', { dataset: { el: 'ext-folder' }, on: { click: () => X.act(() => window.mt.ext.openFolder()) } }, icon('folder_open'), pair('Open extensions folder', '打開擴充功能資料夾')),
      h('button.btn.outline', { dataset: { el: 'ext-reload' }, on: { click: async () => { await X.refresh(); toast(pair('Extensions reloaded.', '已重新載入擴充功能。'), { kind: 'ok' }); } } }, icon('refresh'), pair('Reload', '重新載入')),
      stats),
    h('section.card.ext-master', h('div.row.nowrap', h('span.ic', icon('power_settings_new')),
      h('div', { style: { flex: 1 } }, h('h2.h3', pair('Extensions can run', '擴充功能可以執行')), h('p.small.muted', pair('Turn this off to stop every extension at once. Their permissions are kept.', '關咗佢就即刻停晒所有擴充功能，權限會保留。'))),
      master.el),
      h('p.small.muted', pair('An extension is a program that runs as you. The app hands it only what its permissions name, never keys, tokens, e-mail addresses or anything in the system vault, stops it after five seconds and checks every answer, but it cannot stop an extension from reading your files or using the network on its own. Add only extensions you trust.', '擴充功能係用你身份運行嘅程式。程式只會交俾佢權限講明嘅嘢，永遠唔會交金鑰、權杖、電郵或者系統保險箱入面嘅嘢，五秒就會停佢，仲會檢查每個答覆；但阻止唔到佢自己讀你嘅檔案或者上網。只加你信得過嘅擴充功能。'))),
    waiting,
    h('div.row', search.el),
    list,
    h('section.card.tonal.ext-write', h('div.row', h('span.ic.alt', icon('code_blocks')), h('div', { style: { flex: '1 1 260px', minWidth: 0 } }, h('h2.h3', pair('Write your own', '自己寫一個')),
      h('p.small.muted', pair(`A folder with manifest.json and a program in any language: one JSON request in on standard input, one JSON answer out on standard output. Protocol version ${API.API_VERSION}.`, `一個有 manifest.json 同任何語言程式嘅資料夾：標準輸入收一個 JSON 請求，標準輸出答一個 JSON。協定版本 ${API.API_VERSION}。`))),
      h('button.btn.outline', { dataset: { el: 'ext-docs' }, on: { click: () => openDest('docs', AUTHORING) } }, icon('menu_book'), pair('How to write one', '點樣寫')))));
  X.refresh().then(draw);
  draw();
  return page;
});
