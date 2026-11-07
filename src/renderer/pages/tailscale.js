import { h, icon, clear, fmtBytes, fmtAgo, debounce } from '../core/dom.js';
import { pageHero } from '../ui/hero.js';
import { ART } from '../../shared/hero-art.js';
import { t, tl, pair, emoji } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ts from '../core/tsdata.js';
import { registerPage, openDest, openInNewTab } from '../ui/shell.js';
import { commandForm, renderResult, infoBtn } from '../ui/command-form.js';
import { toast, menu, collapsible, dialog } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { liveChart } from '../ui/livechart.js';
import { jsonTree } from '../ui/jsontree.js';
import { exportMenu } from '../ui/exporter.js';
import { exitNodePick, chips, switchCtl, segmented } from '../ui/controls.js';
import { sound, narrate } from '../core/feedback.js';
import { COMMANDS, GROUPS, findCommand } from '../../shared/cli-catalog.js';
import { YUE_TITLES, YUE_GROUPS } from '../ui/cli-yue.js';
import { regexField } from '../ui/regex.js';
import { installTailscaleButton } from '../ui/jobs.js';

const head = pageHero;
const cmdBlock = (id, opts) => { const c = findCommand(id); return collapsible(`cmd-${id}`, h('span', pair(c.title, YUE_TITLES[id]), h('code.small.muted', { style: { marginLeft: '8px' } }, 'tailscale ' + c.path.join(' '))), h('div.card', commandForm(c, { compact: true, ...opts })), { startCollapsed: opts?.collapsed }); };

// level: 'h1' where the card is the page's main heading (Home), 'h2' under a page hero.
function missingCard(level = 'h2') {
  const art = h('div.hero-art'); art.innerHTML = ART.network;
  return h('section.setup', { dataset: { el: 'ts-missing' }, style: { gridColumn: '1 / -1' } }, art,
    h('div.stack',
      h('div.row', h('span.dot-live.err', { 'aria-hidden': 'true' }), h(`${level}.setup-title`, t('notInstalled'))),
      h('p', t('tsMissing')),
      h('ol.steps',
        h('li.done', pair('Material Tailscale is installed and running.', 'Material Tailscale 已經裝好兼行緊。')),
        h('li', pair('Install Tailscale with one click, or point Material Tailscale at an existing copy.', '一撳安裝 Tailscale，或者指去現有嘅一份。')),
        h('li', pair('Log in to your tailnet from Accounts.', '喺帳戶頁登入你嘅 tailnet。')),
        h('li', pair('Come back here for peers, traffic, routes and every setting.', '返嚟呢度睇裝置、流量、路由同所有設定。'))),
      h('div.row', installTailscaleButton(), h('button.btn.outline', { on: { click: () => openDest('settings', 'tailscale') } }, icon('folder_open'), pair('Choose its location', '揀佢嘅位置'))),
      ts.data.located?.length ? h('details', h('summary', pair('Places searched', '搵過嘅位置')), h('div.out', ts.data.located.join('\n'))) : null));
}

function stateOf(s) {
  if (!s) return { key: 'starting', dot: '' };
  const b = s.BackendState;
  if (b === 'Running') return { key: 'connected', dot: 'live' };
  if (b === 'NeedsLogin' || b === 'NeedsMachineAuth') return { key: 'needsLogin', dot: '' };
  if (b === 'Stopped') return { key: 'disconnected', dot: '' };
  return { key: 'starting', dot: '' };
}

// ---------------- Home ----------------
registerPage('home', (ctx) => {
  const page = h('div.page');
  const chart = liveChart({ series: [{ key: 'rx', label: pair('Download', '下載'), color: '--secondary' }, { key: 'tx', label: pair('Upload', '上載'), color: '--primary' }], label: pair('Live tailnet traffic', '即時 tailnet 流量') });
  const hero = h('section.card.hero.span-7', { dataset: { el: 'home-hero' } });
  const kp = h('div.kpis');
  const peersBox = h('div.peer-grid.stagger');
  const meshSvg = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 440 440'); s.classList.add('mesh'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<g class="spin"><circle cx="220" cy="220" r="180" fill="none" stroke="var(--outline)" stroke-dasharray="4 10"/><circle cx="220" cy="220" r="115" fill="none" stroke="var(--outline)"/><circle cx="400" cy="220" r="8" fill="var(--secondary)"/><circle cx="105" cy="220" r="7" fill="var(--primary)"/><circle cx="220" cy="40" r="6" fill="var(--tertiary)"/><circle cx="220" cy="335" r="6" fill="var(--primary)"/><line x1="220" y1="220" x2="400" y2="220" stroke="var(--secondary)" opacity=".4"/><line x1="220" y1="220" x2="105" y2="220" stroke="var(--primary)" opacity=".4"/><line x1="220" y1="220" x2="220" y2="40" stroke="var(--tertiary)" opacity=".4"/></g>'; return s; };
  const draw = (d) => {
    const s = d.status;
    clear(hero);
    hero.classList.toggle('bare', !!d.missing);
    hero.classList.toggle('span-12', !!d.missing); hero.classList.toggle('span-7', !d.missing);
    for (const e of [trafficCard, kpCard, peersHead, peersWrap]) e.hidden = !!d.missing;
    for (const e of firstRun) e.hidden = !d.missing;
    if (d.missing) { hero.append(missingCard('h1')); return; }
    const st = stateOf(s);
    const self = s?.Self;
    const on = st.key === 'connected';
    const ips = self?.TailscaleIPs || s?.TailscaleIPs || [];
    hero.append(meshSvg(),
      h('div.row', h(`span.dot${on ? '.live' : ''}`), h('b.small', { style: { textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--on-2)' } }, t(st.key))),
      h('h1', { style: { maxWidth: '560px', position: 'relative' } }, on ? pair('Your tailnet is humming.', '你個 tailnet 運作暢順。') : st.key === 'needsLogin' ? pair('Log in to join your tailnet.', '登入加入你嘅 tailnet。') : pair('Tailscale is off.', 'Tailscale 熄咗。')),
      h('p.muted', { style: { position: 'relative' } }, [self?.HostName, ...ips, s?.CurrentTailnet?.Name, s?.Self?.Relay ? `DERP ${s.Self.Relay}` : null].filter(Boolean).join(' · ') || (d.statusErr || '')),
      h('div.row', { style: { position: 'relative' } },
        h('button.btn.big' + (on ? '.green' : ''), { dataset: { el: 'home-connect' }, on: { click: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          const r = st.key === 'needsLogin' ? null : await ts.run(on ? 'down' : 'up', {});
          if (st.key === 'needsLogin') { openDest('accounts'); return; }
          b.disabled = false;
          if (r.code === 0) { sound(on ? 'disconnect' : 'connect'); toast(on ? pair('Disconnected.', '已斷線。') : pair('Connected.', '已連線。'), { kind: 'ok' }); narrate('conn', on ? 'Disconnected from Tailscale.' : 'Connected to Tailscale.', on ? '已經斷線。' : '已經連線。'); }
          else renderResult(h('div'), r, findCommand(on ? 'down' : 'up'));
          ts.poll();
        } } }, icon(on ? 'power_settings_new' : 'power'), st.key === 'needsLogin' ? pair('Log in', '登入') : t(on ? 'disconnect' : 'connect')),
        h('button.btn.outline.big', { on: { click: () => openDest('exit') } }, icon('travel_explore'), pair('Exit node: ', '出口：') + (Object.values(s?.Peer || {}).find((p) => p.ExitNode) ? ts.peerName(Object.values(s.Peer).find((p) => p.ExitNode)) : t('none'))),
        h('button.btn.outline.big', { on: { click: () => openDest('accounts') } }, icon('switch_account'), pair('Accounts', '帳戶'))));
    const ps = ts.peers();
    clear(kp).append(
      h('div.kpi', h('b', String(ps.filter((p) => p.Online).length)), h('span', pair('online peers', '在線裝置'))),
      h('div.kpi', h('b', String(ps.filter((p) => ts.peerPath(p) === 'direct').length)), h('span', pair('direct paths', '直連'))),
      h('div.kpi', h('b', String(ps.filter((p) => ts.peerPath(p) === 'relay').length)), h('span', pair('relayed', '中繼'))),
      h('div.kpi', h('b', fmtBytes(ps.reduce((n, p) => n + (p.RxBytes || 0), 0))), h('span', pair('received', '已接收'))),
      h('div.kpi', h('b', fmtBytes(ps.reduce((n, p) => n + (p.TxBytes || 0), 0))), h('span', pair('sent', '已傳送'))),
      h('div.kpi', h('b', s?.Version?.split('-')[0] || '—'), h('span', pair('client version', '用戶端版本'))));
    chart.update(d.traffic, { stale: Date.now() - d.lastPoll > store.get('statusInterval') * 3000 });
    clear(peersBox);
    const top = ps.sort((a, b) => (b.Online - a.Online) || ((b.RxBytes + b.TxBytes) - (a.RxBytes + a.TxBytes))).slice(0, 6);
    if (!top.length) peersBox.append(h('div.empty', icon('hub'), s ? pair('No peers yet. Add a device to your tailnet.', '未有其他裝置。加部裝置入 tailnet 啦。') : pair('Waiting for status…', '等緊狀態…')));
    top.forEach((p, i) => peersBox.append(peerCard(p, i)));
  };
  const kpCard = h('section.card.span-12', kp);
  const trafficCard = h('section.card.span-5', { dataset: { el: 'home-traffic' } }, h('div.card-head', h('h2', pair('Live traffic', '即時流量')), infoBtn(pair('Live traffic', '即時流量'), pair('Bytes per second across all peers, computed from the change in counters between status polls.', '所有裝置每秒位元組，由輪詢之間嘅計數差計出。'))), chart.el);
  const chip = (name, tone = '') => h('span.ic' + (tone ? '.' + tone : ''), icon(name));
  const firstRun = [
    h('section.card.span-6', { dataset: { el: 'home-preview' } }, h('div.card-head', chip('auto_awesome'), h('h2.h3', pair('What you will see here', '你會喺呢度見到乜'))),
      h('p.muted', pair('Peers with their live path, traffic, exit nodes, routes, sharing, DNS, Tailnet Lock and every CLI command as a form.', '裝置同佢哋嘅即時路徑、流量、出口節點、路由、分享、DNS、Tailnet Lock，仲有每個 CLI 指令嘅表格。'))),
    h('section.card.span-6', { dataset: { el: 'home-explore' } }, h('div.card-head', chip('explore', 'alt'), h('h2.h3', pair('Prefer to look around first?', '想先周圍睇下？'))),
      h('p.muted', pair('Settings, tools and every command form work without Tailscale. Each form previews the exact command it would run.', '設定、工具同每個指令表格冇 Tailscale 都用得。每個表格都會預覽佢會行嘅指令。')),
      h('div.row', h('button.btn.tonal', { dataset: { el: 'home-tour' }, on: { click: () => window.dispatchEvent(new Event('mt:onboard')) } }, icon('tour'), pair('Open the tour', '開導覽')),
        h('button.btn.text', { on: { click: () => openDest('cli') } }, icon('terminal'), pair('Browse every command', '睇晒所有指令'))))
  ];
  const peersHead = h('div.span-12.row', h('h2', { style: { flex: 1 } }, t('peers')), h('button.btn.text', { on: { click: () => openDest('peers') } }, pair('All peers', '全部裝置'), icon('arrow_forward')));
  const peersWrap = h('div.span-12', peersBox);
  const off = ts.subscribe(draw);
  ctx.onCleanup(() => { off(); chart.destroy(); });
  page.append(h('div.grid', hero, trafficCard, ...firstRun, kpCard, peersHead, peersWrap));
  return page;
});

export function peerCard(p, i = 0, { selectable, selected, onSelect } = {}) {
  const st = ts.peerPath(p);
  const card = h('article.peer-card' + (selected ? '.selected' : ''), { style: { '--i': i }, dataset: { el: 'peer-' + p.ID }, tabindex: '0' },
    selectable ? h('input.sel-box', { type: 'checkbox', checked: selected, 'aria-label': pair(`Select ${ts.peerName(p)}`, `揀 ${ts.peerName(p)}`), on: { change: (e) => onSelect(e.target.checked) } }) : null,
    h('div.row.nowrap', h('span.ava', icon(ts.peerIcon(p))), h('div', { style: { flex: 1, minWidth: 0 } }, h('div.name', ts.peerName(p)), h('div.ip', ts.peerIp(p))), h('span.badge.' + (st === 'direct' ? 'ok' : st === 'relay' ? 'warn' : st === 'offline' ? 'err' : 'info'), t(st))),
    h('div.row', (p.Tags || []).map((tg) => h('span.chip', tg)), p.ExitNodeOption ? h('span.chip', icon('travel_explore'), pair('exit node', '出口節點')) : null, p.ExitNode ? h('span.badge.ok', pair('in use', '使用緊')) : null, p.OS ? h('span.chip', p.OS) : null),
    h('div.small.muted', `${pair('Last seen', '最後見到')} ${p.Online ? pair('now', '而家') : fmtAgo(p.LastSeen)} · ↓${fmtBytes(p.RxBytes)} ↑${fmtBytes(p.TxBytes)}${p.Relay ? ` · DERP ${p.Relay}` : ''}`),
    h('div.row', h('button.btn.small.outline', { on: { click: () => openDest('cli', 'ping:' + ts.peerName(p)) } }, icon('network_ping'), 'Ping'),
      h('button.btn.small.outline', { on: { click: () => window.mt.ts.terminal('ssh', { positionals: [ts.peerName(p)] }).catch((e) => toast(e.message, { kind: 'err' })) } }, icon('terminal'), 'SSH'),
      h('button.btn.small.outline', { on: { click: () => openDest('taildrop', ts.peerName(p)) } }, icon('send'), pair('Send', '傳送')),
      h('button.icon-btn.sm', { 'aria-label': pair('More actions', '更多動作'), on: { click: (e) => peerMenu(e.currentTarget, p) } }, icon('more_vert'))));
  card.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); peerMenu({ x: e.clientX, y: e.clientY }, p); });
  return card;
}

export function peerMenu(at, p) {
  menu(at, [
    { label: pair('Copy IPv4', '複製 IPv4'), icon: 'content_copy', run: () => { navigator.clipboard.writeText(ts.peerIp(p)); toast(t('copied'), { kind: 'ok' }); } },
    { label: pair('Copy MagicDNS name', '複製 MagicDNS 名'), icon: 'content_copy', run: () => { navigator.clipboard.writeText((p.DNSName || '').replace(/\.$/, '')); toast(t('copied'), { kind: 'ok' }); } },
    { label: pair('Ping', 'Ping'), icon: 'network_ping', run: () => openDest('cli', 'ping:' + ts.peerName(p)) },
    { label: pair('Who is', '查身份'), icon: 'person_search', run: async () => { const r = await ts.run('whois', { flags: { json: true }, positionals: [ts.peerIp(p)] }); dialog({ title: ts.peerName(p), wide: true, body: r.json ? jsonTree(r.json, { open: 2 }) : h('div.out', r.stdout || r.stderr) }); } },
    { label: pair('Open Tailscale SSH', '開 Tailscale SSH'), icon: 'terminal', run: () => window.mt.ts.terminal('ssh', { positionals: [ts.peerName(p)] }) },
    { label: pair('Send files', '傳送檔案'), icon: 'send', run: () => openDest('taildrop', ts.peerName(p)) },
    p.ExitNodeOption ? { label: pair('Use as exit node', '用做出口節點'), icon: 'travel_explore', live: { kind: 'switch', get: () => !!ts.peers().find((x) => x.ID === p.ID)?.ExitNode, set: (on) => setExit(on ? ts.peerName(p) : '') } } : null,
    { label: pair('Open in a new tab', '喺新分頁開'), icon: 'tab', run: () => openInNewTab('peers', ts.peerName(p)) },
    '-',
    { label: pair('Show raw details', '顯示原始資料'), icon: 'data_object', run: () => dialog({ title: ts.peerName(p), wide: true, body: jsonTree(p, { open: 1 }) }) }
  ].filter(Boolean));
}

async function setExit(name) {
  const r = await ts.run('set', { flags: { 'exit-node': name } });
  if (r.code === 0) { toast(name ? pair(`Exit node set to ${name}.`, `出口節點設為 ${name}。`) : pair('Exit node turned off.', '已關閉出口節點。'), { kind: 'ok' }); sound('connect'); }
  else renderResult(h('div'), r, findCommand('set'));
  ts.poll();
}

// ---------------- Peers ----------------
registerPage('peers', (ctx) => {
  const sel = new Set();
  let filter = { q: '', re: false, state: 'all', os: 'all' };
  const grid = h('div.peer-grid.stagger');
  const bulk = h('div');
  const counts = h('span.badge.info');
  const search = regexField({ placeholder: pair('Filter by name, IP, tag, OS…', '按名、IP、標籤、系統篩選…'), onChange: (q, re) => { filter.q = q; filter.re = re; draw(); }, id: 'peers-search' });
  const stateSeg = segmented(['all', 'direct', 'relay', 'idle', 'offline'].map((v) => ({ value: v, label: v === 'all' ? t('all') : t(v) })), 'all', { label: pair('Connection', '連線') });
  stateSeg.onChange((v) => { filter.state = v; draw(); });
  let view = 'cards';
  const viewSeg = segmented([{ value: 'cards', label: pair('Cards', '卡片'), icon: 'grid_view' }, { value: 'table', label: pair('Table', '表格'), icon: 'table_rows' }], view, { label: 'View' });
  viewSeg.onChange((v) => { view = v; draw(); });
  const matches = () => ts.peers().filter((p) => {
    const hay = `${ts.peerName(p)} ${(p.TailscaleIPs || []).join(' ')} ${(p.Tags || []).join(' ')} ${p.OS} ${p.DNSName}`;
    if (filter.q) { if (filter.re) { try { if (!new RegExp(filter.q, 'i').test(hay)) return false; } catch { return true; } } else if (!hay.toLowerCase().includes(filter.q.toLowerCase())) return false; }
    if (filter.state !== 'all' && ts.peerPath(p) !== filter.state) return false;
    return true;
  });
  const drawBulk = (ms) => {
    clear(bulk);
    if (!sel.size) return;
    bulk.append(h('div.bulk-bar', h('b', pair(`${sel.size} selected`, `已揀 ${sel.size} 部`)),
      h('button.btn.small.tonal', { on: { click: () => { ms.forEach((p) => sel.add(p.ID)); draw(); } } }, pair(`Select all ${ms.length} matches`, `全選 ${ms.length} 部`)),
      h('button.btn.small.tonal', { on: { click: () => { ms.forEach((p) => (sel.has(p.ID) ? sel.delete(p.ID) : sel.add(p.ID))); draw(); } } }, pair('Invert', '反選')),
      h('button.btn.small', { on: { click: () => bulkPing(ms.filter((p) => sel.has(p.ID))) } }, icon('network_ping'), pair('Ping all', '全部 Ping')),
      h('button.btn.small', { on: { click: () => { navigator.clipboard.writeText(ms.filter((p) => sel.has(p.ID)).map(ts.peerIp).join('\n')); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), pair('Copy IPs', '複製 IP')),
      exportMenu(() => ({ name: 'peers', data: ms.filter((p) => sel.has(p.ID)) })),
      h('span.spacer'), h('button.btn.small.text', { on: { click: () => { sel.clear(); draw(); } } }, pair('Clear selection', '清除選擇'))));
  };
  const draw = () => {
    const ms = matches();
    counts.textContent = pair(`${ms.length} of ${ts.peers().length}`, `${ms.length} / ${ts.peers().length}`);
    clear(grid);
    if (ts.data.missing) { grid.append(missingCard()); return; }
    if (!ms.length) grid.append(h('div.empty', icon('search_off'), pair('No peers match.', '冇裝置符合。')));
    if (view === 'cards') { grid.className = 'peer-grid stagger'; ms.forEach((p, i) => grid.append(peerCard(p, i, { selectable: true, selected: sel.has(p.ID), onSelect: (on) => { on ? sel.add(p.ID) : sel.delete(p.ID); drawBulk(ms); } }))); }
    else {
      grid.className = '';
      const tbl = h('table.tbl', h('thead', h('tr', h('th', ''), ['Name', 'IPv4', 'IPv6', 'OS', 'Path', 'Relay', 'Rx', 'Tx', 'Last seen', 'Tags'].map((c) => h('th', c)))),
        h('tbody', ms.map((p) => { const tr = h('tr' + (sel.has(p.ID) ? '.sel' : ''), h('td', h('input', { type: 'checkbox', checked: sel.has(p.ID), 'aria-label': 'Select', on: { change: (e) => { e.target.checked ? sel.add(p.ID) : sel.delete(p.ID); draw(); } } })), h('td', h('b', ts.peerName(p))), h('td.mono', ts.peerIp(p)), h('td.mono.small', (p.TailscaleIPs || [])[1] || ''), h('td', p.OS), h('td', h('span.badge.' + ({ direct: 'ok', relay: 'warn', offline: 'err' }[ts.peerPath(p)] || 'info'), t(ts.peerPath(p)))), h('td', p.Relay || ''), h('td', fmtBytes(p.RxBytes)), h('td', fmtBytes(p.TxBytes)), h('td', p.Online ? pair('now', '而家') : fmtAgo(p.LastSeen)), h('td', (p.Tags || []).join(', '))); tr.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); peerMenu({ x: e.clientX, y: e.clientY }, p); }); return tr; })));
      grid.append(h('div.tbl-wrap', tbl));
    }
    drawBulk(ms);
  };
  const off = ts.subscribe(debounce(draw, 100));
  ctx.onCleanup(off);
  if (ctx.arg) { filter.q = ctx.arg; search.set(ctx.arg); }
  return h('div.page', head('Tailnet', t('peers'), pair('Every device on your tailnet with its live path, traffic, tags and quick actions. Right-click any device for more.', '你 tailnet 上每部裝置嘅即時路徑、流量、標籤同快捷動作。右鍵睇更多。'), counts, exportMenu(() => ({ name: 'peers', data: matches() }))),
    collapsible('peers-filters', pair('Search and filters', '搜尋同篩選'), h('div.card.tonal', search.el, h('div.row', stateSeg.el, viewSeg.el)), { startCollapsed: false }),
    grid, bulk, cmdBlock('status', { collapsed: true }), cmdBlock('whois', { collapsed: true }), cmdBlock('ip', { collapsed: true }));
});

async function bulkPing(list) {
  toast(pair(`Pinging ${list.length} devices…`, `Ping 緊 ${list.length} 部裝置…`));
  const res = await Promise.all(list.map((p) => ts.run('ping', { flags: { c: 1 }, positionals: [ts.peerIp(p)] }).then((r) => ({ p, r }))));
  dialog({ title: pair('Ping results', 'Ping 結果'), wide: true, body: h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', 'Device'), h('th', 'Result'))), h('tbody', res.map(({ p, r }) => h('tr', h('td', ts.peerName(p)), h('td.mono.small', (r.stdout || r.stderr || '').trim().split('\n').pop())))))) });
}

// ---------------- Exit nodes ----------------
registerPage('exit', () => {
  const pick = exitNodePick(undefined, { label: t('exit') });
  const lan = switchCtl(false, { label: pair('Allow local network access', '容許存取本地網絡') });
  const apply = h('button.btn.big.green', { on: { click: async () => {
    const v = pick.get();
    const flags = { 'exit-node': v ?? '', 'exit-node-allow-lan-access': lan.get() };
    const r = await ts.run('set', { flags });
    if (r.code === 0) { sound('connect'); toast(v ? pair(`Using exit node ${v}.`, `使用緊出口節點 ${v}。`) : pair('Exit node off.', '已關出口節點。'), { kind: 'ok' }); } else renderResult(h('div'), r, findCommand('set'));
    ts.poll();
  } } }, icon('check'), t('apply'));
  const suggest = h('button.btn.tonal.big', { on: { click: async () => { const r = await ts.run('exit-node-suggest'); const line = (r.stdout || '').trim(); toast(line || r.stderr || pair('No suggestion.', '冇建議。'), { kind: r.code === 0 ? 'info' : 'err', title: pair('Suggested exit node', '建議出口節點'), sticky: true }); } } }, icon('auto_awesome'), pair('Suggest the best one', '建議最好嗰個'));
  const adv = switchCtl(!!ts.self()?.ExitNodeOption, { label: pair('Advertise this device as an exit node', '將呢部機宣告做出口節點') });
  adv.onChange(async (v) => { const r = await ts.run('set', { flags: { 'advertise-exit-node': v } }); if (r.code === 0) toast(v ? pair('This device is offered as an exit node. Approve it in the admin console.', '已宣告做出口節點，記得喺管理控制台批准。') : pair('No longer offered as an exit node.', '唔再做出口節點。'), { kind: 'ok' }); else renderResult(h('div'), r, findCommand('set')); });
  return h('div.page', head(pair('Routing', '路由'), t('exit'), pair('Send internet traffic through another device, a Mullvad location, or let Tailscale pick automatically.', '經另一部裝置、Mullvad 地點上網，或者畀 Tailscale 自動揀。'), suggest),
    h('div.grid', h('section.card.span-7', h('div.card-head', h('h2', pair('Choose an exit node', '揀出口節點'))), pick.el, h('div.switch-row', h('div.txt', h('b', pair('Allow local network access', '容許存取本地網絡')), h('span.small.muted', '--exit-node-allow-lan-access')), lan.el), h('div.row', apply)),
      h('section.card.span-5.tonal', h('h2', pair('This device', '呢部裝置')), h('div.switch-row', h('div.txt', h('b', pair('Offer as exit node', '做出口節點')), h('span.small.muted', '--advertise-exit-node')), adv.el), h('p.small.muted', pair('Once advertised, a tailnet admin approves it in the admin console or through Admin > Devices > routes in this app.', '宣告之後，要管理員喺管理控制台或者本程式嘅 Admin > Devices 批准。')))),
    cmdBlock('exit-node-list', { collapsed: true }), cmdBlock('exit-node-suggest', { collapsed: true }));
});

// ---------------- Routes ----------------
registerPage('routes', () => {
  const self = ts.self();
  const routes = chips(self?.PrimaryRoutes || [], { kind: 'cidrs', label: pair('Advertised subnet routes', '宣告嘅子網路由'), suggestions: ['198.51.100.0/24', '203.0.113.0/24', '192.0.2.0/24'] });
  const accept = switchCtl(false, { label: pair('Accept routes', '接受路由'), triState: true });
  const snat = switchCtl(undefined, { label: 'SNAT', triState: true });
  const stateful = switchCtl(undefined, { label: pair('Stateful filtering', '有狀態過濾'), triState: true });
  const connector = switchCtl(undefined, { label: pair('App connector', 'App 連接器'), triState: true });
  const apply = h('button.btn.big', { on: { click: async () => {
    const flags = { 'advertise-routes': routes.get() };
    if (accept.get() !== undefined) flags['accept-routes'] = accept.get();
    if (snat.get() !== undefined) flags['snat-subnet-routes'] = snat.get();
    if (stateful.get() !== undefined) flags['stateful-filtering'] = stateful.get();
    if (connector.get() !== undefined) flags['advertise-connector'] = connector.get();
    const r = await ts.run('set', { flags });
    if (r.code === 0) toast(pair('Routing preferences applied.', '已套用路由設定。'), { kind: 'ok' }); else renderResult(h('div'), r, findCommand('set'));
  } } }, icon('check'), t('apply'));
  const sw = (label, flag, c) => h('div.switch-row', h('div.txt', h('b', label), h('code.small.muted', flag)), c.el);
  return h('div.page', head(pair('Routing', '路由'), t('routes'), pair('Share local subnets with your tailnet, accept routes others share, and run as an app connector.', '同 tailnet 分享本地子網、接受其他人嘅路由、做 App 連接器。')),
    h('div.grid', h('section.card.span-7', h('h2', pair('Subnet routes this device advertises', '呢部機宣告嘅子網路由')), routes.el, h('p.small.muted', pair('Press Enter, comma or space after each CIDR. Paste a list to add many. An empty list clears all routes.', '每個 CIDR 後撳 Enter、逗號或空格。可以貼一串。清空即刪除所有路由。'))),
      h('section.card.span-5.tonal', h('h2', pair('Behaviour', '行為')), sw(pair('Accept routes from peers', '接受其他裝置嘅路由'), '--accept-routes', accept), sw(pair('Source NAT subnet traffic (Linux)', '子網 SNAT（Linux）'), '--snat-subnet-routes', snat), sw(pair('Stateful filtering', '有狀態過濾'), '--stateful-filtering', stateful), sw(pair('Advertise as app connector', '宣告做 App 連接器'), '--advertise-connector', connector), h('div.row', apply))),
    cmdBlock('appc-routes', { collapsed: true }));
});

// ---------------- Serve & Funnel ----------------
registerPage('serve', () => {
  const statusBox = h('div.stack');
  const load = async () => {
    clear(statusBox).append(h('div.skeleton', { style: { height: '80px' } }));
    const [s, f] = await Promise.all([ts.run('serve-status'), ts.run('funnel-status')]);
    clear(statusBox);
    const cfg = s.json || {};
    const web = Object.entries(cfg.Web || {});
    const tcp = Object.entries(cfg.TCP || {});
    const funnel = cfg.AllowFunnel || {};
    if (!web.length && !tcp.length) statusBox.append(h('div.empty', icon('lan'), pair('Nothing is being served yet. Use Serve or Funnel below.', '未有分享任何嘢。用下面嘅 Serve 或 Funnel。')));
    for (const [hostport, w] of web) for (const [mount, hd] of Object.entries(w.Handlers || {})) {
      const target = hd.Proxy || hd.Path || (hd.Text !== undefined ? `text: ${hd.Text}` : JSON.stringify(hd));
      statusBox.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon(funnel[hostport] ? 'public' : 'lan')), h('span.meta', h('b', `https://${hostport}${mount}`), h('span', `→ ${target}`)), funnel[hostport] ? h('span.badge.warn', pair('Public (Funnel)', '公開（Funnel）')) : h('span.badge.ok', pair('Tailnet only', '只限 tailnet')),
        h('button.icon-btn.sm', { 'aria-label': pair('Open', '開'), on: { click: () => window.mt.shell.external(`https://${hostport}${mount}`) } }, icon('open_in_new'))));
    }
    for (const [port, h2] of tcp) statusBox.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('settings_ethernet')), h('span.meta', h('b', `TCP ${port}`), h('span', JSON.stringify(h2))), null));
    statusBox.append(collapsible('serve-raw', pair('Raw Serve and Funnel status', '原始狀態'), h('div.out', jsonTree({ serve: s.json ?? s.stdout, funnel: f.json ?? f.stdout })), { startCollapsed: true }));
  };
  load();
  return h('div.page', head(pair('Sharing', '分享'), t('serve'), pair('Serve shares a local service with your tailnet. Funnel shares it with the whole internet. Pick a target type and the exact command builds itself.', 'Serve 同 tailnet 分享本機服務；Funnel 公開畀成個互聯網。揀目標類型，指令自動砌好。'), h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))),
    h('section.card', h('h2', pair('Currently serving', '而家分享緊')), statusBox),
    cmdBlock('serve'), cmdBlock('funnel', { collapsed: true }), cmdBlock('serve-off', { collapsed: true }), cmdBlock('funnel-off', { collapsed: true }),
    cmdBlock('service-list', { collapsed: true }), cmdBlock('serve-drain', { collapsed: true }), cmdBlock('serve-advertise', { collapsed: true }), cmdBlock('serve-get-config', { collapsed: true }), cmdBlock('serve-set-config', { collapsed: true }),
    cmdBlock('serve-reset', { collapsed: true }), cmdBlock('funnel-reset', { collapsed: true }));
});

// ---------------- Taildrop ----------------
registerPage('taildrop', (ctx) => {
  const zone = h('div.card.hero', { style: { minHeight: '200px', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderStyle: 'dashed' }, dataset: { el: 'taildrop-zone' } },
    icon('cloud_upload'), h('h2', pair('Drop files here to send them', '將檔案拖到呢度傳送')), h('p.muted', pair('Then choose the device below and press Run.', '然後揀裝置再撳執行。')));
  let files = [];
  const slot = h('div');
  const mk = () => clear(slot).append(commandForm(findCommand('file-cp'), { compact: true, preset: { positionals: [files.length ? files : undefined, ctx.arg] } }));
  mk();
  const form = slot;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); zone.style.borderColor = ''; const add = [...e.dataTransfer.files].map((f) => window.mt.pathForFile(f)); files = [...new Set([...files, ...add])]; mk(); toast(pair(`${add.length} file(s) added.`, `加咗 ${add.length} 個檔案。`), { kind: 'ok' }); });
  return h('div.page', head('Taildrop', t('taildrop'), pair('Send files to any of your devices and collect files sent to this one.', '傳檔案去你任何一部裝置，同收取傳過嚟嘅檔案。')),
    zone, h('section.card', h('h2', pair('Send', '傳送')), form), cmdBlock('file-get'), cmdBlock('file-targets', { collapsed: true }));
});

// ---------------- DNS ----------------
registerPage('dns', () => {
  const box = h('div.stack');
  (async () => { const r = await ts.run('dns-status', { flags: { json: true } }); clear(box).append(r.json ? h('div.out', jsonTree(r.json, { open: 2 })) : h('div.out', r.stdout || r.stderr)); })();
  const acc = switchCtl(undefined, { label: pair('Use tailnet DNS settings', '用 tailnet DNS 設定'), triState: true });
  acc.onChange(async (v) => { if (v === undefined) return; const r = await ts.run('set', { flags: { 'accept-dns': v } }); if (r.code === 0) toast(pair('DNS preference applied.', '已套用 DNS 設定。'), { kind: 'ok' }); else renderResult(h('div'), r, findCommand('set')); });
  return h('div.page', head('MagicDNS', t('dns'), pair('This device\'s DNS forwarder, live queries through it, and the tailnet-wide DNS settings in Admin.', '本機 DNS 轉發、即時查詢，同管理控制台嘅全網 DNS 設定。'), h('button.btn.outline', { on: { click: () => openDest('admin', 'DNS') } }, icon('admin_panel_settings'), pair('Tailnet DNS settings', '全網 DNS 設定'))),
    h('div.grid', h('section.card.span-7', h('h2', pair('Local DNS status', '本機 DNS 狀態')), box), h('section.card.span-5.tonal', h('h2', pair('Accept DNS', '接受 DNS')), h('div.switch-row', h('div.txt', h('b', pair('Use the DNS configured for the tailnet', '使用 tailnet 嘅 DNS')), h('code.small.muted', '--accept-dns')), acc.el))),
    cmdBlock('dns-query'), cmdBlock('dns-status', { collapsed: true }));
});

// ---------------- Tailnet Lock ----------------
registerPage('lock', () => {
  const box = h('div.stack', h('div.skeleton', { style: { height: '90px' } }));
  (async () => {
    const r = await ts.run('lock-status', { flags: { json: true } });
    clear(box);
    const j = r.json;
    if (!j) { box.append(h('div.out', r.stdout || r.stderr)); return; }
    box.append(h('div.kpis', h('div.kpi', h('b', j.Enabled ? pair('Enabled', '已啟用') : pair('Off', '未啟用')), h('span', pair('Tailnet Lock', '網絡鎖'))), h('div.kpi', h('b', String((j.TrustedKeys || []).length)), h('span', pair('trusted keys', '信任鎖匙'))), h('div.kpi', h('b', j.NodeKeySigned ? pair('Signed', '已簽') : pair('Unsigned', '未簽')), h('span', pair('this node', '本機')))),
      j.PublicKey ? h('div.row', h('code.chip.mono', j.PublicKey), h('button.btn.small.outline', { on: { click: () => { navigator.clipboard.writeText(j.PublicKey); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'), pair('Copy this node\'s key', '複製本機鎖匙'))) : null,
      (j.TrustedKeys || []).length ? h('div.stack', (j.TrustedKeys || []).map((k) => h('div.chip.mono', k.Key || JSON.stringify(k)))) : null,
      collapsible('lock-raw', pair('Raw status', '原始狀態'), h('div.out', jsonTree(j)), { startCollapsed: true }));
  })();
  return h('div.page', head(pair('Security', '安全'), t('lock'), pair('Require trusted signing nodes to approve every new device. Manage keys, signatures, disablement and recovery.', '新裝置要經信任節點簽署先加入。管理鎖匙、簽署、停用同復原。')),
    h('section.card', h('h2', pair('Status', '狀態')), box),
    ...['lock-sign', 'lock-add', 'lock-remove', 'lock-init', 'lock-log', 'lock-revoke-keys', 'lock-disable', 'lock-local-disable', 'lock-disablement-kdf'].map((id, i) => cmdBlock(id, { collapsed: i > 0 })));
});

// ---------------- Taildrive ----------------
registerPage('drive', () => {
  const box = h('div.stack');
  const load = async () => { const r = await ts.run('drive-list'); clear(box).append(r.stdout?.trim() ? h('div.out', r.stdout) : h('div.empty', icon('folder_off'), r.stderr || pair('No folders are shared.', '未有共享資料夾。'))); };
  load();
  return h('div.page', head('Taildrive', t('drive'), pair('Share folders with other devices on your tailnet over WebDAV.', '經 WebDAV 同 tailnet 其他裝置共享資料夾。'), h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))),
    h('section.card', h('h2', pair('Shares', '共享')), box), cmdBlock('drive-share'), cmdBlock('drive-rename', { collapsed: true }), cmdBlock('drive-unshare', { collapsed: true }));
});

registerPage('certs', () => h('div.page', head('HTTPS', t('certs'), pair('Get a free Let\'s Encrypt certificate for this device\'s ts.net name.', '為本機 ts.net 名稱攞免費 Let\'s Encrypt 證書。')), cmdBlock('cert')));

// ---------------- Accounts ----------------
registerPage('accounts', () => {
  const list = h('div.stack');
  const load = async () => {
    clear(list).append(h('div.skeleton', { style: { height: '60px' } }));
    const accts = await ts.loadAccounts().catch(() => []);
    clear(list);
    if (!accts?.length) list.append(h('div.empty', icon('person_off'), pair('No accounts yet. Log in below.', '未有帳戶，喺下面登入。')));
    for (const a of accts || []) {
      const name = a.Account || a.account || a.Name || a.ID;
      const cur = a.Selected || a.selected;
      list.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('account_circle')), h('span.meta', h('b', name), h('span', `${a.Tailnet || a.tailnet || ''} · id ${a.ID || a.id || ''}`)), cur ? h('span.badge.ok', pair('current', '而家用緊')) : h('button.btn.small', { on: { click: async () => { const r = await ts.run('switch', { positionals: [name] }); if (r.code === 0) { toast(pair(`Switched to ${name}.`, `已切換到 ${name}。`), { kind: 'ok' }); load(); ts.poll(); } else renderResult(h('div'), r, findCommand('switch')); } } }, pair('Switch', '切換'))));
    }
  };
  load();
  return h('div.page', head(pair('Identity', '身份'), t('accounts'), pair('Every account logged in on this device, fast user switching, login with every option, and logout.', '本機所有帳戶、快速切換、全部選項登入同登出。'), h('button.btn.outline', { on: { click: load } }, icon('refresh'), t('refresh'))),
    h('section.card', h('h2', pair('Accounts on this device', '本機帳戶')), list), cmdBlock('login'), cmdBlock('whoami', { collapsed: true }), cmdBlock('switch-remove', { collapsed: true }), cmdBlock('logout', { collapsed: true }));
});

// ---------------- Diagnostics ----------------
registerPage('diagnostics', () => {
  const nc = h('div.stack');
  const runNet = async () => {
    clear(nc).append(h('div.skeleton', { style: { height: '120px' } }));
    const r = await ts.run('netcheck', { flags: { format: 'json' } });
    clear(nc);
    const j = r.json;
    if (!j) { nc.append(h('div.out', r.stdout || r.stderr)); return; }
    const lat = Object.entries(j.RegionLatency || {}).map(([id, ns]) => ({ id, ms: ns / 1e6 })).sort((a, b) => a.ms - b.ms);
    const max = Math.max(1, ...lat.map((x) => x.ms));
    nc.append(h('div.kpis', h('div.kpi', h('b', j.UDP ? '✓' : '✕'), h('span', 'UDP')), h('div.kpi', h('b', j.IPv4 ? '✓' : '✕'), h('span', 'IPv4')), h('div.kpi', h('b', j.IPv6 ? '✓' : '✕'), h('span', 'IPv6')), h('div.kpi', h('b', j.MappingVariesByDestIP ? pair('Hard', '難') : pair('Easy', '易')), h('span', 'NAT')), h('div.kpi', h('b', String(j.PreferredDERP || '—')), h('span', pair('nearest DERP', '最近 DERP'))), h('div.kpi', h('b', j.GlobalV4 || '—'), h('span', pair('public IPv4', '公網 IPv4')))),
      h('div.stack', lat.slice(0, 30).map((x, i) => h('div.row.nowrap', h('code.small', { style: { width: '70px' } }, `region ${x.id}`), h('div', { style: { flex: 1, height: '12px', borderRadius: '6px', background: 'var(--surface-3)', overflow: 'hidden' } }, h('div', { style: { width: `${(x.ms / max) * 100}%`, height: '100%', borderRadius: '6px', background: i === 0 ? 'var(--secondary)' : 'var(--primary)', transition: 'width .6s var(--ease-emph)' } })), h('span.mono.small', { style: { width: '70px', textAlign: 'right' } }, `${x.ms.toFixed(1)} ms`)))),
      collapsible('netcheck-raw', pair('Raw report', '原始報告'), h('div.out', jsonTree(j)), { startCollapsed: true }));
  };
  return h('div.page', head(pair('Health', '健康'), t('diagnostics'), pair('Network check with DERP latency bars, pings, metrics, versions, bug reports, system policies and updates.', '網絡檢查、DERP 延遲、Ping、指標、版本、錯誤報告、系統政策同更新。'), h('button.btn', { on: { click: runNet } }, icon('speed'), pair('Run network check', '執行網絡檢查'))),
    h('section.card', h('h2', pair('Network check', '網絡檢查')), nc),
    ...['ping', 'netcheck', 'version', 'metrics-print', 'metrics-write', 'bugreport', 'syspolicy-list', 'syspolicy-reload', 'update', 'web', 'wait', 'licenses', 'completion', 'configure-kubeconfig', 'configure-systray', 'configure-synology', 'configure-mac-vpn-install', 'configure-mac-vpn-uninstall', 'configure-sysext-activate', 'configure-sysext-deactivate', 'configure-sysext-status', 'systray', 'nc', 'ssh', 'get'].map((id) => cmdBlock(id, { collapsed: true })));
});

// ---------------- Every command ----------------
registerPage('cli', (ctx) => {
  let [id, argVal] = (ctx.arg || '').split(':');
  if (id && findCommand(id)) {
    const c = findCommand(id);
    return h('div.page', h('div.row', h('button.btn.text', { on: { click: () => openDest('cli') } }, icon('arrow_back'), t('cli'))), commandForm(c, { preset: argVal ? { positionals: [argVal] } : undefined }));
  }
  const grid = h('div.stack');
  const search = regexField({ placeholder: pair('Search 73 commands and 197 flags', '搜尋 73 個指令同 197 個旗標'), id: 'cli-search', onChange: () => draw() });
  const draw = () => {
    clear(grid);
    const { q, re } = search.value();
    const test = (s) => { if (!q) return true; if (re) { try { return new RegExp(q, 'i').test(s); } catch { return true; } } return s.toLowerCase().includes(q.toLowerCase()); };
    const favs = store.get('favoritesCli');
    const groups = [['favourites', COMMANDS.filter((c) => favs.includes(c.id))], ...Object.keys(GROUPS).map((g) => [g, COMMANDS.filter((c) => c.group === g)])];
    for (const [g, cmds] of groups) {
      const ms = cmds.filter((c) => test(`${c.title} ${c.path.join(' ')} ${c.desc} ${(c.flags || []).map((f) => f.name + ' ' + f.desc).join(' ')} ${YUE_TITLES[c.id] || ''}`));
      if (!ms.length) continue;
      grid.append(h('h2', g === 'favourites' ? pair('Favourites', '收藏') : pair(GROUPS[g], YUE_GROUPS[g])),
        h('div.grid.stagger', ms.map((c, i) => h('button.cmd-tile.span-4', { style: { '--i': i }, dataset: { el: 'cli-' + c.id }, on: { click: () => openDest('cli', c.id), contextmenu: (e) => { e.preventDefault(); e.stopPropagation(); menu({ x: e.clientX, y: e.clientY }, [{ label: pair('Open', '開'), icon: 'open_in_full', run: () => openDest('cli', c.id) }, { label: pair('Open in a new tab', '喺新分頁開'), icon: 'tab', run: () => openInNewTab('cli', c.id) }]); } } },
          h('span.ico', icon(c.icon || 'terminal')), h('span', h('b', pair(c.title, YUE_TITLES[c.id])), h('code', 'tailscale ' + c.path.join(' ')), h('div.small.muted', c.desc), h('div.row', { style: { marginTop: '6px' } }, h('span.badge.info', `${(c.flags || []).length} flags`), c.danger ? h('span.badge.' + (c.danger === 'hard' ? 'err' : 'warn'), c.danger === 'hard' ? pair('destructive', '危險') : pair('changes state', '改狀態')) : null, c.platforms ? h('span.badge.info', c.platforms.join('/')) : null))))));
    }
    if (!grid.childNodes.length) grid.append(h('div.empty', icon('search_off'), pair('No command matches.', '冇指令符合。')));
  };
  draw();
  return h('div.page', head('tailscale', t('cli'), pair('Every Tailscale CLI command and every flag, each with its own rich control, live command preview and rendered output.', '每個 Tailscale 指令同每個旗標，各有專屬控制項、即時預覽同輸出。'), h('span.badge.info', `${COMMANDS.length} commands · ${COMMANDS.reduce((n, c) => n + (c.flags || []).length, 0)} flags`)), h('div.card.tonal', search.el), grid);
});

// ---------------- Raw console ----------------
registerPage('console', () => {
  const out = h('div.stack');
  const hist = JSON.parse(localStorage.getItem('mt.console.history') || '[]');
  const input = h('input.input', { placeholder: 'status --json', 'aria-label': pair('Arguments after tailscale', 'tailscale 後面嘅參數'), style: { fontFamily: 'var(--font-mono)' }, list: 'console-hist' });
  const dl = h('datalist#console-hist', hist.map((x) => h('option', { value: x })));
  const split = (s) => (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((x) => x.replace(/^["']|["']$/g, ''));
  const go = async () => {
    const argv = split(input.value);
    if (!argv.length) return;
    const nh = [input.value, ...hist.filter((x) => x !== input.value)].slice(0, 50); localStorage.setItem('mt.console.history', JSON.stringify(nh));
    const box = h('div.card');
    out.prepend(box);
    box.append(h('div.cmdline', 'tailscale ' + argv.join(' ')), h('div.skeleton', { style: { height: '40px' } }));
    try { const r = await window.mt.ts.raw(argv); const b = h('div.stack'); renderResult(b, r, { id: 'raw', title: 'tailscale' }); box.lastChild.replaceWith(b); } catch (e) { box.lastChild.replaceWith(h('div.err-text', e.message)); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return h('div.page', head(pair('Expert', '專家'), t('console'), pair('Type any tailscale arguments, including debug subcommands. Runs directly without a shell.', '直接打 tailscale 參數，包括 debug 子指令。唔經 shell 執行。')),
    h('div.card', h('div.row.nowrap', h('code', 'tailscale'), input, dl, h('button.btn', { on: { click: go } }, icon('play_arrow'), t('run'))),
      h('div.suggest', ['debug prefs', 'debug netmap', 'debug derp-map', 'debug daemon-goroutines', 'debug metrics', 'debug portmap', 'debug local-creds', 'debug component-logs', 'debug ts2021', 'status --json --peers=false'].map((s) => h('button.chip.choice', { on: { click: () => { input.value = s; input.focus(); } } }, s)))),
    out);
});
