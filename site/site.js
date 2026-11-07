// Material Tailscale website: landing, docs, download, status, changelog,
import { pageHero, heroStats } from '../src/renderer/ui/hero.js';
// settings and tools. It reuses the desktop app's own UI modules through a
// browser shim, so every personalisation and safety feature works here too.
import './shim.js';
import { h, icon, clear, transition, fmtDateTime } from '../src/renderer/core/dom.js';
import * as store from '../src/renderer/core/store.js';
import * as i18n from '../src/renderer/core/i18n.js';
import { t, tl, pair } from '../src/renderer/core/i18n.js';
import { setRouter, getPage } from '../src/renderer/ui/shell.js';
import { mountOverlays, toast, menu, confirmDialog, popover } from '../src/renderer/ui/overlay.js';
import { applyAppearance, editAppearance } from '../src/renderer/ui/appearance.js';
import { lockWizard, applyLocks } from '../src/renderer/ui/locks.js';
import { celebrate } from '../src/renderer/ui/celebrate.js';
import { maybeSurprise } from '../src/renderer/ui/dimsum.js';
import { readAloud } from '../src/renderer/core/feedback.js';
import { logoSvg } from '../src/renderer/ui/logo.js';
import { ARTICLES } from '../src/renderer/docs-bundle.js';
import { SETTINGS_INDEX } from '../src/renderer/pages/settings-index.js';
import { runSchedules } from '../src/renderer/core/schedules.js';
import { COMMANDS } from '../src/shared/cli-catalog.js';
import '../src/renderer/pages/settings.js';
import '../src/renderer/pages/tools.js';
import '../src/renderer/pages/base64.js';
import '../src/renderer/pages/meta.js';
import { settingLive } from '../src/renderer/ui/setting-live.js';
import { watchScrollRegions } from '../src/renderer/ui/scroll-focus.js';
import { revealFocus } from '../src/renderer/ui/focus-reveal.js';

const S = window.__SITE__ || {};
const REL = window.__RELEASE__ || null;
const NAV = [['home', 'Home', '主頁', 'home'], ['features', 'Features', '功能', 'auto_awesome'], ['docs', 'Docs', '說明文件', 'menu_book'], ['download', 'Download', '下載', 'download'], ['changelog', 'Changelog', '更新紀錄', 'update'], ['status', 'Status', '狀態', 'monitoring'], ['tools', 'Tools', '工具', 'construction'], ['settings', 'Settings', '設定', 'settings']];
let current = 'home', currentArg = null, cleanup = null;
const outlet = h('div.outlet#outlet', { tabindex: '-1', style: { overflow: 'visible' } });

function parseHash() { const [d, ...rest] = location.hash.replace(/^#\/?/, '').split('/'); return [d || 'home', rest.length ? decodeURIComponent(rest.join('/')) : null]; }
function open(dest, arg) { location.hash = '#/' + dest + (arg ? '/' + encodeURIComponent(arg) : ''); }
function render() {
  [current, currentArg] = parseHash();
  transition(() => {
    cleanup?.(); cleanup = null; clear(outlet);
    const ctx = { arg: currentArg, onCleanup: (f) => { cleanup = f; } };
    const local = LOCAL[current];
    const fn = local || (DESKTOP_ONLY[current] ? desktopOnly(current) : getPage(current)) || desktopOnly(current);
    try { outlet.append(fn(ctx)); } catch (e) { outlet.append(h('div.card', h('h2', pair('This page failed to render', '呢頁顯示唔到')), h('div.out', String(e)))); }
    drawNav(); window.scrollTo({ top: 0 });
    document.title = `${NAV.find((n) => n[0] === current)?.[1] || 'Material Tailscale'} · Material Tailscale`;
  });
}
setRouter({ open, render, current: () => current });
addEventListener('hashchange', render);

const navBox = h('nav.site-nav', { 'aria-label': pair('Site', '網站') });
function drawNav() {
  clear(navBox).append(...NAV.map(([id, en, yue, ic]) => h('a.site-link', { href: '#/' + id, 'aria-current': current === id ? 'page' : null, dataset: { el: 'nav-' + id } }, icon(ic), h('span', pair(en, yue)))));
}

const download = () => {
  const exe = REL?.assets?.find((a) => /Setup\.exe$/i.test(a.name));
  if (!exe) return h('div.card.tonal', h('b', pair('No verified installer is published yet.', '未有已驗證嘅安裝程式。')), h('p.small.muted', pair('This button appears once the release workflow publishes and verifies a build.', '發佈並驗證後先會出現下載掣。')));
  // The accessible name starts with the visible label, then names the file.
  const label = pair(`Download for Windows · ${REL.tag}`, `下載 Windows 版 · ${REL.tag}`);
  return h('div.stack', h('a.btn.big.green', { href: exe.url, dataset: { el: 'download-button' }, 'aria-label': `${label}: ${pair('Material Tailscale installer, Windows x64', 'Material Tailscale 安裝程式，Windows x64')}` }, icon('download'), label),
    h('div.small.muted', pair(`Windows 10 and 11, x64 · ${(exe.size / 1048576).toFixed(1)} MB · published ${fmtDateTime(REL.publishedAt)} · unsigned (Windows may warn about an unknown publisher)`, `Windows 10/11 x64 · ${(exe.size / 1048576).toFixed(1)} MB · 冇簽名`)));
};

const FEATURE_CARDS = [
  ['hub', 'Peers and live status', '裝置同即時狀態', 'Every device with its direct or relayed path, traffic, tags, ping, whois and SSH.'],
  ['travel_explore', 'Exit nodes', '出口節點', 'Pick, suggest, automatic or Mullvad exit nodes, LAN access, and advertising this device.'],
  ['alt_route', 'Subnet routes and app connectors', '子網路由', 'CIDR chip editor with validation, accept routes, SNAT, stateful filtering.'],
  ['lan', 'Serve and Funnel', '分享服務', 'Share a port, URL, file, folder or text with your tailnet or the internet.'],
  ['move_to_inbox', 'Taildrop', '傳檔', 'Drag files in, pick a device, watch progress; receive into any folder.'],
  ['enhanced_encryption', 'Tailnet Lock', '網絡鎖', 'Status, signing, trusted keys, log, disablement and key revocation.'],
  ['folder_shared', 'Taildrive', '共享資料夾', 'Share, rename and unshare folders.'],
  ['dns', 'MagicDNS', 'MagicDNS', 'Local forwarder status and live DNS queries.'],
  ['terminal', `All ${COMMANDS.length} CLI commands`, `全部 ${COMMANDS.length} 個指令`, `${COMMANDS.reduce((n, c) => n + (c.flags || []).length, 0)} flags, each a rich control with a live command preview.`],
  ['admin_panel_settings', 'Admin API: 93 operations', '管理 API：93 個操作', 'Devices, policy file, keys, DNS, users, settings, webhooks, logs, services and more.'],
  ['translate', 'English, Cantonese, both', '英文、廣東話、雙語', 'Two funny-level sliders, personal vocabulary, School mode, narrator.'],
  ['palette', 'Make it yours', '自訂外觀', 'Themes, seed colour with an infinite picker, per-element appearance editor, logos.'],
  ['lock', 'Locks and authenticator', '鎖同驗證器', 'Lock any element with PIN, password or TOTP; built-in RFC 6238 authenticator.'],
  ['search', 'Search everything', '搜尋全部', 'Ctrl+Shift+F palette with live controls; regex builder on every search.'],
  ['history', 'Undo anything', '隨時還原', 'Local Git history of every change, exports in every format.'],
  ['accessibility_new', 'Accessible by default', '無障礙', 'Text size, contrast, reduced motion, focus rings, large targets, read aloud.']
];

// Pages that need this computer (bundled converters, local models, game servers, the Tailscale
// command line) live in the desktop app. Their routes say so instead of failing.
const DESKTOP_ONLY = {
  converter: pair('It converts files on your computer with the bundled ffmpeg and 7-Zip.', '佢用內置嘅 ffmpeg 同 7-Zip 喺你部電腦度轉換檔案。'),
  ollama: pair('It manages the Ollama models installed on your computer.', '佢管理你部電腦度嘅 Ollama 模型。'),
  minecraft: pair('It creates and runs game servers on your computer, in Docker or over SSH.', '佢喺你部電腦、Docker 或者 SSH 度建立同運行遊戲伺服器。'),
  console: pair('It runs tailscale commands on your computer.', '佢喺你部電腦度執行 tailscale 指令。'),
  extensions: pair('It runs programs you add on your computer, so it lives in the desktop app. How to write one is in the docs.', '佢喺你部電腦度執行你加入嘅程式，所以喺桌面版入面。點樣寫一個就睇說明文件。')
};
const desktopOnly = (id) => () => h('div.page',
  pageHero(pair('Desktop app', '桌面版'), DESKTOP_ONLY[id] ? t(id) : pair('In the desktop app', '喺桌面版入面'), `${DESKTOP_ONLY[id] || pair('This page manages Tailscale on your computer, so it lives in the desktop app.', '呢頁管理你部電腦嘅 Tailscale，所以喺桌面版入面。')} ${pair('The website shows everything that can run safely in a browser.', '網站只放可以安全喺瀏覽器運行嘅嘢。')}`,
    h('a.btn', { href: '#/download' }, icon('download'), pair('Download for Windows', '下載 Windows 版')),
    h('a.btn.outline', { href: '#/tools' }, icon('construction'), pair('Tools that run here', '喺度用到嘅工具'))));

const LOCAL = {
  home: () => h('div.page',
    pageHero(pair('Material Tailscale for Windows', 'Windows 版 Material Tailscale'), pair('Every Tailscale switch. One beautiful window.', '所有 Tailscale 開關，一個靚靚嘅窗口。'), pair('A Material 3 Expressive desktop app for Windows that gives every Tailscale command, flag and admin setting a real control. This website is its landing, documentation, download and status page; the app itself runs on your computer.', 'Windows 上嘅 Material 3 桌面程式，將每個 Tailscale 指令、旗標同管理設定變成真正嘅控制項。呢個網站係主頁、文件、下載同狀態頁；程式喺你部電腦運行。'),
      h('a.btn.big', { href: '#/download' }, icon('download'), pair('Download for Windows', '下載 Windows 版')), h('a.btn.outline.big', { href: '#/docs' }, icon('menu_book'), pair('Read the docs', '睇文件')), h('a.btn.text', { href: 'https://github.com/Ding-Ding-Projects/material-Tailscale' }, icon('code'), 'GitHub'),
      heroStats([{ value: '93', label: pair('API operations', '個 API 操作') }, { value: '73', label: pair('commands', '個指令') }, { value: String(ARTICLES.length), label: pair('articles', '篇文章') }])),
    download(),
    h('figure.site-shot', h('img', { src: 'screenshots/dark-cli-set.png', alt: pair('Material Tailscale editing tailscale set preferences with rich controls, captured from the built app', '用豐富控制項編輯 tailscale set，由實際程式截圖'), loading: 'eager' })),
    h('h2', pair('What it covers', '包括乜嘢')), h('div.grid.stagger', FEATURE_CARDS.map(([ic, en, yue, d], i) => h('a.cmd-tile.span-3', { href: '#/features', style: { '--i': i } }, h('span.ico', icon(ic)), h('span', h('b', pair(en, yue)), h('div.small.muted', d))))),
    h('h2', pair('Screens from the real app', '實際程式截圖')), gallery()),
  features: () => h('div.page', pageHero(pair('Everything', '全部'), pair('Features', '功能'), pair('Each feature has its own article.', '每個功能都有自己嘅文章。')),
    h('div.grid.stagger', ARTICLES.map((a, i) => h('a.cmd-tile.span-4', { href: '#/docs/' + encodeURIComponent(a.path), style: { '--i': i } }, h('span.ico', icon('article')), h('span', h('b', a.title), h('div.small.muted', a.category)))))),
  download: () => h('div.page', pageHero(pair('Releases', '發佈'), pair('Download', '下載'), pair('Unsigned Squirrel installer with automatic updates. Windows may warn about an unknown publisher.', '未簽署嘅 Squirrel 安裝程式，會自動更新。Windows 可能會警告未知發行者。')), download(), h('div.card', h('h2', pair('Install', '安裝')), h('ol', h('li', pair('Download MaterialTailscaleSetup.exe.', '下載 MaterialTailscaleSetup.exe。')), h('li', pair('Run it. If SmartScreen warns about an unknown publisher, choose More info, then Run anyway. The installer is unsigned.', '執行。SmartScreen 警告時揀「更多資訊」再「仍要執行」，安裝程式冇簽名。')), h('li', pair('Install Tailscale too if you have not. The app finds it automatically.', '如果未裝 Tailscale 都要裝，程式會自動搵到。')))),
    h('div.card.tonal', h('h3', pair('Build it yourself', '自己建置')), h('div.cmdline', '.\\build.bat --run'))),
  status: () => h('div.page', h('h1', pair('Status', '狀態')), h('div.tbl-wrap', h('table.tbl', h('tbody',
    h('tr', h('td', pair('Latest release', '最新版本')), h('td', REL ? `🟢 ${REL.tag}` : '⚪ ' + pair('none yet', '未有'))),
    h('tr', h('td', pair('Published', '發佈時間')), h('td', REL ? fmtDateTime(REL.publishedAt) : '—')),
    h('tr', h('td', pair('Code name', '代號')), h('td', REL?.codeName || '—')),
    h('tr', h('td', pair('Website built from', '網站來源提交')), h('td.mono', S.commit?.slice(0, 7) || '—')),
    h('tr', h('td', pair('Website updated', '網站更新')), h('td', S.commitTime ? fmtDateTime(S.commitTime) : '—')))))),
};

function gallery() {
  const shots = S.screenshots || [];
  if (!shots.length) return h('div.empty', pair('screenshots appear after the first capture.', '截圖會喺第一次擷取後出現。'));
  const groups = [...new Set(shots.map((s) => s.split('-')[0]))];
  return h('div.stack', groups.map((g) => h('details', { open: g === 'dark' }, h('summary', h('b', g === 'dark' ? pair('Dark theme', '深色主題') : pair('Light theme', '淺色主題'))),
    h('div.grid', shots.filter((s) => s.startsWith(g + '-')).map((s) => h('figure.span-4', { style: { margin: 0 } }, h('img', { src: 'screenshots/' + s, loading: 'lazy', alt: `${s.replace(/\.png$/, '').replace(/-/g, ' ')} screen, captured from the built app`, style: { width: '100%', borderRadius: '14px', border: '1px solid var(--outline-soft)' } }), h('figcaption.small.muted', s.replace(/\.png$/, '').replace(/^(dark|light)-/, '').replace(/-/g, ' '))))))));
}

// --------- palette for the site ---------
function openPalette() {
  const items = [...NAV.map(([id, en, yue, ic]) => ({ label: pair(en, yue), icon: ic, run: () => open(id) })),
    ...ARTICLES.map((a) => ({ label: a.title, icon: 'article', run: () => open('docs', a.path) })),
    ...SETTINGS_INDEX.filter((s) => !['tailscale', 'about'].includes(s.section)).map((s) => ({ label: pair(s.en, s.yue), icon: 'tune', live: settingLive(s.key)?.live, run: () => { open('settings', s.section); setTimeout(() => { const el = document.querySelector(`[data-el="set-${s.key}"]`); el?.scrollIntoView({ block: 'center' }); el?.classList.add('teleport-hl'); el?.querySelector('button,input,select')?.focus(); }, 300); } })),
    ...['authenticator', 'base64', 'regex', 'draw', 'history', 'notifications'].map((id) => ({ label: t(id), icon: 'construction', run: () => open(id) }))];
  menu({ x: Math.max(8, innerWidth / 2 - 210), y: 70 }, items, { title: pair('Command palette', '指令面板') });
}

// --------- boot ---------
function applySettings() {
  const r = document.documentElement;
  r.dataset.theme = store.get('theme') === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : store.get('theme');
  r.dataset.density = store.get('density'); r.dataset.contrast = store.get('contrast');
  r.style.setProperty('--seed', store.get('seed')); r.style.setProperty('--text-scale', String(store.get('textScale') / 100));
  r.classList.toggle('reduce-motion', store.get('motion') === 'reduced' || store.get('adhdLowStim'));
  r.classList.toggle('low-stim', !!store.get('adhdLowStim')); r.classList.toggle('large-targets', !!store.get('largeTargets'));
  r.classList.toggle('rainbow', !!store.get('rainbow') && store.get('motion') !== 'reduced');
  document.body.classList.toggle('focus-dim', !!store.get('adhdFocus'));
  r.lang = i18n.mode() === 'yue' ? 'zh-HK' : 'en';
  a11y.hidden = !store.get('a11yMenu');
}
const a11y = h('button.icon-btn', { 'aria-label': pair('Accessibility tools', '無障礙工具'), on: { click: (e) => menu(e.currentTarget, [
  { label: pair('Bigger text', '大啲字'), icon: 'text_increase', run: () => store.set('textScale', Math.min(200, store.get('textScale') + 10)) },
  { label: pair('Smaller text', '細啲字'), icon: 'text_decrease', run: () => store.set('textScale', Math.max(80, store.get('textScale') - 10)) },
  { label: pair('High contrast', '高對比'), icon: 'contrast', run: () => store.set('contrast', store.get('contrast') === 'high' ? 'standard' : 'high') },
  { label: pair('Reduce motion', '減少動畫'), icon: 'motion_photos_off', run: () => store.set('motion', store.get('motion') === 'reduced' ? 'full' : 'reduced') },
  { label: pair('Larger targets', '大啲按鈕'), icon: 'touch_app', run: () => store.set('largeTargets', !store.get('largeTargets')) },
  { label: pair('Read this page aloud', '讀出呢頁'), icon: 'record_voice_over', run: () => readAloud(outlet.innerText.slice(0, 4000)) },
  '-', { label: pair('Hide this button…', '隱藏呢個掣…'), icon: 'visibility_off', run: async () => { if (await confirmDialog(pair('Hide the accessibility tools button?', '隱藏無障礙工具掣？'), pair('Bring it back from Settings > Accessibility.', '可以喺設定開返。'))) store.set('a11yMenu', false); } }
]) } }, icon('accessibility_new'));
store.on(() => applySettings());

(async () => {
  mountOverlays();
  watchScrollRegions();
  revealFocus();
  i18n.setSchool(await window.mt.shared.get());
  window.mt.shared.onChange((r) => { i18n.setSchool(r); render(); });
  i18n.restoreVocab();
  const lang = h('div.seg', { role: 'radiogroup', 'aria-label': pair('Language', '語言') }, [['en', 'EN'], ['yue', '廣'], ['both', 'EN+廣']].map(([v, l]) => h('button', { role: 'radio', 'aria-checked': String(store.get('lang') === v), on: { click: () => { store.set('lang', v); location.reload(); } } }, l)));
  const menuBtn = h('button.icon-btn.site-menu', { 'aria-label': pair('Menu', '選單'), 'aria-expanded': 'false', on: { click: () => { const o = document.body.classList.toggle('nav-open'); menuBtn.setAttribute('aria-expanded', String(o)); } } }, icon('menu'));
  const header = h('header.site-header', { dataset: { el: 'site-header' } }, menuBtn, h('a.brand', { href: '#/home' }, logoSvg(26), h('b', 'Material Tailscale')), navBox, h('div.spacer'),
    h('button.palette-trigger', { 'aria-keyshortcuts': 'Control+Shift+F', title: `${pair('Search the site', '搜尋網站')} (Ctrl+Shift+F)`, on: { click: openPalette } }, icon('search'), h('span.sr-only', pair('Search the site', '搜尋網站')), h('kbd', 'Ctrl+Shift+F')), lang, a11y);
  const prov = h('footer.site-footer', h('span', S.version ? pair(`Website ${S.version} · updated ${fmtDateTime(S.commitTime)}`, `網站 ${S.version} · 更新 ${fmtDateTime(S.commitTime)}`) : pair('Website build provenance unavailable', '冇網站建置資料')),
    h('span', pair('Not affiliated with Tailscale Inc. Tailscale is a trademark of Tailscale Inc.', '同 Tailscale Inc. 冇關係。')));
  // The provenance line belongs to the main landmark, above the page it describes.
  document.body.append(h('div.ambient', { 'aria-hidden': 'true' }), header, h('main.site-main', h('div.site-prov.small.muted', { dataset: { el: 'provenance' } }, S.version ? `${pair('Version', '版本')} ${S.version} · ${pair('updated', '更新')} ${fmtDateTime(S.commitTime)}` : ''), outlet), prov);
  applySettings(); applyAppearance(); drawNav(); render();
  runSchedules(); setInterval(() => runSchedules().catch(() => {}), 30000);
  new MutationObserver(() => applyLocks()).observe(outlet, { childList: true, subtree: true });
  document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openPalette(); } });
  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented || e.target.closest('input,textarea,a')) return;
    const el = e.target.closest('[data-el]'); if (!el) return;
    e.preventDefault();
    menu({ x: e.clientX, y: e.clientY }, [{ label: t('editAppearance'), icon: 'palette', run: () => editAppearance(el) }, { label: t('lockElement'), icon: 'lock', run: () => lockWizard(el.dataset.el, el) }, '-', { label: pair('Command palette', '指令面板'), icon: 'search', kbd: 'Ctrl+Shift+F', run: openPalette }]);
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f || !/\.json$/i.test(f.name) || i18n.schoolOn()) return; if (f.size > 262144) { toast(t('vocabBad', { why: pair('the file is larger than 256 KiB', '檔案大過 256 KiB') }), { kind: 'err' }); return; } try { i18n.loadVocabFromText(await f.text()); celebrate(); render(); } catch (err) { toast(t('vocabBad', { why: err.message }), { kind: 'err' }); } });
  setTimeout(() => maybeSurprise({ firstRun: false, busy: () => !!document.querySelector('.scrim') }), 2000);
})();
