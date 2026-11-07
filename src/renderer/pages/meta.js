import { h, icon, clear, fmtDateTime } from '../core/dom.js';
import { t, pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ts from '../core/tsdata.js';
import { registerPage, openDest } from '../ui/shell.js';
import { toast, dialog, notificationCentre, collapsible } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { jsonTree } from '../ui/jsontree.js';
import { exportTo, FORMATS } from '../ui/exporter.js';
import { regexField } from '../ui/regex.js';
import { renderMarkdown } from '../ui/markdown.js';
import { ARTICLES, CHANGELOG } from '../docs-bundle.js';
import { logoSvg } from '../ui/logo.js';

const head = (eyebrow, title, desc, ...right) => h('div.page-head', h('div.titles', h('div.eyebrow', eyebrow), h('h1', title), desc ? h('p', desc) : null), ...right);

// ---------------- Offline docs ----------------
registerPage('docs', (ctx) => {
  const nav = h('div.stack', { style: { minWidth: '240px' } });
  const body = h('article.card', { style: { flex: '999 1 520px', minWidth: 0 } });
  const search = regexField({ id: 'docs', placeholder: pair('Search titles and article text', '搜尋標題同內文'), onChange: () => drawNav() });
  let cur = ARTICLES.find((a) => a.path === ctx.arg) || ARTICLES[0];
  const show = (a) => {
    cur = a; clear(body);
    if (!a) { body.append(h('div.empty', pair('No articles bundled.', '冇文章。'))); return; }
    body.append(renderMarkdown(a.body, { onLink: (href) => { const target = ARTICLES.find((x) => href.endsWith(x.path) || href.endsWith(x.path.split('/').pop())); if (target) { show(target); drawNav(); return true; } return false; } }));
    body.scrollIntoView({ block: 'start' });
  };
  const drawNav = () => {
    clear(nav);
    const { q, re } = search.value();
    let test = (a) => !q || (a.title + a.body).toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (a) => r.test(a.title + '\n' + a.body); } catch { /* plain */ } }
    const sections = [...new Set(ARTICLES.map((a) => a.category))];
    for (const c of sections) {
      const items = ARTICLES.filter((a) => a.category === c && test(a));
      if (!items.length) continue;
      nav.append(h('div.pal-group', c), ...items.map((a) => h('button.menu-item', { 'aria-current': a === cur ? 'page' : null, style: a === cur ? { background: 'var(--primary-cont)' } : null, on: { click: () => { show(a); drawNav(); } } }, icon('article'), a.title)));
    }
  };
  drawNav(); show(cur);
  return h('div.page', head(pair('Offline', '離線'), t('docs'), pair(`${ARTICLES.length} articles bundled into the app. Links between articles open here.`, `程式內置 ${ARTICLES.length} 篇文章。`)), search.el, h('div.row', { style: { alignItems: 'flex-start' } }, h('div.card.tonal', { style: { flex: '1 1 260px', maxHeight: '75vh', overflow: 'auto' } }, nav), body));
});

// ---------------- Changelog ----------------
registerPage('changelog', () => {
  const list = h('div.stack');
  const from = h('input.input', { type: 'date', 'aria-label': pair('From date', '由'), style: { maxWidth: '180px' } });
  const to = h('input.input', { type: 'date', 'aria-label': pair('To date', '至'), style: { maxWidth: '180px' } });
  const search = regexField({ id: 'changelog', placeholder: pair('Search changes', '搜尋改動'), onChange: () => draw() });
  let shown = [];
  const draw = () => {
    clear(list);
    const { q, re } = search.value();
    let test = (s) => !q || s.toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (s) => r.test(s); } catch { /* plain */ } }
    shown = CHANGELOG.filter((e) => (!from.value || e.date >= from.value) && (!to.value || e.date <= to.value) && test(e.body + e.version));
    if (!shown.length) list.append(h('div.empty', icon('event_busy'), pair('No release in this range.', '呢段時間冇版本。')));
    for (const e of shown) list.append(h('section.card', h('div.row', h('h2', `v${e.version}`), h('span.badge.info', e.date), e.codeName ? h('span.chip', e.codeName) : null, e.sha ? h('a.chip.mono', { href: `https://github.com/Ding-Ding-Projects/material-Tailscale/commit/${e.sha}`, target: '_blank' }, e.sha.slice(0, 7)) : null), renderMarkdown(e.body)));
  };
  [from, to].forEach((i) => i.addEventListener('change', draw));
  draw();
  return h('div.page', head(pair('Releases', '版本'), t('changelog'), pair('Every released version with its date, code name and commit.', '每個版本嘅日期、代號同提交。')),
    h('div.card.tonal', h('div.row', search.el, h('label.row', pair('From', '由'), from), h('label.row', pair('To', '至'), to),
      h('button.btn.small.outline', { on: { click: () => exportTo(FORMATS.find((f) => f.id === 'md'), () => ({ name: `changelog-${from.value || 'start'}-${to.value || 'now'}`, data: shown.map((e) => ({ version: e.version, date: e.date, sha: e.sha, codeName: e.codeName, notes: e.body })) })) } }, icon('download'), t('export')),
      h('button.btn.small.outline', { on: { click: () => { navigator.clipboard.writeText(shown.map((e) => `## v${e.version} (${e.date}) ${e.sha || ''}\n${e.body}`).join('\n\n')); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), t('copy')))), list);
});

// ---------------- Local history ----------------
registerPage('history', () => {
  const list = h('div.stack');
  const sel = new Set();
  const load = async () => {
    clear(list).append(h('div.skeleton', { style: { height: '120px' } }));
    const log = await window.mt.history.list(300).catch(() => []);
    clear(list);
    if (!log.length) { list.append(h('div.empty', icon('history'), pair('No changes recorded yet.', '未有紀錄。'))); return; }
    list.append(h('div.row', h('button.btn.small.outline', { on: { click: () => { log.forEach((e) => sel.add(e.oid)); load(); } } }, pair('Select all', '全選')), h('button.btn.small.outline', { disabled: !sel.size, on: { click: () => exportTo(FORMATS[0], () => ({ name: 'history', data: log.filter((e) => sel.has(e.oid)) })) } }, icon('download'), pair(`Export ${sel.size}`, `匯出 ${sel.size}`))));
    for (const e of log) list.append(h('div.pick-row', { style: { cursor: 'default' } }, h('input', { type: 'checkbox', checked: sel.has(e.oid), 'aria-label': 'Select', on: { change: (ev) => (ev.target.checked ? sel.add(e.oid) : sel.delete(e.oid)) } }), h('span.ava', icon('commit')), h('span.meta', h('b', e.message), h('span', `${fmtDateTime(e.time)} · ${e.oid.slice(0, 7)}`)),
      h('button.btn.small.outline', { on: { click: async () => dialog({ title: e.message, wide: true, body: jsonTree(await window.mt.history.files(e.oid), { open: 1 }) }) } }, icon('visibility'), pair('View', '睇')),
      h('button.btn.small', { on: { click: async () => { if (!(await superConfirm({ action: pair(`Restore settings from ${e.oid.slice(0, 7)}`, `由 ${e.oid.slice(0, 7)} 還原設定`), affects: pair('Current settings are replaced; the restore is recorded as a new revision so it can be undone.', '而家嘅設定會被取代；還原會記錄做新版本，可以再還原。') }))) return; const r = await window.mt.history.restore(e.oid); const s = JSON.parse(r.content['settings.json'] || 'null'); if (s?.settings) { store.replaceAll(s.settings, `Restored ${e.oid.slice(0, 7)}`); toast(pair('Restored.', '已還原。'), { kind: 'ok' }); } else toast(pair('That revision has no settings snapshot; its files are shown in View.', '嗰個版本冇設定快照。'), { kind: 'warn' }); load(); } } }, icon('restore'), pair('Restore', '還原'))));
  };
  load();
  return h('div.page', head(pair('Undo anything', '隨時還原'), t('history'), pair('A local Git history of every settings change, command run, admin change and policy file you saved. Restores add a new revision; nothing is ever rewritten.', '本機 Git 歷史，紀錄每次設定、指令、管理改動同政策檔。還原會加新版本，唔會改寫。'), h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))), list);
});

// ---------------- Status ----------------
registerPage('status', (ctx) => {
  const box = h('div.stack');
  const draw = (d) => {
    clear(box);
    const s = d.status;
    const rows = [
      [pair('Tailscale program', 'Tailscale 程式'), d.missing ? '🔴 ' + t('notInstalled') : '🟢 ' + pair('found', '搵到'), d.missing ? (d.located || []).join(', ') : ''],
      [pair('Backend state', '後端狀態'), s ? ({ Running: '🟢', Stopped: '⚪', NeedsLogin: '🟡' }[s.BackendState] || '🔵') + ' ' + s.BackendState : '⚪ —', pair('from tailscale status --json', '來自 tailscale status --json')],
      [pair('Health warnings', '健康警告'), s?.Health?.length ? `🟡 ${s.Health.length}` : '🟢 0', (s?.Health || []).join(' · ')],
      [pair('Last status poll', '上次輪詢'), d.lastPoll ? '🟢 ' + fmtDateTime(d.lastPoll) : '⚪ —', ''],
      [pair('MagicDNS suffix', 'MagicDNS 後綴'), s?.MagicDNSSuffix || '—', ''],
      [pair('Tailnet', 'Tailnet'), s?.CurrentTailnet?.Name || '—', ''],
      [pair('Client version', '用戶端版本'), s?.Version || '—', '']
    ];
    box.append(h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', pair('Check', '檢查')), h('th', pair('State', '狀態')), h('th', pair('Evidence', '證據')))), h('tbody', rows.map(([a, b, c]) => h('tr', h('td', a), h('td', b), h('td.small.muted', c)))))));
    if (s?.Health?.length) box.append(h('div.card.tonal', h('h3', pair('Health messages from tailscaled', 'tailscaled 健康訊息')), ...s.Health.map((m) => h('div', '⚠️ ' + m))));
  };
  const off = ts.subscribe(draw);
  ctx.onCleanup(off);
  return h('div.page', head(pair('Evidence', '證據'), t('status'), pair('What this app can see right now, and where each claim comes from.', '本程式而家睇到嘅嘢，同每項嘅來源。')), box);
});

registerPage('notifications', () => h('div.page', head(pair('Messages', '訊息'), t('notifications'), pair('Every notification, including dismissed ones. Search, select and delete in bulk.', '所有通知，包括已關閉嘅。可以搜尋同批量刪除。')), h('div.card', notificationCentre())));

registerPage('about', () => {
  const box = h('div.stack');
  window.mt.info().then((i) => {
    const b = i.build;
    box.append(h('div.row', logoSvg(64), h('div', h('h1', t('appName')), h('div.muted', store.get('displayName') ? pair(`Shown as "${store.get('displayName')}"`, `顯示為「${store.get('displayName')}」`) : ''))),
      h('div.kpis', h('div.kpi', h('b', `v${i.version}`), h('span', t('version'))), h('div.kpi', h('b', b?.codeName || '—'), h('span', t('codeName'))), h('div.kpi', h('b', b ? fmtDateTime(b.commitTime) : pair('unavailable', '冇資料')), h('span', t('updated'))), h('div.kpi', h('b', b?.commit?.slice(0, 7) || '—'), h('span', pair('commit', '提交'))), h('div.kpi', h('b', `Electron ${i.electron}`), h('span', `${i.platform} ${i.arch}`))),
      b?.photoUrl ? h('img', { src: b.photoUrl, alt: b.codeName, style: { maxWidth: '360px', borderRadius: '20px' } }) : null,
      h('p', pair('Material Tailscale is an independent desktop manager for Tailscale. It is not made by or affiliated with Tailscale Inc. Tailscale is a trademark of Tailscale Inc.', 'Material Tailscale 係獨立嘅 Tailscale 桌面管理程式，同 Tailscale Inc. 冇關係。')),
      h('p.small.muted', pair('Installers are unsigned. Windows may warn about an unknown publisher.', '安裝程式冇簽名，Windows 可能會警告。')),
      h('div.row', h('button.btn.outline', { on: { click: () => window.mt.shell.external('https://github.com/Ding-Ding-Projects/material-Tailscale') } }, icon('code'), 'GitHub'), h('button.btn.outline', { on: { click: () => window.mt.shell.external('https://ding-ding-projects.github.io/material-Tailscale/') } }, icon('public'), pair('Website', '網站')), h('button.btn.outline', { on: { click: () => openDest('changelog') } }, icon('update'), t('changelog'))));
  });
  return h('div.page', h('section.card', box));
});
