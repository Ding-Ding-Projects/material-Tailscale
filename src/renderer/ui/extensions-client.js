// Renderer side of extensions: the cached list from the main process, the actions each place
// in the app offers, running an action and applying its answer, and the consent dialog.
// The main process decides what an extension may see and checks every answer; this file
// only shows the result. On the website there are no extensions (window.mt.ext is absent).
import { h, icon } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import * as store from '../core/store.js';
import { toast, dialog } from './overlay.js';
import API from '../../shared/extension-api.js';

let cache = { masterOff: false, items: [], folder: '' };
const listeners = new Set();

export const available = () => !!window.mt?.ext;
export const current = () => cache;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Text from a manifest: plain, or { en, yue }. */
export const loc = (v) => (typeof v === 'string' ? v : v ? pair(v.en, v.yue || v.en) : '');
/** A manifest name in each language, so a bilingual sentence uses the right one in each half. */
export const names = (v) => (typeof v === 'string' ? { en: v, yue: v } : { en: v?.en || '', yue: v?.yue || v?.en || '' });
export const permText = (p) => pair(API.PERMISSIONS[p].en, API.PERMISSIONS[p].yue);
export const hookText = (k) => pair(API.HOOKS[k].en, API.HOOKS[k].yue);

function publish(next) { cache = next; for (const fn of listeners) fn(cache); return cache; }

export async function refresh() {
  if (!available()) return cache;
  try { return publish(await window.mt.ext.list()); } catch (e) { toast(e.message, { kind: 'err', title: t('extensions') }); return cache; }
}

/** Calls a manager action that answers with the new list. */
export async function act(fn) {
  try { const r = await fn(); if (r && Array.isArray(r.items)) publish(r); else await refresh(); return r; }
  catch (e) { toast(e.message, { kind: 'err', title: t('extensions') }); return null; }
}

/** Every action an enabled extension adds to one place in the app. */
export function actionsFor(hook) {
  return cache.items.filter((i) => i.enabled).flatMap((i) => i.manifest.actions.filter((a) => a.hook === hook).map((a) => ({ ext: i, action: a })));
}

/** Runs one action and applies its checked answer. Resolves with the answer, or null when it failed. */
export async function runAction(ext, action, context) {
  const name = loc(ext.manifest.name);
  const n = names(ext.manifest.name);
  let r;
  try { r = await window.mt.ext.run(ext.id, action.id, { ...context, language: store.get('lang') }); }
  catch (e) { toast(e.message, { kind: 'err', title: name }); refresh(); return null; }
  refresh();
  if (!r.ok) { toast(r.error, { kind: 'err', title: pair(`${n.en} did not finish`, `${n.yue} 未做完`) }); return null; }
  const a = r.answer;
  if (a.copy) await navigator.clipboard.writeText(a.copy).catch(() => {});
  if (a.openUrl) await window.mt.shell.external(a.openUrl).catch((e) => toast(e.message, { kind: 'err', title: name }));
  if (a.message || a.copy || a.openUrl || !a.ok) toast(a.message || (a.copy ? t('copied') : a.openUrl || pair('It reported a problem without saying what.', '佢話有問題，但冇講係咩。')), { kind: a.ok ? 'ok' : 'warn', title: name });
  return a;
}

/** The consent dialog: exactly what this version asks for, what changed, and what it never gets. */
export function reviewConsent(item) {
  const m = item.manifest;
  const n = names(m.name);
  const changed = item.consent === 'changed';
  const perms = h('ul.consent-list', m.permissions.map((p) => h('li', icon(API.PERMISSIONS[p].icon), h('div', h('b', p), h('span', permText(p)),
    changed && item.added?.includes(p) ? h('span.badge.warn', pair('New in this version', '今個版本新加')) : null))));
  const never = h('ul.consent-never', API.NEVER_SENT.map(([en, yue]) => h('li', icon('block'), pair(en, yue))));
  const adds = h('ul.consent-adds', m.actions.map((a) => h('li', icon(a.icon || API.HOOKS[a.hook].icon), h('span', h('b', loc(a.title)), ' · ', hookText(a.hook)))));
  const body = h('div.stack.consent', { dataset: { el: 'ext-consent' } },
    h('p', changed
      ? pair(`${n.en} changed since you allowed it (version ${item.was.version} to ${m.version}). It stays off until you allow what this version asks for.`, `${n.yue} 喺你批准之後改過（版本 ${item.was.version} 變 ${m.version}）。批准今個版本要求嘅嘢之前，佢會保持關閉。`)
      : pair(`${n.en} ${m.version} stays off until you allow exactly what it asks for.`, `批准 ${n.yue} ${m.version} 要求嘅嘢之前，佢會保持關閉。`)),
    changed && item.dropped?.length ? h('p.small.muted', pair(`It no longer asks for: ${item.dropped.join(', ')}.`, `佢唔再要求：${item.dropped.join('、')}。`)) : null,
    h('h3', pair('It asks to', '佢要求')), perms,
    h('h3', pair('It adds', '佢會加入')), adds,
    h('h3', pair('It never receives', '佢永遠收唔到')), never,
    h('p.small.muted', pair('An extension is a program that runs as you. The app decides what it hands over and which answers it accepts, but it cannot stop an extension from reading your files or using the network on its own. Allow only extensions you trust.', '擴充功能係用你身份運行嘅程式。程式會決定交俾佢乜嘢、接受佢乜嘢答覆，但阻止唔到佢自己讀你嘅檔案或者上網。只批准你信得過嘅擴充功能。')));
  return new Promise((resolve) => {
    dialog({ title: pair(`Allow ${n.en}?`, `批准 ${n.yue}？`), body, wide: true, emojiChar: '🧩', onClose: (v) => resolve(!!v),
      actions: [
        { label: pair('Keep off', '保持關閉'), kind: 'outline', value: false },
        { label: pair('Allow and turn on', '批准並開啟'), value: true, run: async () => { const r = await act(() => window.mt.ext.allow(item.id, item.fingerprint)); if (r) toast(pair(`${n.en} is on.`, `${n.yue} 已開啟。`), { kind: 'ok' }); return r ? true : false; } }
      ] });
  });
}
