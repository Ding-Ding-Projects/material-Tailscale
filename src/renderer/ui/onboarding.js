// First-run setup wizard with real actions: find Tailscale, check status,
// sign in or connect, pick language and funny levels, appearance, optional
// admin API connection. Progress, Back/Next, skip, save and resume.
import { h, icon, clear } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ts from '../core/tsdata.js';
import { segmented, stepper } from './controls.js';
import { openDest } from './shell.js';
import { toast, holdFocus } from './overlay.js';
import { installTailscaleButton } from './jobs.js';

export function onboarding() {
  const steps = [
    { id: 'welcome', title: t('welcome'), optional: false, body: () => h('div.stack', h('p', pair('This wizard checks Tailscale on this computer, gets you connected and sets up the app the way you like. You can leave at any time and resume later.', '呢個精靈會檢查本機 Tailscale、幫你連線，同設定程式。隨時可以離開，下次繼續。')),
      h('p.small.muted', pair('The funny level styles every message, including errors and warnings, in English and Cantonese separately. Both start at 5 (most playful). You can change or reset them any time, in the next step or in Settings.', '搞笑程度會影響所有訊息，包括錯誤同警告，英文同廣東話分開設定，預設都係 5。隨時可以改。'))) },
    { id: 'language', title: pair('Language and voice', '語言同語氣'), optional: true, body: () => { const l = segmented([{ value: 'en', label: 'English' }, { value: 'yue', label: '廣東話' }, { value: 'both', label: pair('Both', '雙語') }], store.get('lang'), { label: 'Language' }); l.onChange((v) => store.set('lang', v)); const a = stepper(store.get('funnyEn'), { min: 1, max: 5, label: 'English funny level' }); a.onChange((v) => v && store.set('funnyEn', v)); const b = stepper(store.get('funnyYue'), { min: 1, max: 5, label: 'Cantonese funny level' }); b.onChange((v) => v && store.set('funnyYue', v)); return h('div.stack', l.el, h('b', pair('English funny level', '英文搞笑程度')), a.el, h('b', pair('Cantonese funny level', '廣東話搞笑程度')), b.el); } },
    { id: 'find', title: pair('Find Tailscale', '搵 Tailscale'), optional: false, body: () => { const r = h('div.stack', h('div.skeleton', { style: { height: '60px' } })); window.mt.ts.locate().then((loc) => { clear(r).append(loc.path ? h('div.row', h('span.badge.ok', pair('Found', '搵到')), h('code', loc.path), h('span.small.muted', loc.source)) : h('div.stack', h('span.badge.err', t('notInstalled')), h('p', t('tsMissing')), h('div.row', installTailscaleButton(), h('button.btn.outline', { on: { click: () => draw() } }, icon('refresh'), pair('Check again', '再檢查'))), h('details', h('summary', pair('Places searched', '搵過嘅位置')), h('div.out', loc.searched.join('\n'))))); }); return r; } },
    { id: 'connect', title: pair('Connect', '連線'), optional: true, body: () => { const r = h('div.stack'); ts.poll().then(() => { const s = ts.data.status; const st = s?.BackendState; clear(r).append(h('p', pair(`Current state: ${st || 'unknown'}`, `目前狀態：${st || '未知'}`)), st === 'Running' ? h('span.badge.ok', pair('Already connected. Nice.', '已經連咗線。')) : st === 'NeedsLogin' ? h('button.btn', { on: { click: () => { close(); openDest('accounts'); } } }, icon('login'), pair('Log in', '登入')) : h('button.btn', { on: { click: async (e) => { e.currentTarget.disabled = true; const x = await ts.run('up', {}); toast(x.code === 0 ? pair('Connected.', '已連線。') : (x.stderr || t('cmdFail', { code: x.code })), { kind: x.code === 0 ? 'ok' : 'err' }); draw(); } } }, icon('power'), t('connect'))); }); return r; } },
    { id: 'look', title: pair('Look and feel', '外觀'), optional: true, body: () => { const th = segmented([{ value: 'dark', label: pair('Dark', '深色') }, { value: 'light', label: pair('Light', '淺色') }, { value: 'system', label: pair('System', '跟系統') }], store.get('theme'), { label: 'Theme' }); th.onChange((v) => store.set('theme', v)); const mo = segmented([{ value: 'full', label: pair('Full motion', '完整動畫') }, { value: 'reduced', label: pair('Reduced motion', '減少動畫') }], store.get('motion'), { label: 'Motion' }); mo.onChange((v) => store.set('motion', v)); const sw = h('div.row', ['#a9b8ff', '#6ce6b6', '#ffc46b', '#ff8fb1', '#8ad4ff'].map((c) => h('button.chip.choice', { 'aria-pressed': String(store.get('seed') === c), 'aria-label': c, style: { background: c, width: '40px' }, on: { click: () => { store.set('seed', c); draw(); } } }))); return h('div.stack', th.el, mo.el, h('b', pair('Accent', '主色')), sw); } },
    { id: 'admin', title: pair('Admin console (optional)', '管理控制台（可選）'), optional: true, body: () => h('div.stack', h('p', pair('To manage the whole tailnet (devices, policy file, keys, DNS, users), connect an API token in Admin. You can skip this.', '想管理成個 tailnet，可以喺 Admin 連接 API 權杖，可以跳過。')), h('button.btn.outline', { on: { click: () => { close(); openDest('admin'); } } }, icon('admin_panel_settings'), pair('Open Admin now', '即刻開 Admin'))) },
    { id: 'done', title: pair('All set', '搞掂'), optional: false, body: () => h('div.stack', h('p', pair('Press Ctrl+Shift+F any time to search every command, flag and setting. Right-click anything for more.', '隨時撳 Ctrl+Shift+F 搜尋所有指令、旗標同設定。右鍵睇更多。'))) }
  ];
  let i = Math.min(store.get('onboardStep') || 0, steps.length - 1);
  const bar = h('div.sc-progress', h('i'));
  const titleEl = h('h2');
  const body = h('div.stack', { style: { minHeight: '200px' } });
  const back = h('button.btn.outline', { on: { click: () => { i = Math.max(0, i - 1); draw(); } } }, icon('arrow_back'), t('back'));
  const skip = h('button.btn.text', { on: { click: () => { i++; draw(); } } }, t('skip'));
  const next = h('button.btn', { on: { click: () => { if (i === steps.length - 1) { store.set('onboarded', true); close(); openDest('home'); return; } i++; draw(); } } });
  const later = h('button.btn.text', { on: { click: () => close() } }, pair('Finish later', '遲啲先'));
  const draw = () => {
    store.set('onboardStep', i, { record: false });
    const s = steps[i];
    bar.firstChild.style.width = `${((i + 1) / steps.length) * 100}%`;
    titleEl.textContent = `${i + 1}/${steps.length} · ${s.title}`;
    clear(body).append(s.body());
    back.disabled = i === 0; skip.hidden = !s.optional;
    clear(next).append(i === steps.length - 1 ? t('finish') : t('next'), icon('arrow_forward'));
  };
  const scrim = h('div.scrim', h('div.dialog.wide', { role: 'dialog', 'aria-modal': 'true', 'aria-label': pair('Setup wizard', '設定精靈'), dataset: { el: 'onboarding' } }, h('div.row', titleEl, h('span.spacer'), later), bar, body, h('div.row', back, h('span.spacer'), skip, next)));
  const close = () => { release(); scrim.remove(); };
  scrim.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(scrim);
  const release = holdFocus(scrim.firstChild);
  draw();
  setTimeout(() => next.focus(), 50);
}
