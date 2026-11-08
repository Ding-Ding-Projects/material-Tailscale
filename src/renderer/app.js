import { h, icon, fmtDateTime } from './core/dom.js';
import * as store from './core/store.js';
import * as i18n from './core/i18n.js';
import { t, pair } from './core/i18n.js';
import * as ts from './core/tsdata.js';
import { readAloud, narrate } from './core/feedback.js';
import { mountShell, openDest, newTabCatalog, closeTab, currentDest, render, DESTS, openInNewTab } from './ui/shell.js';
import { mountOverlays, toast, menu, popover, confirmDialog, closePopover } from './ui/overlay.js';
import { openPalette, closePalette } from './ui/palette.js';
import { editAppearance, applyAppearance } from './ui/appearance.js';
import { lockWizard, applyLocks } from './ui/locks.js';
import { celebrate } from './ui/celebrate.js';
import { onboarding } from './ui/onboarding.js';
import { maybeSurprise, showSurprise } from './ui/dimsum.js';
import './pages/tailscale.js';
import './pages/admin.js';
import './pages/settings.js';
import './pages/tools.js';
import './pages/base64.js';
import { runMcSchedules } from './pages/minecraft.js';
import { runSchedules } from './core/schedules.js';
import { SETTINGS_INDEX } from './pages/settings-index.js';
import './pages/meta.js';
import './pages/features.js';
import './pages/regex-debug.js';
import './pages/ollama/index.js';
import './pages/vdisks.js';
import './pages/extensions.js';
import * as extensions from './ui/extensions-client.js';
import { settingLive } from './ui/setting-live.js';
import { watchScrollRegions } from './ui/scroll-focus.js';
import { revealFocus } from './ui/focus-reveal.js';

// ---------- appearance from settings ----------
function applySettings() {
  const r = document.documentElement;
  const theme = store.get('theme') === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : store.get('theme');
  r.dataset.theme = theme;
  r.dataset.density = store.get('density');
  r.dataset.contrast = store.get('contrast');
  r.style.setProperty('--seed', store.get('seed'));
  r.style.setProperty('--text-scale', String(store.get('textScale') / 100));
  r.classList.toggle('rainbow', !!store.get('rainbow') && store.get('motion') !== 'reduced');
  r.classList.toggle('reduce-motion', store.get('motion') === 'reduced' || store.get('adhdLowStim'));
  r.classList.toggle('low-stim', !!store.get('adhdLowStim'));
  r.classList.toggle('large-targets', !!store.get('largeTargets'));
  r.classList.toggle('no-focus-ring', !store.get('focusRing'));
  document.body.classList.toggle('focus-dim', !!store.get('adhdFocus'));
  r.lang = i18n.mode() === 'yue' ? 'zh-HK' : 'en';
  a11yBtn();
  timeChip();
}
store.on((k) => { applySettings(); if (['lang', 'funnyEn', 'funnyYue'].includes(k)) render(); });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applySettings);

// ---------- accessibility tools menu ----------
let a11yEl = null;
function a11yBtn() { const b = document.querySelector('[data-el="a11y-button"]'); if (b) b.hidden = !store.get('a11yMenu'); }
window.addEventListener('mt:a11y', (e) => {
  const tog = (k, l) => ({ label: `${store.get(k) ? '✓ ' : ''}${l}`, icon: 'check', run: () => store.set(k, !store.get(k)) });
  menu(e.detail, [
    { label: pair('Bigger text', '大啲字'), icon: 'text_increase', kbd: 'Ctrl+=', run: () => store.set('textScale', Math.min(200, store.get('textScale') + 10)) },
    { label: pair('Smaller text', '細啲字'), icon: 'text_decrease', kbd: 'Ctrl+-', run: () => store.set('textScale', Math.max(80, store.get('textScale') - 10)) },
    { label: `${store.get('contrast') === 'high' ? '✓ ' : ''}${pair('High contrast', '高對比')}`, icon: 'contrast', run: () => store.set('contrast', store.get('contrast') === 'high' ? 'standard' : 'high') },
    { label: `${store.get('motion') === 'reduced' ? '✓ ' : ''}${pair('Reduce motion', '減少動畫')}`, icon: 'motion_photos_off', run: () => store.set('motion', store.get('motion') === 'reduced' ? 'full' : 'reduced') },
    tog('focusRing', pair('Bold focus ring', '粗焦點框')), tog('largeTargets', pair('Larger targets', '大啲按鈕')),
    { label: pair('Read this page aloud', '讀出呢頁'), icon: 'record_voice_over', run: () => { const o = document.getElementById('outlet').cloneNode(true); o.querySelectorAll('input[type=password],.secret,.cmdline').forEach((x) => x.remove()); readAloud(o.innerText.slice(0, 4000)); } },
    { label: pair('Keyboard shortcuts', '鍵盤快捷鍵'), icon: 'keyboard', kbd: 'F1', run: showKeys },
    '-',
    { label: pair('Hide this button…', '隱藏呢個掣…'), icon: 'visibility_off', run: async () => { if (await confirmDialog(pair('Hide the accessibility tools button?', '隱藏無障礙工具掣？'), pair('Your settings stay. Bring it back from Settings > Accessibility or the command palette.', '設定會保留。可以喺設定或者指令面板開返。'), { okLabel: pair('Hide', '隱藏') })) store.set('a11yMenu', false); } }
  ], { title: pair('Accessibility tools', '無障礙工具') });
});

const SHORTCUTS = [['Ctrl+Shift+F', pair('Command palette', '指令面板')], ['Ctrl+T', t('newTab')], ['Ctrl+W', pair('Close tab', '關分頁')], ['Ctrl+Tab', pair('Next tab', '下一個分頁')], ['Ctrl+1…9', pair('Rail destinations', '目的地')], ['Ctrl+R', t('refresh')], ['Ctrl+=, Ctrl+-', pair('Text size', '字體大小')], ['Shift+F10', pair('Context menu for the focused element', '焦點元素嘅選單')], ['F1', pair('Keyboard shortcuts', '快捷鍵')]];
function showKeys() { popover({ x: innerWidth / 2 - 180, y: 80 }, h('div.stack', { style: { padding: '10px' } }, h('h2.h3', pair('Keyboard shortcuts', '鍵盤快捷鍵')), ...SHORTCUTS.map(([k, l]) => h('div.row.nowrap', h('code.chip.mono', k), h('span', l)))), { label: pair('Keyboard shortcuts', '鍵盤快捷鍵') }); }

// ---------- time awareness chip ----------
const started = Date.now();
let tchip;
function timeChip() {
  if (!store.get('adhdTime')) { tchip?.remove(); tchip = null; return; }
  if (!tchip) { tchip = h('div.chip.time-chip', { 'aria-live': 'off' }); document.body.append(tchip); }
  const upd = () => { if (!tchip) return; const m = Math.floor((Date.now() - started) / 60000); tchip.textContent = `🕒 ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${pair(`open ${m} min`, `開咗 ${m} 分鐘`)}`; };
  upd(); clearInterval(tchip._iv); tchip._iv = setInterval(upd, 20000);
}

// ---------- global context menu on every element ----------

// ---------- live values for settings inside context menus ----------
const QUICK = ['theme', 'lang', 'textScale', 'motion', 'sounds', 'seed'];
const liveFor = settingLive;

function contextFor(target, at) {
  const el = target.closest('[data-el]');
  const id = el?.dataset.el;
  const sel = String(getSelection());
  const items = [];
  if (sel) items.push({ label: t('copy'), icon: 'content_copy', kbd: 'Ctrl+C', run: () => navigator.clipboard.writeText(sel) });
  const field = target.closest('input,textarea');
  if (field) items.push({ label: pair('Paste', '貼上'), icon: 'content_paste', kbd: 'Ctrl+V', run: async () => { field.focus(); document.execCommand('insertText', false, await navigator.clipboard.readText()); } }, { label: pair('Select all', '全選'), icon: 'select_all', kbd: 'Ctrl+A', run: () => field.select() });
  const setKey = id?.startsWith('set-') ? id.slice(4) : null;
  const own = setKey ? liveFor(setKey) : null;
  if (own) items.push(own, '-');
  if (el) {
    items.push({ label: t('editAppearance'), icon: 'palette', run: () => editAppearance(el) }, { label: t('lockElement'), icon: 'lock', run: () => lockWizard(id, el) },
      { label: pair('Lock this element\'s appearance…', '鎖住呢個元素嘅外觀…'), icon: 'format_paint', run: () => lockWizard('appearance:' + id, el) });
    const tab = id.startsWith('tab-') ? id.slice(4) : null;
    if (tab && tab !== 'ws' && tab !== 'new') items.push({ label: pair('Close tab', '關分頁'), icon: 'close', kbd: 'Ctrl+W', run: () => closeTab(tab) });
    const rail = id.startsWith('rail-') ? id.slice(5) : null;
    if (rail) items.push({ label: pair('Open in a new tab', '喺新分頁開'), icon: 'tab', kbd: 'Ctrl+T', run: () => openInNewTab(rail) });
  }
  items.push('-', { label: t('newTab'), icon: 'add', kbd: 'Ctrl+T', run: () => newTabCatalog() }, { label: pair('Command palette', '指令面板'), icon: 'search', kbd: 'Ctrl+Shift+F', run: openPalette },
    '-', ...QUICK.filter((k) => k !== setKey).map(liveFor).filter(Boolean), '-',
    { label: t('refresh'), icon: 'refresh', kbd: 'Ctrl+R', run: () => { ts.poll(); render(); } });
  menu(at, items);
}
document.addEventListener('contextmenu', (e) => { if (e.defaultPrevented) return; e.preventDefault(); contextFor(e.target, { x: e.clientX, y: e.clientY }); });

// ---------- shortcuts ----------
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && e.shiftKey && k === 'f') { e.preventDefault(); openPalette(); }
  else if (e.ctrlKey && k === 't') { e.preventDefault(); newTabCatalog(); }
  else if (e.ctrlKey && k === 'w') { e.preventDefault(); const t0 = document.querySelector('.tab-btn[aria-selected="true"]')?.dataset.el?.slice(4); if (t0) closeTab(t0); }
  else if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); const tabs = [...document.querySelectorAll('.tab')]; const i = tabs.findIndex((x) => x.getAttribute('aria-selected') === 'true'); tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length]?.click(); }
  else if (e.ctrlKey && /^[1-9]$/.test(e.key)) { const d = DESTS.filter((x) => x.rail)[Number(e.key) - 1]; if (d) { e.preventDefault(); openDest(d.id); } }
  else if (e.ctrlKey && k === 'r') { e.preventDefault(); ts.poll(); render(); }
  else if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); store.set('textScale', Math.min(200, store.get('textScale') + 10)); }
  else if (e.ctrlKey && e.key === '-') { e.preventDefault(); store.set('textScale', Math.max(80, store.get('textScale') - 10)); }
  else if (e.key === 'F1') { e.preventDefault(); showKeys(); }
  else if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') { e.preventDefault(); const r = document.activeElement.getBoundingClientRect(); contextFor(document.activeElement, { x: r.left + 10, y: r.bottom }); }
});

// ---------- One thing at a time ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('.collapser');
  if (!b || !store.get('adhdOneThing')) return;
  setTimeout(() => { if (b.getAttribute('aria-expanded') !== 'true') return; document.querySelectorAll('.collapser[aria-expanded="true"]').forEach((o) => { if (o !== b) o.click(); }); }, 0);
}, true);

// ---------- ripple ----------
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn'); if (!b || document.documentElement.classList.contains('reduce-motion')) return;
  const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
  const rp = h('span.ripple', { style: { width: s + 'px', height: s + 'px', left: e.clientX - r.left - s / 2 + 'px', top: e.clientY - r.top - s / 2 + 'px' } });
  b.append(rp); setTimeout(() => rp.remove(), 650);
});

// ---------- personal vocabulary drop anywhere ----------
let dz = null, depth = 0;
const isJsonDrag = (e) => [...(e.dataTransfer?.items || [])].some((i) => i.kind === 'file');
document.addEventListener('dragenter', (e) => { if (!isJsonDrag(e) || i18n.schoolOn()) return; depth++; if (!dz) { dz = h('div.drop-zone', pair('Drop a personal vocabulary JSON to apply it', '放低個人詞彙 JSON 即刻套用')); document.body.append(dz); } });
document.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) { dz?.remove(); dz = null; } });
// Over a page's own drop target (Base64, Taildrop) the vocabulary banner steps aside.
document.addEventListener('dragover', (e) => { e.preventDefault(); if (dz) dz.hidden = !!e.target.closest?.('[data-drop-target]'); });
// Runs first, even when a drop target handles the drop and stops it going further.
document.addEventListener('drop', () => { depth = 0; dz?.remove(); dz = null; }, true);
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (i18n.schoolOn()) return;
  const f = e.dataTransfer.files[0];
  if (!f || !/\.json$/i.test(f.name)) return;
  if (f.size > 256 * 1024) { toast(t('vocabBad', { why: pair('the file is larger than 256 KiB', '檔案大過 256 KiB') }), { kind: 'err' }); return; }
  try { i18n.loadVocabFromText(await f.text()); celebrate(); render(); } catch (err) { toast(t('vocabBad', { why: err.message }), { kind: 'err' }); }
});

// ---------- update banner ----------
window.mt.update.onState((s) => {
  if (s.state !== 'ready' || !store.get('autoUpdate')) return;
  document.querySelector('.update-banner')?.remove();
  const v = s.name || pair('a new version', '新版本');
  document.body.append(h('div.update-banner', { role: 'status', dataset: { el: 'update-banner' } }, icon('system_update'), h('span', t('updateReady', { v })),
    h('button.btn.small.text', { on: { click: () => openDest('changelog') } }, pair('Release notes', '更新說明')),
    h('button.btn.small', { on: { click: async () => { if (await confirmDialog(pair('Restart to install update?', '重新啟動安裝更新？'), pair('Any command still running will be stopped.', '執行緊嘅指令會停止。'), { okLabel: pair('Restart to install update', '重新啟動安裝更新') })) window.mt.update.install(); } } }, pair('Restart to install update', '重新啟動安裝更新')),
    h('button.btn.small.outline', { on: { click: (ev) => ev.currentTarget.closest('.update-banner').remove() } }, pair('Later', '遲啲'))));
});
window.mt.onTray(({ id, r }) => toast(r.code === 0 ? (id === 'up' ? pair('Connected.', '已連線。') : pair('Disconnected.', '已斷線。')) : (r.stderr || t('cmdFail', { code: r.code })), { kind: r.code === 0 ? 'ok' : 'err' }));

// ---------- boot ----------
(async () => {
  mountOverlays();
  watchScrollRegions();
  revealFocus();
  const info = await window.mt.info();
  window.__MT_PLATFORM__ = info.platform;
  window.__MT_VERSION__ = `${info.version}${info.build?.commit ? ` (${info.build.commit.slice(0, 7)})` : ''} on ${info.platform} ${info.arch}`;
  i18n.setSchool(await window.mt.shared.get().catch(() => ({})));
  window.mt.shared.onChange((rec) => { i18n.setSchool(rec); render(); });
  setInterval(async () => i18n.setSchool(await window.mt.shared.get().catch(() => ({}))), 5000);
  const v = i18n.restoreVocab();
  if (v.corrupt) toast(pair(`The saved vocabulary was damaged and has not been applied: ${v.corrupt}`, `已儲存嘅詞彙損壞，冇套用：${v.corrupt}`), { kind: 'warn' });
  if (store.get('tsBinary')) await window.mt.ts.setBinary(store.get('tsBinary'));
  applySettings();
  applyAppearance();
  mountShell(info);
  new MutationObserver(() => applyLocks()).observe(document.getElementById('outlet'), { childList: true, subtree: true });
  applyLocks();
  ts.startPolling();
  extensions.refresh();
  runSchedules(); setInterval(runSchedules, 30000);
  setInterval(() => runMcSchedules().catch(() => {}), 30000);
  window.addEventListener('mt:palette', openPalette);
  window.addEventListener('mt:onboard', onboarding);
  let prevState = null;
  ts.subscribe((d) => { const s = d.status?.BackendState; if (prevState && s && s !== prevState) narrate('conn', `Tailscale is now ${s}.`, `Tailscale 而家係 ${s}。`); prevState = s || prevState; });
  const firstRun = !store.get('onboarded');
  if (firstRun && !new URLSearchParams(location.search).has('noonboard')) onboarding();
  setTimeout(() => maybeSurprise({ firstRun, busy: () => !!document.querySelector('.scrim,.update-banner') }), 2500);
  window.__mtOpen = (d, a) => openDest(d, a);
  window.__mtSet = (k, v) => store.set(k, v, { record: false });
  // Capture hooks: open the context menu or the appearance editor for an element by data-el.
  window.__mtContext = (elId) => { const el = document.querySelector(`[data-el="${CSS.escape(elId)}"]`); if (!el) return false; const r = el.getBoundingClientRect(); contextFor(el, { x: r.left + 24, y: r.top + 24 }); return true; };
  // Capture hooks for overlays, each opening the real component with neutral sample wording.
  // Automation hook: closes the palette, popovers, panels and dialogs between captured states.
  // Captures and the sweep open one state after another: notices raised by a demo state (the
  // sample error notice of the toasts overlay, for one) must not ride along into the next picture.
  window.__mtCloseOverlays = () => { closePalette(); closePopover(); document.querySelectorAll('.panel-float, .scrim, .toasts > *').forEach((x) => x.remove()); return true; };
  window.__mtOverlay = async (kind, arg) => {
    if (kind === 'palette') { openPalette(); await new Promise((r) => setTimeout(r, 80)); const i = document.querySelector('input[role="combobox"]'); if (i && arg) { i.value = arg; i.dispatchEvent(new Event('input', { bubbles: true })); } return true; }
    if (kind === 'onboarding') { onboarding(); return true; }
    if (kind === 'confirm') { const { superConfirm } = await import('./ui/safety.js'); superConfirm({ action: pair('Log out of this tailnet', '登出呢個 tailnet'), affects: pair('This device leaves the tailnet until you log in again.', '呢部機會離開 tailnet，直到你再登入。') }); return true; }
    if (kind === 'ladder') { const { ladder } = await import('./ui/locks.js'); ladder(arg || 'capture-sample'); return true; }
    if (kind === 'ext-consent') { const c = await extensions.refresh(); const item = c.items.find((i) => i.valid && i.consent !== 'granted' && (!arg || i.id === arg)) || c.items.find((i) => i.valid); if (!item) return false; extensions.reviewConsent(item); return true; }
    if (kind === 'dimsum') { showSurprise({ name: { en: 'Classic Har Gow', zhHant: '蝦餃' }, alt: { en: 'Warm tea-house photograph of Classic Har Gow' }, photo: arg || null }); return true; }
    if (kind === 'b64-demo') return window.__mtBase64Demo ? window.__mtBase64Demo() : false;
    if (kind === 'toasts') { toast(pair('Connected to your tailnet.', '已連線到你嘅 tailnet。'), { kind: 'ok' }); toast(pair('tailscale up failed: exit code 1.', 'tailscale up 失敗：結束碼 1。'), { kind: 'err' }); return true; }
    return false;
  };
  window.__mtAppearance = (elId, tab) => { const el = document.querySelector(`[data-el="${CSS.escape(elId)}"]`); if (!el) return false; editAppearance(el); if (tab) setTimeout(() => document.querySelector(`[data-el="mtab-${tab}"]`)?.click(), 50); return true; };
  window.__mtReady = true;
})();
