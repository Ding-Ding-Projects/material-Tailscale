import { h, icon, clear } from '../core/dom.js';
import { pageHero } from '../ui/hero.js';
import { t, pair, schoolOn, schoolName, loadVocabFromText, clearVocab, vocabState } from '../core/i18n.js';
import * as store from '../core/store.js';
import { registerPage, openDest } from '../ui/shell.js';
import { SETTINGS_INDEX, SECTIONS } from './settings-index.js';
import { switchCtl, segmented, stepper, text, pathPick } from '../ui/controls.js';
import { colorPicker } from '../ui/colorpicker.js';
import { toast, dialog, confirmDialog, floatPanel } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { lockWizard, unlockPrompt, supportTickets } from '../ui/locks.js';
import { onVoices, voicesFor, voiceInEffect } from '../core/feedback.js';
import { regexField } from '../ui/regex.js';
import { exportTo, FORMATS, openInEditor } from '../ui/exporter.js';
import { logoSvg } from '../ui/logo.js';
import { celebrate } from '../ui/celebrate.js';

function provLine(key) {
  const p = store.provenance(key);
  return p.from === 'saved' ? pair(`Saved setting · default is ${JSON.stringify(p.def)}`, `已儲存 · 預設 ${JSON.stringify(p.def)}`) : pair(`Built-in default: ${JSON.stringify(p.def)}`, `內置預設：${JSON.stringify(p.def)}`);
}

function settingRow(s) {
  let ctl;
  const v = store.get(s.key);
  if (s.type === 'bool') { ctl = switchCtl(v, { label: s.en }); }
  else if (s.type === 'enum') { ctl = segmented(s.options.map((o) => ({ value: o[0], label: pair(o[1], o[2]) })), v, { label: s.en }); }
  else if (s.type === 'int') { ctl = stepper(v, { min: s.min, max: s.max, label: s.en }); }
  else if (s.type === 'float') { const r = h('input.slider', { type: 'range', min: s.min, max: s.max, step: 0.1, value: v, 'aria-label': s.en }); const out = h('span.mono', String(v)); r.style.setProperty('--p', `${((v - s.min) / (s.max - s.min)) * 100}%`); r.addEventListener('input', () => { out.textContent = r.value; r.style.setProperty('--p', `${((r.value - s.min) / (s.max - s.min)) * 100}%`); store.set(s.key, Number(r.value)); }); ctl = { el: h('div.row.nowrap', r, out), onChange: () => {} }; }
  else if (s.type === 'time') { const i = h('input.input', { type: 'time', value: v, 'aria-label': s.en, style: { maxWidth: '160px' } }); i.addEventListener('change', () => store.set(s.key, i.value)); ctl = { el: i, onChange: () => {} }; }
  else if (s.type === 'color') { const b = h('button.btn.outline', { on: { click: (e) => { const cp = colorPicker(store.get('rainbow') ? '#a9b8ff' : v, { onChange: (c) => { if (c === 'rainbow') store.set('rainbow', true); else { store.set('rainbow', false); store.set('seed', c); } } }); floatPanel('seed-picker', s.en, cp.el, { anchor: e.currentTarget, width: 360, height: 640 }); } } }, h('span', { style: { width: '18px', height: '18px', borderRadius: '6px', background: 'var(--seed)' } }), store.get('rainbow') ? '🌈 rainbow' : v); ctl = { el: b, onChange: () => {} }; }
  else if (s.type === 'path') { ctl = pathPick(v, { mode: 'file', label: s.en }); ctl.onChange((p) => { store.set(s.key, p || ''); window.mt.ts.setBinary(p || '').then((r) => toast(r.path ? pair(`Using ${r.path}`, `使用 ${r.path}`) : t('tsMissing'), { kind: r.path ? 'ok' : 'warn' })); }); }
  else { ctl = text(v, { label: s.en, mono: s.key === 'socket' }); }
  if (s.type !== 'path') ctl.onChange?.((x) => { if (x === undefined && s.type === 'text') x = ''; if (x !== '' || s.type === 'text') store.set(s.key, x, { label: s.key }); });
  if (s.key === 'a11yMenu') ctl.onChange(async (x) => { if (!x && !(await confirmDialog(pair('Hide the accessibility tools button?', '隱藏無障礙工具掣？'), pair('The tools stay in Settings and the command palette.', '工具仍然喺設定同指令面板。')))) { store.set('a11yMenu', true); ctl.set(true); } });
  const explainBox = h('div.small', { hidden: true, style: { padding: '10px 12px', borderRadius: '12px', background: 'var(--surface-2)' } }, s.explain);
  return h('div.flag-card', { dataset: { el: 'set-' + s.key } },
    h('div.row.nowrap', h('button.info-btn', { 'aria-label': pair(`Explain ${s.en}`, `解釋 ${s.yue}`), 'aria-expanded': 'false', on: { click: (e) => { explainBox.hidden = !explainBox.hidden; e.currentTarget.setAttribute('aria-expanded', String(!explainBox.hidden)); } } }, icon('info')), h('b', { style: { flex: 1 } }, pair(s.en, s.yue)), h('button.icon-btn.sm', { 'aria-label': pair(`Reset ${s.en}`, `重設 ${s.yue}`), title: t('reset'), on: { click: () => { store.reset(s.key); openDest('settings', s.section); } } }, icon('restart_alt'))),
    explainBox, ctl.el, h('div.small.muted', s.help), h('div.provline', provLine(s.key)));
}

function voicePickers() {
  const box = h('div.stack');
  const draw = () => {
    clear(box);
    for (const lang of ['en', 'yue']) {
      const key = lang === 'en' ? 'voiceEn' : 'voiceYue';
      const list = voicesFor(lang);
      const sel = h('select.input', { 'aria-label': lang === 'en' ? pair('English voice', '英文聲音') : pair('Cantonese voice', '廣東話聲音'), on: { change: () => { store.set(key, sel.value); draw(); } } },
        h('option', { value: '' }, pair('Choose automatically', '自動揀')), list.map((v) => h('option', { value: v.voiceURI, selected: store.get(key) === v.voiceURI }, `${v.name} (${v.lang})${v.localService ? '' : ' · network'}`)));
      box.append(h('div.flag-card', { dataset: { el: 'set-' + key } }, h('b', lang === 'en' ? pair('English narrator voice', '英文旁白聲音') : pair('Cantonese narrator voice', '廣東話旁白聲音')), sel, h('div.small.muted', voiceInEffect(lang).note),
        h('button.btn.small.outline', { on: { click: () => { const u = new SpeechSynthesisUtterance(lang === 'en' ? 'This is the English narrator.' : '呢個係廣東話旁白。'); const v = voiceInEffect(lang).voice; if (v) u.voice = v; u.lang = lang === 'en' ? 'en-US' : 'zh-HK'; u.rate = store.get('narratorRate'); u.pitch = store.get('narratorPitch'); speechSynthesis.speak(u); } } }, icon('play_arrow'), pair('Preview', '試聽'))));
    }
  };
  const off = onVoices(draw);
  draw();
  box.cleanup = off;
  return box;
}

function schoolSection() {
  const box = h('div.stack');
  window.mt.shared.get().then((rec) => {
    const sw = switchCtl(!!rec.enabled, { label: schoolName() });
    sw.onChange(async (v) => {
      if (!v && rec.credential) {
        const pass = h('input.input', { type: 'password', 'aria-label': pair('Shared unlock password', '共用解鎖密碼') });
        const ok = await new Promise((res) => dialog({ title: pair(`Turn off ${schoolName()}`, `關閉${schoolName()}`), body: h('div.stack', h('p', pair('Enter the shared unlock password.', '輸入共用解鎖密碼。')), pass), onClose: res, actions: [{ label: t('cancel'), kind: 'outline', value: false }, { label: t('apply'), run: async () => { const hash = await sha(pass.value); return hash === rec.credential; } }] }));
        if (!ok) { sw.set(true); toast(pair('Password did not match.', '密碼唔啱。'), { kind: 'err' }); return; }
      }
      rec = await window.mt.shared.set({ enabled: v });
      toast(v ? pair(`${schoolName()} is on in every app.`, `所有程式已開${schoolName()}。`) : pair(`${schoolName()} is off.`, `已關${schoolName()}。`), { kind: 'ok' });
    });
    const name = text(rec.name || '', { label: pair('Rename this mode', '改名'), placeholder: 'School mode' });
    name.onChange(async (v) => { rec = await window.mt.shared.set({ name: v || null }); });
    const pw = h('input.input', { type: 'password', placeholder: pair('Set a new shared unlock password', '設定新共用密碼'), 'aria-label': pair('Shared unlock password', '共用解鎖密碼') });
    box.append(h('div.flag-card', { dataset: { el: 'set-school' } }, h('div.switch-row', h('div.txt', h('b', schoolName()), h('span.small.muted', pair('One switch shared by every Ding-Ding-Projects app on this computer. Forces English and hides playful extras everywhere, live.', '本機所有 Ding-Ding-Projects 程式共用一個開關。強制英文，即時隱藏所有玩味功能。'))), sw.el),
      h('b', pair('Name', '名稱')), name.el, h('b', pair('Unlock password', '解鎖密碼')), h('div.row.nowrap', pw, h('button.btn.small', { on: { click: async () => { if (pw.value.length < 4) { toast(pair('Use at least 4 characters.', '最少 4 個字元。'), { kind: 'warn' }); return; } rec = await window.mt.shared.set({ credential: await sha(pw.value) }); pw.value = ''; toast(pair('Shared password saved.', '已儲存共用密碼。'), { kind: 'ok' }); } } }, t('apply')), h('button.btn.small.outline', { on: { click: async () => { if (await superConfirm({ action: pair('Reset the shared unlock password', '重設共用密碼'), affects: pair('Every app that uses this mode.', '所有用呢個模式嘅程式。') })) { rec = await window.mt.shared.set({ credential: null }); toast(pair('Shared password cleared.', '已清除共用密碼。'), { kind: 'ok' }); } } } }, t('reset')))));
  });
  return box;
}
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

function schedulesSection() {
  const box = h('div.stack');
  const keys = SETTINGS_INDEX.filter((s) => ['enum', 'bool', 'int', 'color'].includes(s.type));
  const draw = () => {
    clear(box);
    const rules = store.get('schedules');
    box.append(h('p.small.muted', pair(`Times use your local time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}) and follow daylight saving automatically. When rules overlap, the one lower in the list wins. A rule can take its value from this app, or from an HTTPS URL that returns {"value": …}.`, '時間用本地時區，自動跟夏令時間。重疊時，列表較下嗰條規則優先。值可以嚟自本程式或者回傳 {"value": …} 嘅 HTTPS 網址。')));
    rules.forEach((r, i) => {
      const keySel = h('select.input', { 'aria-label': 'Setting', on: { change: () => upd(i, { key: keySel.value }) } }, keys.map((k) => h('option', { value: k.key, selected: r.key === k.key }, pair(k.en, k.yue))));
      const val = h('input.input', { value: r.value ?? '', 'aria-label': 'Value', on: { change: () => upd(i, { value: val.value }) } });
      const from = h('input.input', { type: 'time', value: r.from, 'aria-label': 'From', on: { change: () => upd(i, { from: from.value }) } });
      const to = h('input.input', { type: 'time', value: r.to, 'aria-label': 'To', on: { change: () => upd(i, { to: to.value }) } });
      const days = h('div.row', ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, di) => h('button.chip.choice', { 'aria-pressed': String((r.days || [0, 1, 2, 3, 4, 5, 6]).includes(di)), on: { click: () => { const ds = new Set(r.days || [0, 1, 2, 3, 4, 5, 6]); ds.has(di) ? ds.delete(di) : ds.add(di); upd(i, { days: [...ds].sort() }); } } }, d)));
      const src = segmented([{ value: 'local', label: pair('This value', '呢個值') }, { value: 'url', label: 'HTTPS URL' }], r.source || 'local', { label: 'Source' });
      src.onChange((v) => upd(i, { source: v }));
      box.append(h('div.card.tonal', h('div.row.nowrap', h('b', `#${i + 1}`), keySel, h('button.icon-btn.sm', { 'aria-label': 'Remove rule', on: { click: () => { store.set('schedules', rules.filter((_, j) => j !== i)); draw(); } } }, icon('delete'))), h('div.row', from, to), days, src.el, val));
    });
    box.append(h('div.row', h('button.btn.small', { on: { click: () => { store.set('schedules', [...rules, { id: Date.now(), key: 'theme', value: 'light', from: '07:00', to: '19:00', days: [0, 1, 2, 3, 4, 5, 6], source: 'local' }]); draw(); } } }, icon('add'), pair('Add rule', '加規則')),
      h('button.btn.small.outline', { on: { click: () => { store.set('schedules', [...rules, { id: Date.now(), key: 'motion', value: 'reduced', from: '22:00', to: '07:00', days: [0, 1, 2, 3, 4, 5, 6], source: 'local' }, { id: Date.now() + 1, key: 'theme', value: 'dark', from: '19:00', to: '07:00', days: [0, 1, 2, 3, 4, 5, 6], source: 'local' }]); draw(); } } }, icon('auto_fix_high'), pair('Preset: calm evenings', '預設：平靜夜晚'))));
  };
  const upd = (i, patch) => { const r = [...store.get('schedules')]; r[i] = { ...r[i], ...patch }; store.set('schedules', r); draw(); };
  draw();
  return box;
}

function locksSection() {
  const box = h('div.stack');
  const locks = store.get('locks');
  const ids = Object.keys(locks);
  box.append(h('p.small.muted', pair('Right-click any element and choose "Lock this element…" to lock it. Locked elements are disabled until unlocked.', '右鍵任何元素揀「鎖住呢個元素…」。鎖咗嘅元素要解鎖先用到。')));
  if (!ids.length) box.append(h('div.empty.small', icon('lock_open'), pair('Nothing is locked.', '冇嘢鎖住。')));
  for (const id of ids) box.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('lock')), h('span.meta', h('b', id), h('span', `${locks[id].mix} · ${pair('attempts', '次數')} ${locks[id].attempts}`)), h('button.btn.small', { on: { click: (e) => unlockPrompt(id, e.currentTarget) } }, pair('Unlock', '解鎖'))));
  box.append(h('div.row', h('button.btn.small.outline', { on: { click: (e) => lockWizard('settings-page', e.currentTarget) } }, icon('lock'), pair('Lock the Settings page', '鎖住設定頁')), h('button.btn.small.text', { on: { click: supportTickets } }, icon('support_agent'), pair('Support Tickets', '支援服務台'))));
  return box;
}

function vocabSection() {
  const box = h('div.stack');
  const draw = () => {
    clear(box);
    const st = vocabState();
    const input = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': pair('Choose a personal vocabulary JSON file', '揀個人詞彙 JSON 檔'), dataset: { el: 'vocab-upload' }, on: { change: async () => {
      const f = input.files[0]; if (!f) return;
      if (f.size > 256 * 1024) { toast(t('vocabBad', { why: pair('the file is larger than 256 KiB', '檔案大過 256 KiB') }), { kind: 'err' }); return; }
      try { loadVocabFromText(await f.text()); celebrate(); draw(); } catch (e) { toast(t('vocabBad', { why: e.message }), { kind: 'err' }); }
    } } });
    box.append(h('div.flag-card', { dataset: { el: 'set-vocabulary' } }, h('b', pair('Personal vocabulary JSON', '個人詞彙 JSON')),
      h('div', st.loaded ? h('span.badge.ok', pair(`Loaded · ${st.count} entries`, `已載入 · ${st.count} 項`)) : h('span.badge.info', pair('No file loaded', '未載入檔案'))),
      h('label.btn.tonal', { style: { alignSelf: 'flex-start' } }, icon('upload_file'), st.loaded ? pair('Replace file…', '換檔…') : pair('Choose file…', '揀檔…'), input),
      st.loaded ? h('button.btn.small.outline', { dataset: { el: 'vocab-clear' }, on: { click: () => { clearVocab(); toast(pair('Vocabulary cleared. Original wording restored.', '已清除詞彙，回復原本字眼。'), { kind: 'ok' }); draw(); } } }, icon('delete'), pair('Clear and reset', '清除同重設')) : null,
      h('div.small.muted', pair('You can also drop the file anywhere on the window. It is validated in full (schemaVersion 1, entries object, 256 KiB, depth 8, 160-character terms, 1,000-character replacements) and stays on this computer.', '亦可以將檔案拖到視窗任何位置。會完整驗證，只留喺本機。'))));
  };
  draw();
  return box;
}

function dataSection() {
  const box = h('div.stack');
  box.append(h('div.row', ...FORMATS.filter((f) => ['json', 'yaml', 'md'].includes(f.id)).map((f) => h('button.btn.small.outline', { on: { click: () => exportTo(f, () => ({ name: 'material-tailscale-settings', data: store.exportable() })) } }, icon('download'), `${t('export')} ${f.label}`)),
    h('label.btn.small.tonal', icon('upload'), pair('Import settings…', '匯入設定…'), h('input', { type: 'file', accept: '.json', hidden: true, on: { change: async (e) => { try { const j = JSON.parse(await e.target.files[0].text()); if (j.schema !== 'material-tailscale.settings') throw new Error(pair('Not a Material Tailscale settings export.', '唔係本程式嘅設定匯出。')); store.replaceAll(j.settings, 'Import settings'); toast(pair('Settings imported.', '已匯入設定。'), { kind: 'ok' }); } catch (err) { toast(err.message, { kind: 'err' }); } } } }))),
    h('div.row', h('button.btn.small.outline', { on: { click: () => openDest('history') } }, icon('history'), pair('Version history', '版本歷史')), h('button.btn.small.outline', { on: { click: async () => { const i = await window.mt.info(); window.mt.shell.openPath(i.userData); } } }, icon('folder_open'), pair('Open app data folder', '打開程式資料夾')),
      h('button.btn.small.danger', { on: { click: async () => { if (await superConfirm({ action: pair('Reset every setting to its default', '將所有設定重設為預設'), affects: pair('Appearance, language, schedules, panels and favourites. Locks, credentials and history are kept.', '外觀、語言、排程、面板同收藏。鎖、憑證同歷史會保留。') })) { const keep = { locks: store.get('locks'), onboarded: true }; store.replaceAll(keep, 'Reset all settings'); toast(pair('All settings reset.', '已重設全部設定。'), { kind: 'ok' }); } } } }, icon('restart_alt'), pair('Reset all settings…', '重設全部設定…'))));
  const edSel = h('select.input', { 'aria-label': pair('External editor', '外部編輯器') }, h('option', { value: '' }, pair('Detecting editors…', '偵測緊編輯器…')));
  window.mt.editor.detect().then((eds) => { clear(edSel).append(h('option', { value: '' }, pair('Pick automatically (VS Code first)', '自動揀（VS Code 優先）')), ...eds.map((e) => h('option', { value: e.path, selected: store.get('editor') === e.path }, e.name))); if (!eds.length) edSel.append(h('option', { disabled: true }, pair('No editor found', '搵唔到編輯器'))); });
  edSel.addEventListener('change', () => store.set('editor', edSel.value));
  box.append(h('div.flag-card', { dataset: { el: 'set-editor' } }, h('b', pair('External editor', '外部編輯器')), edSel, h('div.row', h('button.btn.small.outline', { on: { click: async () => { const p = await window.mt.dialog.open({ filters: [{ name: 'Programs', extensions: ['exe', 'cmd', 'bat', 'app', '*'] }] }); if (p) { store.set('editor', p[0]); toast(pair('Editor saved.', '已儲存編輯器。'), { kind: 'ok' }); } } } }, pair('Add another editor…', '加其他編輯器…')), h('button.btn.small.text', { on: { click: () => window.mt.shell.external('https://code.visualstudio.com/download') } }, pair('Get VS Code', '下載 VS Code')))));
  return box;
}

function logoSection() {
  const box = h('div.row');
  for (const k of ['mesh', 'orbit', 'knot']) box.append(h('button.chip.choice', { 'aria-pressed': String(store.get('logo') === k), on: { click: () => { store.set('logo', k); openDest('settings', 'appearance'); } } }, logoSvg(20, k), k));
  const up = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, on: { change: async () => {
    const f = up.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast(pair('Image is larger than 5 MB.', '圖片大過 5 MB。'), { kind: 'err' }); return; }
    try {
      const bmp = await createImageBitmap(f);
      if (bmp.width * bmp.height > 40e6) throw new Error(pair('Image dimensions are too large.', '圖片尺寸太大。'));
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); const s = Math.min(bmp.width, bmp.height);
      g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 128, 128);
      store.set('logoCustom', c.toDataURL('image/png')); store.set('logo', 'custom');
      toast(pair('Logo converted and applied.', '已轉換並套用標誌。'), { kind: 'ok' }); openDest('settings', 'appearance');
    } catch (e) { toast(pair(`That image could not be used: ${e.message}`, `用唔到呢張圖：${e.message}`), { kind: 'err' }); }
  } } });
  box.append(h('label.btn.small.tonal', icon('upload'), pair('Upload logo…', '上載標誌…'), up));
  if (store.get('logoCustom')) box.append(h('button.btn.small.text', { on: { click: () => { store.set('logoCustom', null); store.set('logo', 'mesh'); openDest('settings', 'appearance'); } } }, t('reset')));
  return h('div.flag-card', { dataset: { el: 'set-logo-upload' } }, h('b', pair('Logo presets and upload', '標誌預設同上載')), box);
}

registerPage('settings', (ctx) => {
  let sec = SECTIONS.find((s) => s[0] === ctx.arg)?.[0] || (window.mt.site ? 'language' : 'tailscale');
  const content = h('div.stack');
  const search = regexField({ id: 'settings', placeholder: pair('Search settings', '搜尋設定'), onChange: () => draw() });
  const nav = h('nav.subnav', { 'aria-label': pair('Settings sections', '設定分類') });
  const draw = () => {
    clear(nav).append(...SECTIONS.filter(([id]) => !(schoolOn() && ['vocabulary'].includes(id)) && !(window.mt.site && ['tailscale', 'data', 'about'].includes(id))).map(([id, en, yue, ic]) => h('button.subnav-item', { type: 'button', 'aria-current': String(id === sec), dataset: { el: `set-nav-${id}` }, on: { click: () => { sec = id; search.set(''); draw(); } } }, h('span.msr', { style: { fontSize: '16px' } }, ic), pair(en, yue))));
    clear(content);
    const { q, re } = search.value();
    if (q) {
      let test = (s) => s.toLowerCase().includes(q.toLowerCase());
      if (re) { try { const r = new RegExp(q, 'i'); test = (s) => r.test(s); } catch { /* keep plain */ } }
      const ms = SETTINGS_INDEX.filter((s) => test(`${s.en} ${s.yue} ${s.help} ${s.explain}`));
      content.append(h('div.flags-grid', ms.map(settingRow)));
      if (!ms.length) content.append(h('div.empty', icon('search_off'), pair('No setting matches.', '冇設定符合。')));
      return;
    }
    const rows = SETTINGS_INDEX.filter((s) => s.section === sec).filter((s) => !(schoolOn() && ['funnyEn', 'funnyYue', 'lang'].includes(s.key)));
    if (rows.length) content.append(h('div.flags-grid', rows.map(settingRow)));
    if (sec === 'appearance') content.append(logoSection(), h('div.card.tonal', h('b', pair('Per-element appearance', '逐個元素外觀')), h('p.small', pair('Right-click any element and choose "Edit appearance…" (or press Shift+F10 on it) to change its typography, colours, shape, image layer and filters for every state.', '右鍵任何元素揀「編輯外觀…」（或者撳 Shift+F10）去改字體、顏色、形狀、圖層同濾鏡。')), h('button.btn.small.outline', { on: { click: () => { store.set('appearance', {}); toast(pair('All element overrides removed.', '已移除所有元素外觀。'), { kind: 'ok' }); } } }, pair('Reset every element', '重設所有元素'))));
    if (sec === 'sound') content.append(voicePickers());
    if (sec === 'school') content.append(schoolSection());
    if (sec === 'schedules') content.append(schedulesSection());
    if (sec === 'locks') content.append(locksSection());
    if (sec === 'vocabulary') content.append(vocabSection());
    if (sec === 'data') content.append(dataSection());
    if (sec === 'about') content.append(h('div.row', h('button.btn.outline', { on: { click: () => openDest('about') } }, icon('info'), t('about')), h('button.btn.outline', { on: { click: async () => toast(String(await window.mt.update.check()), {}) } }, icon('system_update'), pair('Check for updates', '檢查更新')), h('button.btn.outline', { on: { click: () => { store.set('onboarded', false); store.set('onboardStep', 0); window.dispatchEvent(new CustomEvent('mt:onboard')); } } }, icon('rocket_launch'), pair('Run the setup wizard again', '再行一次設定精靈'))));
    if (sec === 'language') content.append(h('div.card.tonal', { dataset: { el: 'set-dimsum' } }, h('div.switch-row', h('div.txt', h('b', pair('Dim sum surprise', '點心驚喜')), h('span.small.muted', pair('A 1-in-10 chance of a dim sum dish at launch.', '開程式有十分一機會見到一款點心。'))), dimSwitch())));
  };
  draw();
  return h('div.page', pageHero(pair('Preferences', '偏好'), t('settings'), pair('Every setting explains itself and shows where its value came from.', '每個設定都有解釋，同顯示個值從邊度嚟。'), search.el), h('div.split', nav, h('div.split-main', content)));
});

function dimSwitch() {
  let n = 0;
  const s = switchCtl(true, { label: pair('Dim sum surprise', '點心驚喜') });
  s.onChange(() => { s.set(true); n++; toast(t('dimSumOff') + (n > 2 ? ' 🥟' : ''), { kind: 'info', emojiChar: '🥟' }); });
  return s.el;
}
