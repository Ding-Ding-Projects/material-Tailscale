import { h, icon, clear, fmtDateTime } from '../core/dom.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { checkForUpdates } from '../ui/updates.js';
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

const head = pageHero;

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
    const inRange = (e) => (e.unreleased ? !to.value : (!from.value || e.date >= from.value) && (!to.value || e.date <= to.value));
    shown = CHANGELOG.filter((e) => inRange(e) && test([e.body, e.version, e.title, e.codeName].join(' ')));
    if (!shown.length) list.append(h('div.empty', icon('event_busy'), pair('No release in this range.', '呢段時間冇版本。')));
    for (const e of shown) {
      const running = !e.unreleased && e.version === window.__MT_VERSION__?.split(' ')[0];
      const sub = [e.title, e.codeName, e.date].filter(Boolean).join(' · ');
      list.append(h('section.card.lift', { dataset: { el: `release-${e.unreleased ? 'unreleased' : e.version}` } },
        h('div.row', h('span.ic.warm', icon(e.unreleased ? 'construction' : 'ramen_dining')),
          h('div', { style: { flex: '1', minWidth: '0' } }, h('h2.release-title', e.unreleased ? pair('Unreleased', '未發佈') : `v${e.version}`), sub ? h('div.small.muted', sub) : null),
          e.unreleased ? h('span.badge.warn', pair('on main, not released yet', '喺 main，未發佈')) : running ? h('span.badge.ok', pair('running now', '用緊呢個')) : null,
          e.sha ? h('button.chip.mono', { type: 'button', on: { click: () => window.mt.shell.external(`https://github.com/Ding-Ding-Projects/material-Tailscale/commit/${e.sha}`) } }, e.sha.slice(0, 7)) : null),
        renderMarkdown(e.body)));
    }
  };
  [from, to].forEach((i) => i.addEventListener('change', draw));
  draw();
  const released = CHANGELOG.filter((e) => !e.unreleased);
  return h('div.page', head(pair('Releases', '版本'), t('changelog'), pair('Every released version with its date, code name and commit.', '每個版本嘅日期、代號同提交。'),
    heroStats([{ value: `v${(window.__MT_VERSION__ || '').split(' ')[0] || '?'}`, label: pair('running now', '用緊') }, { value: released.length, label: pair('releases listed', '個版本') }, ...(CHANGELOG.some((e) => e.unreleased) ? [{ value: pair('Yes', '有'), label: pair('unreleased work', '未發佈改動'), tone: 'ok' }] : [])])),
    h('div.card.tonal', h('div.row', search.el, h('label.row', pair('From', '由'), from), h('label.row', pair('To', '至'), to),
      h('button.btn.small.outline', { on: { click: () => exportTo(FORMATS.find((f) => f.id === 'md'), () => ({ name: `changelog-${from.value || 'start'}-${to.value || 'now'}`, data: shown.map((e) => ({ version: e.unreleased ? 'Unreleased' : e.version, title: e.title || '', date: e.date, sha: e.sha, codeName: e.codeName, notes: e.body })) })) } }, icon('download'), t('export')),
      h('button.btn.small.outline', { on: { click: () => { navigator.clipboard.writeText(shown.map((e) => `## ${e.unreleased ? `Unreleased: ${e.title}` : `v${e.version} (${e.date}) ${e.sha || ''}`}\n${e.body}`).join('\n\n')); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), t('copy')))), list);
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
  const checks = h('div.tbl-wrap');
  const extra = h('div.grid');
  const stats = h('div.hero-stats', { 'aria-live': 'polite' });
  const chip = (name, tone = '') => h('span.ic' + (tone ? '.' + tone : ''), icon(name));
  const mark = (tone, text) => h('span.state-mark', h(`span.dot-live${tone ? '.' + tone : ''}`, { 'aria-hidden': 'true' }), h('span', text));
  const stat = (value, label, tone) => h(`div.stat${tone ? '.' + tone : ''}`, h('b', String(value)), h('span', label));
  let last = null;
  const draw = (d) => {
    last = d;
    const s = d.status;
    const backend = s?.BackendState;
    const health = s?.Health || [];
    clear(stats).append(
      stat(backend || (d.missing ? pair('not found', '搵唔到') : '—'), pair('backend', '後端'), backend === 'Running' ? 'ok' : d.missing ? 'err' : backend ? 'warn' : ''),
      stat(`${store.get('statusInterval')} s`, pair('refresh', '更新間隔')),
      stat(s ? health.length : '—', pair('health warnings', '健康警告'), health.length ? 'warn' : s ? 'ok' : ''));
    const searched = d.located || [];
    const rows = [
      [pair('Tailscale program', 'Tailscale 程式'), d.missing ? mark('err', t('notInstalled')) : mark('', pair('found', '搵到')),
        d.missing && searched.length ? h('details', h('summary', pair(`Searched ${searched.length} places`, `搵過 ${searched.length} 個位置`)), h('div.out.small', searched.join('\n'))) : ''],
      [pair('Backend state', '後端狀態'), backend ? mark({ Running: '', Stopped: 'idle', NeedsLogin: 'warn', NeedsMachineAuth: 'warn' }[backend] ?? 'warn', backend) : mark('idle', '—'), pair('from tailscale status --json', '來自 tailscale status --json')],
      [pair('Health warnings', '健康警告'), s ? mark(health.length ? 'warn' : '', String(health.length)) : mark('idle', '—'), health.length ? pair('listed under Health below', '喺下面健康一欄') : ''],
      [pair('Last status poll', '上次輪詢'), d.lastPoll ? mark('', fmtDateTime(d.lastPoll)) : mark('idle', '—'), d.statusErr && !d.missing ? h('span.err-text', d.statusErr) : ''],
      [pair('MagicDNS suffix', 'MagicDNS 後綴'), s?.MagicDNSSuffix || '—', ''],
      [pair('Tailnet', 'Tailnet'), s?.CurrentTailnet?.Name || '—', ''],
      [pair('Client version', '用戶端版本'), s?.Version || '—', '']
    ];
    clear(checks).append(h('table.tbl', h('thead', h('tr', h('th', pair('Check', '檢查')), h('th', pair('State', '狀態')), h('th', pair('Evidence', '證據')))),
      h('tbody', rows.map(([a, b, c]) => h('tr', h('td', a), h('td', b), h('td.small.muted', c))))));
    clear(extra);
    if (!s) return;
    const self = s.Self || {};
    const kv = (k, v) => h('tr', h('th', { scope: 'row' }, k), h('td', v));
    extra.append(
      h('section.card.span-6', { dataset: { el: 'status-self' } }, h('div.card-head', chip('laptop'), h('h2.h3', pair('This device', '呢部裝置'))),
        h('div.tbl-wrap', h('table.tbl', h('tbody',
          kv('HostName', self.HostName || '—'), kv('DNSName', h('span.mono', self.DNSName || '—')), kv('TailscaleIPs', h('span.mono', (self.TailscaleIPs || []).join(', ') || '—')),
          kv('OS', self.OS || '—'), kv('Relay', self.Relay || '—'), kv('Online', h(`span.badge.${self.Online ? 'ok' : 'warn'}`, String(!!self.Online))))))),
      h('section.card.span-6', { dataset: { el: 'status-health' } }, h('div.card-head', chip('health_and_safety', 'alt'), h('h2.h3', pair('Health', '健康'))),
        health.length ? h('ol.steps.warn', health.map((m) => h('li', m))) : h('div.empty.small', icon('verified'), pair('tailscaled reports no health warnings.', 'tailscaled 冇報告健康警告。'))));
  };
  const off = ts.subscribe(draw);
  ctx.onCleanup(off);
  const exportBtn = h('button.btn.outline', { type: 'button', dataset: { el: 'status-export' }, on: { click: () => exportTo(FORMATS.find((f) => f.id === 'json'), () => ({ name: 'tailscale-status', data: { backend: last?.status?.BackendState || null, missing: !!last?.missing, lastPoll: last?.lastPoll ? new Date(last.lastPoll).toISOString() : null, status: last?.status || null } })) } }, icon('data_object'), pair('Export JSON', '匯出 JSON'));
  return h('div.page', head(pair('Evidence', '證據'), t('status'), pair('What this app can see right now, and where each claim comes from.', '本程式而家睇到嘅嘢，同每項嘅來源。'), exportBtn, stats),
    h('section.card', { dataset: { el: 'status-checks' } }, h('div.card-head', h('span.ic', icon('fact_check')), h('h2.h3', pair('Checks', '檢查'))), checks), extra);
});

registerPage('notifications', () => h('div.page', head(pair('Messages', '訊息'), t('notifications'), pair('Every notification, including dismissed ones. Search, select and delete in bulk.', '所有通知，包括已關閉嘅。可以搜尋同批量刪除。')), h('div.card', notificationCentre())));

const LICENCES = [
  ['Material Tailscale', 'MIT'], ['Electron', 'MIT'], ['isomorphic-git, marked, qrcode, 7zip-bin', 'MIT'],
  ['7-Zip', 'GNU LGPL (parts BSD-3-Clause)'], ['FFmpeg (ffmpeg-static)', 'GPL-3.0-or-later'], ['DOMPurify', 'MPL-2.0 or Apache-2.0'],
  ['pdf.js, jsQR, electron-squirrel-startup', 'Apache-2.0'], ['mammoth', 'BSD-2-Clause'], ['Tailscale OpenAPI document', 'BSD-3-Clause'],
  ['Outfit, Roboto Flex, JetBrains Mono', 'SIL OFL 1.1'], ['Material Symbols Rounded', 'Apache-2.0']
];

registerPage('about', () => {
  const page = h('div.page');
  const chip = (name, tone = '') => h('span.ic' + (tone ? '.' + tone : ''), icon(name));
  const row = (k, v) => h('tr', h('th', { scope: 'row' }, k), h('td', v));
  const ext = (url, label, ic) => h('button.btn.outline', { type: 'button', on: { click: () => window.mt.shell.external(url) } }, icon(ic), label);
  window.mt.info().then((i) => {
    const b = i.build || {};
    const repo = 'https://github.com/Ding-Ding-Projects/material-Tailscale';
    const local = pair('Not assigned: local build', '未有：本機建置');
    page.append(
      pageHero(t('appName'), t('about'), pair('A Material 3 desktop app for every Tailscale feature. Unsigned installers, local everything.', '一個 Material 3 桌面程式，包晒每個 Tailscale 功能。安裝程式冇簽名，乜都喺本機。'),
        h('button.btn.outline', { type: 'button', dataset: { el: 'about-update' }, on: { click: () => checkForUpdates() } }, icon('system_update'), pair('Check for updates', '檢查更新')),
        heroStats([{ value: `v${i.version}`, label: t('version') }, { value: b.commitTime ? fmtDateTime(b.commitTime) : pair('unavailable', '冇資料'), label: t('updated') }])),
      h('div.grid',
        h('section.card.span-6', { dataset: { el: 'about-build' } }, h('div.card-head', logoSvg(40), h('h2.h3', pair('Build', '建置'))),
          h('div.tbl-wrap', h('table.tbl', h('tbody',
            store.get('displayName') ? row(pair('Shown as', '顯示為'), store.get('displayName')) : null,
            row(t('version'), `v${i.version}`),
            row(t('codeName'), b.codeName || local),
            row(pair('Commit', '提交'), b.commit ? h('button.btn.text.small.mono', { type: 'button', on: { click: () => window.mt.shell.external(`${repo}/commit/${b.commit}`) } }, b.commit.slice(0, 7)) : '—'),
            b.dirtyTree === undefined ? null : row(pair('Source', '原始碼'), b.dirtyTree ? pair('That commit plus uncommitted changes', '嗰個提交加未提交嘅改動') : pair('Exactly that commit', '就係嗰個提交')),
            row(pair('Built by', '建置者'), b.builtBy || '—'),
            row(pair('Runtime', '執行環境'), `Electron ${i.electron} · ${i.platform} ${i.arch}`),
            row(pair('Installer', '安裝程式'), pair('Squirrel.Windows, unsigned', 'Squirrel.Windows，冇簽名'))))),
          b.photoUrl ? h('img.about-photo', { src: b.photoUrl, alt: b.codeName || '' }) : null),
        h('section.card.span-6', { dataset: { el: 'about-licences' } }, h('div.card-head', chip('gavel', 'alt'), h('h2.h3', pair('Licences', '授權'))),
          h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', pair('Component', '組件')), h('th', pair('Licence', '授權')))), h('tbody', LICENCES.map(([n, l]) => h('tr', h('td', n), h('td.mono.small', l))))))),
        h('section.card.span-12', { dataset: { el: 'about-notice' } },
          h('p', { style: { margin: 0 } }, pair('Material Tailscale is an independent desktop manager for Tailscale. It is not made by or affiliated with Tailscale Inc. Tailscale is a trademark of Tailscale Inc.', 'Material Tailscale 係獨立嘅 Tailscale 桌面管理程式，同 Tailscale Inc. 冇關係。Tailscale 係 Tailscale Inc. 嘅商標。')),
          h('p.small.muted', pair('Installers are unsigned. Windows may warn about an unknown publisher.', '安裝程式冇簽名，Windows 可能會警告。')),
          h('div.row', ext(repo, 'GitHub', 'code'), ext('https://ding-ding-projects.github.io/material-Tailscale/', pair('Website', '網站'), 'public'),
            h('button.btn.outline', { type: 'button', on: { click: () => openDest('changelog') } }, icon('update'), t('changelog'))))));
  });
  return page;
});
