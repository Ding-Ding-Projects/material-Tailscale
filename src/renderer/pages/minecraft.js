import { h, icon, clear, fmtBytes, uid } from '../core/dom.js';
import { pageHero } from '../ui/hero.js';
import { t, pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import { registerPage } from '../ui/shell.js';
import { toast, dialog, collapsible, confirmDialog } from '../ui/overlay.js';
import { superConfirm } from '../ui/safety.js';
import { segmented, stepper, switchCtl, text, secret, pathPick } from '../ui/controls.js';
import { regexField } from '../ui/regex.js';
import { withProgress, helpRequest } from '../ui/jobs.js';
import { infoBtn } from '../ui/command-form.js';
import { exportMenu } from '../ui/exporter.js';
import PROPS from '../../shared/mc-properties.js';

const FLAVORS = { java: [['vanilla', 'Vanilla'], ['paper', 'Paper'], ['purpur', 'Purpur'], ['folia', 'Folia'], ['fabric', 'Fabric'], ['forge', 'Forge']], bedrock: [['bedrock', 'Bedrock Dedicated Server']] };
const LOADER = { paper: 'paper', purpur: 'purpur', folia: 'folia', fabric: 'fabric', forge: 'forge', vanilla: null };
const TARGETS = [['local', pair('This computer', '本機'), 'computer'], ['docker', pair('Docker on this computer', '本機 Docker'), 'deployed_code'], ['ssh', pair('SSH host', 'SSH 主機'), 'terminal'], ['ssh-docker', pair('Docker on an SSH host', 'SSH 主機上嘅 Docker'), 'cloud']];
const logs = new Map();
window.mt?.mc?.onLog(({ id, line, stream }) => { const l = logs.get(id) || []; l.push({ line, stream, at: Date.now() }); if (l.length > 3000) l.shift(); logs.set(id, l); window.dispatchEvent(new CustomEvent('mc:log', { detail: { id, line, stream } })); });
window.mt?.mc?.onState((s) => window.dispatchEvent(new CustomEvent('mc:state', { detail: s })));

const head = pageHero;

function targetEditor(value = { kind: 'local' }) {
  let tgt = { ...value };
  const kind = segmented(TARGETS.map(([v, l, ic]) => ({ value: v, label: l, icon: ic })), tgt.kind, { label: pair('Where it runs', '喺邊度運行') });
  const host = text(tgt.host || '', { label: 'Host', mono: true, placeholder: 'server.example.com or a tailnet name' });
  const user = text(tgt.user || '', { label: 'User', mono: true, placeholder: 'minecraft' });
  const port = stepper(tgt.port || 22, { min: 1, max: 65535, label: 'SSH port' });
  const key = pathPick(tgt.keyPath || '', { mode: 'file', label: 'Private key' });
  const sshBox = h('div.stack', h('div.row', h('div.stack', { style: { flex: 1 } }, h('b', pair('Host', '主機')), host.el), h('div.stack', h('b', pair('User', '用戶')), user.el), h('div.stack', h('b', pair('Port', '埠')), port.el)), h('b', pair('Private key (optional; your SSH agent is used otherwise)', '私鑰（可選）')), key.el,
    h('p.small.muted', pair('Uses your system ssh with key authentication only (BatchMode). Passwords are never stored or typed for you.', '只用系統 ssh 同鎖匙認證，唔會儲存密碼。')));
  const probeOut = h('div.small');
  const probe = h('button.btn.small.outline', { type: 'button', on: { click: async () => { probeOut.textContent = pair('Checking…', '檢查緊…'); const r = await window.mt.mc.probe(get()).catch((e) => ({ ok: false, message: e.message })); probeOut.textContent = r.ok ? `✓ ${[r.platform, r.java, r.docker && 'Docker ' + r.docker].filter(Boolean).join(' · ')}` : `✕ ${r.message}`; probeOut.style.color = r.ok ? 'var(--secondary)' : 'var(--error)'; } } }, icon('network_check'), pair('Check target', '檢查目標'));
  const sync = () => { sshBox.hidden = !kind.get().startsWith('ssh'); };
  kind.onChange(sync); sync();
  const get = () => ({ kind: kind.get(), ...(kind.get().startsWith('ssh') ? { host: host.get(), user: user.get(), port: port.get(), keyPath: key.get() } : {}) });
  return { el: h('div.stack', kind.el, sshBox, h('div.row', probe, probeOut)), get };
}

function versionPicker(edition, flavor, onPick) {
  const box = h('div.stack');
  const list = h('div.picker-list', { role: 'listbox' });
  const meta = h('div.small.muted');
  let all = [], chan = 'release', picked = null;
  const search = regexField({ id: 'mc-version', placeholder: pair('Search versions', '搜尋版本'), onChange: () => draw() });
  const chans = segmented([{ value: 'release', label: pair('Releases', '正式版') }, { value: 'snapshot', label: pair('Snapshots', '快照') }, { value: 'pre-release', label: pair('Pre-releases', '預覽版') }, { value: 'old_beta', label: 'Beta' }, { value: 'old_alpha', label: 'Alpha' }, { value: 'preview', label: pair('Previews', '預覽') }, { value: 'all', label: t('all') }], chan, { label: 'Channel' });
  chans.onChange((v) => { chan = v; draw(); });
  const draw = () => {
    clear(list);
    const { q, re } = search.value();
    const test = (s) => !q || (re ? (() => { try { return new RegExp(q, 'i').test(s); } catch { return true; } })() : s.toLowerCase().includes(q.toLowerCase()));
    const ms = all.filter((v) => (chan === 'all' || v.type === chan || (chan === 'pre-release' && /pre|rc/i.test(v.id))) && test(v.id));
    for (const v of ms.slice(0, 400)) list.append(h('button.pick-row', { type: 'button', role: 'option', 'aria-checked': String(picked === v.id), on: { click: () => { picked = v.id; onPick(v); draw(); } } }, h('span.ava', icon('grass')), h('span.meta', h('b', v.id), h('span', [v.type, v.releaseTime ? new Date(v.releaseTime).toLocaleDateString() : null, v.platform].filter(Boolean).join(' · '))), h('span.radio-dot')));
    if (!ms.length) list.append(h('div.empty.small', pair('No version in this channel matches.', '呢個頻道冇符合嘅版本。')));
    if (ms.length > 400) list.append(h('div.small.muted', pair(`${ms.length - 400} more; narrow the search.`, `仲有 ${ms.length - 400} 個，請收窄搜尋。`)));
  };
  window.mt.mc.catalog(edition, flavor).then((c) => {
    all = c.versions;
    meta.textContent = pair(`${all.length} versions from ${c.source} · retrieved ${new Date(c.retrievedAt).toLocaleString()}${c.stale ? ' · OFFLINE: showing the last copy' : ''}${c.gap ? ' · ' + c.gap : ''}`, `${all.length} 個版本 · 更新於 ${new Date(c.retrievedAt).toLocaleString()}${c.stale ? ' · 離線' : ''}`);
    draw();
  }).catch((e) => { meta.textContent = pair(`The version catalogue is unavailable: ${e.message}`, `版本目錄用唔到：${e.message}`); });
  box.append(search.el, chans.el, meta, list);
  return box;
}

function createWizard(onDone) {
  const st = { edition: 'java', flavor: 'vanilla', version: null };
  const ed = segmented([{ value: 'java', label: 'Java Edition' }, { value: 'bedrock', label: 'Bedrock Edition' }], 'java', { label: 'Edition' });
  const flHolder = h('div'); const vHolder = h('div'); const res = h('div.small');
  const drawFlavor = () => { const f = segmented(FLAVORS[st.edition].map(([v, l]) => ({ value: v, label: l })), st.flavor, { label: 'Flavour' }); f.onChange((v) => { st.flavor = v; drawVersions(); }); clear(flHolder).append(f.el); };
  const drawVersions = () => { st.version = null; clear(res); clear(vHolder).append(versionPicker(st.edition, st.flavor, async (v) => { st.version = v.id; res.textContent = pair('Resolving the exact download…', '解析下載…'); const r = await window.mt.mc.resolve(st.edition, st.flavor, v.id).catch((e) => ({ error: e.message })); res.textContent = r.error ? `✕ ${r.error}` : r.unavailable ? `✕ ${r.reason}` : `✓ ${r.url.split('/').pop()} · ${r.digest ? `${r.digest.algo.toUpperCase()} ${r.digest.value.slice(0, 12)}…` : r.digestNote} · ${r.java ? `Java ${r.java}` : ''}${r.javaNote ? ' · ' + r.javaNote : ''}`; })); };
  ed.onChange((v) => { st.edition = v; st.flavor = FLAVORS[v][0][0]; drawFlavor(); drawVersions(); });
  drawFlavor(); drawVersions();
  const name = text('survival', { label: 'Name' });
  const port = stepper(25565, { min: 1, max: 65535, label: 'Port', chips: [{ value: 25565 }, { value: 25566 }, { value: 19132 }] });
  const mem = h('input.slider', { type: 'range', min: 512, max: 32768, step: 512, value: 2048, 'aria-label': pair('Memory', '記憶體') });
  const memOut = h('span.mono', '2048 MB');
  mem.addEventListener('input', () => { memOut.textContent = `${mem.value} MB`; mem.style.setProperty('--p', `${((mem.value - 512) / (32768 - 512)) * 100}%`); });
  const target = targetEditor();
  const steps = [
    { t: pair('Edition and flavour', '版本同類型'), el: h('div.stack', ed.el, flHolder) },
    { t: pair('Version', '版本號'), el: h('div.stack', vHolder, res) },
    { t: pair('Where it runs', '喺邊度運行'), el: target.el },
    { t: pair('Name, port and memory', '名、埠同記憶體'), el: h('div.stack', h('b', pair('Name', '名稱')), name.el, h('b', pair('Port', '埠')), port.el, h('b', pair('Memory', '記憶體')), h('div.row.nowrap', mem, memOut)) }
  ];
  let i = 0;
  const body = h('div.stack'); const title = h('h3'); const bar = h('div.sc-progress', h('i', { style: { background: 'var(--primary)' } }));
  const back = h('button.btn.outline', { type: 'button', on: { click: () => { i = Math.max(0, i - 1); draw(); } } }, icon('arrow_back'), t('back'));
  const next = h('button.btn', { type: 'button', on: { click: () => {
    if (i === 1 && !st.version) { toast(pair('Pick a version first.', '請先揀版本。'), { kind: 'warn' }); return; }
    if (i < steps.length - 1) { i++; draw(); return; }
    const spec = { name: name.get() || 'server', edition: st.edition, flavor: st.flavor, version: st.version, target: target.get(), port: port.get() || 25565, memoryMb: Number(mem.value) };
    d.close();
    withProgress(pair(`Create ${spec.name}`, `建立 ${spec.name}`), (job) => window.mt.mc.create(spec, job), { onDone: (r, b) => { if (r?.id) { b.append(h('p', pair(`Created ${r.name}${r.distribution?.verified ? ', download verified' : ''}.${r.warning ? ' ' + r.warning : ''}`, `已建立 ${r.name}。`))); onDone(r.id); } } });
  } } });
  const draw = () => { title.textContent = `${i + 1}/${steps.length} · ${steps[i].t}`; bar.firstChild.style.width = `${((i + 1) / steps.length) * 100}%`; clear(body).append(steps[i].el); back.disabled = !i; clear(next).append(i === steps.length - 1 ? pair('Create server', '建立伺服器') : t('next'), icon(i === steps.length - 1 ? 'check' : 'arrow_forward')); };
  const d = dialog({ title: pair('New Minecraft server', '新 Minecraft 伺服器'), wide: true, emojiChar: '🟩', body: h('div.stack', title, bar, body, h('div.row', back, h('span.spacer'), next)) });
  draw();
}

// ---------------- page ----------------
registerPage('minecraft', (ctx) => {
  const list = h('div.stack');
  const detail = h('div');
  let selected = ctx.arg || null;
  const load = async () => {
    const reg = await window.mt.mc.registry();
    clear(list);
    if (!reg.servers.length) list.append(h('div.empty', icon('grass'), pair('No servers yet. Create one, or discover and adopt an existing one.', '未有伺服器。建立一個，或者搵返現有嘅。')));
    for (const s of reg.servers) list.append(h('button.pick-row', { type: 'button', 'aria-checked': String(selected === s.id), dataset: { el: 'mc-server-' + s.id }, on: { click: () => { selected = s.id; load(); } } }, h('span.ava', icon({ local: 'computer', docker: 'deployed_code', ssh: 'terminal', 'ssh-docker': 'cloud' }[s.target.kind])), h('span.meta', h('b', s.name), h('span', `${s.edition} · ${s.flavor} ${s.version} · ${s.target.kind}${s.target.host ? ' ' + s.target.host : ''}`)), h('span.radio-dot')));
    clear(detail);
    if (selected && reg.servers.some((s) => s.id === selected)) detail.append(serverView(reg.servers.find((s) => s.id === selected), load));
  };
  load();
  return h('div.page', head(pair('Game servers', '遊戲伺服器'), t('minecraft'), pair('Create, adopt and run Java and Bedrock servers on this computer, in Docker, or over SSH. Every version from the official catalogues, flavours, plugins and mods, typed configuration, players, worlds, backups, schedules and a world generator.', '喺本機、Docker 或者 SSH 建立同運行 Java 同 Bedrock 伺服器。')),
    h('div.row', h('button.btn', { dataset: { el: 'mc-new' }, on: { click: () => createWizard((id) => { selected = id; load(); }) } }, icon('add'), pair('New server', '新伺服器')), h('button.btn.outline', { on: { click: () => discoverDialog(load) } }, icon('travel_explore'), pair('Discover and adopt', '搵同接管'))),
    h('div.grid', h('section.card.span-3.mc-list', h('h3', pair('Servers', '伺服器')), list), h('section.span-9', detail)));
});

function discoverDialog(reload) {
  const target = targetEditor();
  const out = h('div.stack');
  dialog({ title: pair('Discover servers', '搵伺服器'), wide: true, body: h('div.stack', h('p.small.muted', pair('Discovery only looks. Nothing is taken over until you choose Adopt for a specific item.', '只會睇，唔會接管，除非你揀咗接管。')), target.el, h('button.btn', { on: { click: async () => {
    clear(out).append(h('div.skeleton', { style: { height: '60px' } }));
    try {
      const items = await window.mt.mc.discover(target.get());
      clear(out);
      if (!items.length) out.append(h('div.empty.small', pair('Nothing found on this target.', '呢個目標搵唔到嘢。')));
      for (const it of items) out.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon(it.kind === 'container' ? 'deployed_code' : 'folder')), h('span.meta', h('b', it.name), h('span', [it.kind, it.image, it.state, it.ports].filter(Boolean).join(' · '))), it.managed ? h('span.badge.ok', pair('already managed', '已管理')) : h('button.btn.small', { on: { click: async () => { if (await confirmDialog(pair('Adopt this server?', '接管呢個伺服器？'), pair(`Material Tailscale will manage ${it.name}. It will not be changed until you act on it.`, `會開始管理 ${it.name}。`), { okLabel: pair('Adopt', '接管') })) { await window.mt.mc.adopt(target.get(), it); toast(pair('Adopted.', '已接管。'), { kind: 'ok' }); reload(); } } } }, pair('Adopt', '接管'))));
    } catch (e) { clear(out).append(h('div.err-text', e.message), helpRequest('Discovering Minecraft servers', e.message)); }
  } } }, icon('search'), pair('Discover', '搵')), out) });
}

function serverView(s, reload) {
  const tabs = ['overview', 'console', 'config', 'players', 'extensions', 'worlds', 'generator', 'schedule'];
  const labels = { overview: pair('Overview', '概覽'), console: pair('Console', '控制台'), config: pair('Configuration', '設定'), players: pair('Players', '玩家'), extensions: s.flavor === 'fabric' || s.flavor === 'forge' ? pair('Mods', '模組') : pair('Plugins', '插件'), worlds: pair('Worlds', '世界'), generator: pair('World generator', '世界生成器'), schedule: pair('Schedule', '排程') };
  let cur = 'overview';
  const holder = h('div');
  const seg = segmented(tabs.map((k) => ({ value: k, label: labels[k] })), cur, { label: 'Server section' });
  seg.onChange((v) => { cur = v; show(); });
  let curEl = null;
  const show = () => { curEl?.cleanup?.(); curEl = ({ overview, console: consoleView, config: configView, players: playersView, extensions: extensionsView, worlds: worldsView, generator: generatorView, schedule: scheduleView }[cur](s, reload)); clear(holder).append(curEl); };
  show();
  return h('div.stack', h('div.card', h('div.row', h('h2', { style: { flex: 1 } }, s.name), h('span.badge.info', `${s.edition} · ${s.flavor} ${s.version}`), h('span.badge.info', s.target.kind)), seg.el), holder);
}

function overview(s, reload) {
  const st = h('div.kpis');
  const eula = h('div');
  const refresh = async () => {
    const x = await window.mt.mc.status(s.id).catch((e) => ({ state: 'error', message: e.message }));
    clear(st).append(...[h('div.kpi', h('b', { running: '🟢 ' + pair('Running', '運行緊'), stopped: '⚪ ' + pair('Stopped', '停咗'), unreachable: '🟠 ' + pair('Host unreachable', '主機連唔到'), 'not created': '⚪ ' + pair('Not created yet', '未建立') }[x.state] || x.state), h('span', x.state === 'unreachable' ? pair('The connection is lost; the server may still be running.', '連線斷咗，伺服器可能仲運行緊。') : pair('state', '狀態'))),
      x.usage?.memoryBytes ? h('div.kpi', h('b', fmtBytes(x.usage.memoryBytes)), h('span', pair('memory', '記憶體'))) : null, x.usage?.memory ? h('div.kpi', h('b', x.usage.memory), h('span', 'Docker')) : null, x.usage?.cpu ? h('div.kpi', h('b', x.usage.cpu), h('span', 'CPU')) : null, x.pid ? h('div.kpi', h('b', String(x.pid)), h('span', 'PID')) : null].filter(Boolean));
  };
  const iv = setInterval(() => { if (!el.isConnected) { el.cleanup(); return; } refresh(); }, 5000); refresh();
  const off = (e) => { if (e.detail.id === s.id) refresh(); };
  window.addEventListener('mc:state', off);
  const act = (label, ic, fn, kind = '') => h(`button.btn${kind}`, { on: { click: async () => { try { const r = await fn(); if (r?.message) toast(r.message, { kind: 'warn' }); refresh(); } catch (e) { if (e.code === 'EULA') { toast(e.message, { kind: 'warn' }); return; } toast(e.message, { kind: 'err', actions: [{ label: pair('Copy a help request', '複製求助'), run: () => helpRequest(`${label} ${s.name}`, e.message).click() }] }); } } } }, icon(ic), label);
  if (!s.eulaAccepted && s.edition !== 'bedrock') {
    eula.append(h('div.card.tonal', { style: { borderColor: 'var(--tertiary)' } }, h('h3', pair('Minecraft End User License Agreement', 'Minecraft 最終用戶授權協議')), h('p', pair('Running a Minecraft server requires accepting Mojang\'s EULA. Read it, then accept it here if you agree. Material Tailscale never accepts it for you.', '運行伺服器要接受 Mojang 嘅 EULA。睇完同意先撳接受，本程式唔會代你接受。')),
      h('div.row', h('button.btn.outline', { on: { click: () => window.mt.shell.external('https://aka.ms/MinecraftEULA') } }, icon('open_in_new'), pair('Read the EULA', '睇 EULA')), h('button.btn', { on: { click: async () => { await window.mt.mc.acceptEula(s.id); toast(pair('EULA accepted for this server.', '已為呢個伺服器接受 EULA。'), { kind: 'ok' }); reload(); } } }, icon('gavel'), pair('I have read and accept the EULA', '我已閱讀並接受 EULA')))));
  }
  const restart = async () => { await window.mt.mc.stop(s.id); return window.mt.mc.start(s.id); };
  const el = h('div.stack', eula, h('section.card', st, h('div.row', act(pair('Start', '啟動'), 'play_arrow', () => window.mt.mc.start(s.id), '.green'), act(pair('Stop', '停止'), 'stop', () => window.mt.mc.stop(s.id), '.outline'), act(pair('Restart', '重啟'), 'restart_alt', restart, '.outline'),
    h('button.btn.danger', { on: { click: async () => { if (await superConfirm({ action: pair(`Force stop ${s.name}`, `強制停止 ${s.name}`), affects: pair('Unsaved world changes since the last save may be lost.', '上次儲存之後嘅改動可能會冇咗。') })) { await window.mt.mc.stop(s.id, { force: true }); refresh(); } } } }, icon('dangerous'), pair('Force stop', '強制停止')))),
    h('section.card', h('h3', pair('Distribution', '發行版')), h('div.out', JSON.stringify({ edition: s.edition, flavor: s.flavor, version: s.version, distribution: s.distribution, image: s.image, container: s.container, folder: s.dir, java: s.java, target: { ...s.target, keyPath: s.target.keyPath ? '(set)' : undefined }, created: s.created, adopted: s.adopted }, null, 2)),
      h('div.row', s.dir && s.target.kind === 'local' ? h('button.btn.small.outline', { on: { click: () => window.mt.shell.openPath(s.dir) } }, icon('folder_open'), pair('Open folder', '開資料夾')) : null,
        h('button.btn.small.danger', { on: { click: async () => { if (await superConfirm({ action: pair(`Remove ${s.name} from the manager`, `由管理器移除 ${s.name}`), affects: pair('The registry entry and its container. Files on disk are kept unless you delete them yourself.', '登記同容器；磁碟上嘅檔案會保留。') })) { await window.mt.mc.remove(s.id, {}); toast(pair('Removed.', '已移除。'), { kind: 'ok' }); reload(); } } } }, icon('delete'), pair('Remove from manager', '由管理器移除')))));
  el.cleanup = () => { clearInterval(iv); window.removeEventListener('mc:state', off); };
  return el;
}

// ---------------- console with a typed command builder ----------------
function consoleView(s) {
  const log = h('div.out', { style: { maxHeight: '420px' }, role: 'log', 'aria-live': 'polite' });
  const draw = () => { clear(log); const ls = (logs.get(s.id) || []).slice(-600); if (!ls.length) log.append(h('div.muted', pair('No output yet. Start the server to see its log here.', '未有輸出，啟動伺服器就會見到日誌。'))); for (const l of ls) log.append(h(l.stream === 'err' ? 'div.err' : 'div', l.line)); log.scrollTop = log.scrollHeight; };
  draw();
  const onLog = (e) => { if (!log.isConnected && log.dataset.mounted) { window.removeEventListener('mc:log', onLog); return; } log.dataset.mounted = '1'; if (e.detail.id === s.id) { log.querySelector('.muted')?.remove(); log.append(h(e.detail.stream === 'err' ? 'div.err' : 'div', e.detail.line)); if (log.childNodes.length > 800) log.firstChild.remove(); log.scrollTop = log.scrollHeight; } };
  window.addEventListener('mc:log', onLog);
  if (s.target.kind !== 'local') window.mt.mc.followLogs(s.id).catch(() => {});
  const builder = h('div.stack');
  const send = async (c) => { try { await window.mt.mc.command(s.id, c); } catch (e) { toast(e.message, { kind: 'err' }); } };
  window.mt.mc.extractWorldgen(s.id, uid('job')).then((p) => {
    if (!p?.commands) { builder.append(h('p.small.muted', pair('The typed command builder needs this version\'s command tree, read from a local copy of the server jar. It is unavailable for this server; the quick actions below still work.', '類型化指令建構器需要本機伺服器 jar 嘅指令樹，呢個伺服器用唔到。'))); return; }
    builder.append(commandBuilder(p.commands, send));
  }).catch(() => builder.append(h('p.small.muted', pair('Command tree unavailable.', '指令樹用唔到。'))));
  const quick = [['list', 'list'], ['save-all', 'save-all'], ['time set day', 'time set day'], ['weather clear', 'weather clear'], ['whitelist reload', 'whitelist reload'], ['tps', 'tps']];
  const el = h('div.stack', h('section.card', h('div.card-head', h('h3', pair('Live log', '即時日誌')), exportMenu(() => ({ name: `${s.id}-log`, data: (logs.get(s.id) || []).map((l) => l.line).join('\n'), text: (logs.get(s.id) || []).map((l) => l.line).join('\n') }))), log),
    h('section.card', h('h3', pair('Quick actions', '快捷動作')), h('div.suggest', quick.map(([l, c]) => h('button.chip.choice', { on: { click: () => send(c) } }, l)))),
    h('section.card', h('h3', pair('Command builder (typed from this version)', '指令建構器（按版本）')), builder));
  el.cleanup = () => window.removeEventListener('mc:log', onLog);
  return el;
}

/** Builds a command from the brigadier tree with one typed control per argument. */
function commandBuilder(tree, send) {
  const roots = Object.keys(tree.children || {}).sort();
  const sel = h('select.input', { 'aria-label': pair('Command', '指令') }, roots.map((r) => h('option', { value: r }, r)));
  const args = h('div.stack');
  const preview = h('div.cmdline');
  let parts = [];
  const controlFor = (name, node, idx) => {
    const p = node.parser;
    const setv = (v) => { parts[idx] = v; upd(); };
    if (p === 'brigadier:bool') { const c = switchCtl(false, { label: name }); c.onChange((v) => setv(String(v))); setv('false'); return c.el; }
    if (p === 'brigadier:integer') { const c = stepper(node.properties?.min ?? 0, { min: node.properties?.min ?? -2147483648, max: node.properties?.max ?? 2147483647, label: name }); c.onChange((v) => setv(String(v))); setv(String(node.properties?.min ?? 0)); return c.el; }
    if (p === 'brigadier:float' || p === 'brigadier:double') { const i2 = h('input.input', { type: 'number', step: 'any', 'aria-label': name, on: { input: (e) => setv(e.target.value) } }); return i2; }
    if (p === 'minecraft:block_pos' || p === 'minecraft:vec3' || p === 'minecraft:column_pos' || p === 'minecraft:vec2') { const n = p === 'minecraft:column_pos' || p === 'minecraft:vec2' ? 2 : 3; const v = Array(n).fill('~'); const row = h('div.row'); for (let k = 0; k < n; k++) row.append(h('input.input', { value: '~', style: { width: '90px' }, 'aria-label': `${name} ${'xyz'[k]}`, on: { input: (e) => { v[k] = e.target.value || '~'; setv(v.join(' ')); } } })); setv(v.join(' ')); return row; }
    const ENUMS = { 'minecraft:gamemode': ['survival', 'creative', 'adventure', 'spectator'], 'minecraft:difficulty': ['peaceful', 'easy', 'normal', 'hard'], 'minecraft:heightmap': ['world_surface', 'motion_blocking', 'motion_blocking_no_leaves', 'ocean_floor'], 'minecraft:entity_anchor': ['feet', 'eyes'], 'minecraft:swizzle': ['x', 'y', 'z', 'xy', 'xz', 'yz', 'xyz'], 'minecraft:color': ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray', 'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white', 'reset'], 'minecraft:operation': ['=', '+=', '-=', '*=', '/=', '%=', '<', '>', '><'] };
    if (ENUMS[p]) { const c = segmented(ENUMS[p].map((v) => ({ value: v, label: v })), ENUMS[p][0], { label: name }); c.onChange(setv); setv(ENUMS[p][0]); return c.el; }
    if (p === 'minecraft:time') { let n = 1, u = 'd'; const st = stepper(1, { min: 0, max: 2147483647, label: name }); const us = segmented([{ value: 'd', label: pair('days', '日') }, { value: 's', label: pair('seconds', '秒') }, { value: 't', label: pair('ticks', 'tick') }], 'd', { label: 'unit' }); const sync = () => setv(`${n}${u === 't' ? '' : u}`); st.onChange((v) => { n = v || 0; sync(); }); us.onChange((v) => { u = v; sync(); }); sync(); return h('div.row', st.el, us.el); }
    if (p === 'minecraft:game_profile' || p === 'minecraft:entity') { const i2 = h('input.input', { placeholder: pair('player name or @a, @p, @s', '玩家名或 @a、@p、@s'), list: 'mc-players', 'aria-label': name, on: { input: (e) => setv(e.target.value) } }); return h('div', i2, h('div.suggest', ['@a', '@p', '@s', '@r', '@e'].map((x) => h('button.chip.choice', { on: { click: () => { i2.value = x; setv(x); } } }, x)))); }
    const i2 = h('input.input', { placeholder: p || name, 'aria-label': name, style: { fontFamily: 'var(--font-mono)' }, on: { input: (e) => setv(e.target.value) } });
    return h('div', i2, h('div.small.muted', `${p || 'text'}${p && !/^brigadier:string$/.test(p) ? pair(' (typed as text: no dedicated control for this argument type yet)', '（暫時用文字）') : ''}`));
  };
  const walk = (node, depth, into) => {
    const kids = Object.entries(node.children || {});
    if (!kids.length || depth > 12) return;
    const lits = kids.filter(([, n]) => n.type === 'literal');
    const argsK = kids.filter(([, n]) => n.type === 'argument');
    const idx = depth;
    const holder = h('div.stack');
    if (lits.length) {
      const opts = [...(node.executable || argsK.length ? [['', node.executable ? pair('(end here)', '（喺度完）') : pair('(argument)', '（參數）')]] : []), ...lits.map(([k]) => [k, k])];
      const pick = (v) => { parts.length = idx; if (v) parts[idx] = v; clear(holder); if (v) walk(node.children[v], depth + 1, holder); else if (argsK.length) argStep(argsK[0], holder); upd(); };
      if (opts.length <= 6) { const seg = segmented(opts.map(([v, l]) => ({ value: v, label: l })), opts[0][0], { label: 'subcommand' }); seg.onChange(pick); into.append(h('div.flag-card', seg.el), holder); }
      else into.append(h('div.flag-card', h('select.input', { 'aria-label': 'subcommand', on: { change: (e) => pick(e.target.value) } }, opts.map(([v, l]) => h('option', { value: v }, l)))), holder);
      pick(opts[0][0]);
    } else if (argsK.length) argStep(argsK[0], into);
    function argStep([name, n], box) {
      box.append(h('div.flag-card', h('div.row', infoBtn(name, `${n.parser}${n.properties ? ' ' + JSON.stringify(n.properties) : ''}`), h('b', name)), controlFor(name, n, idx)));
      walk(n, depth + 1, box);
    }
  };
  const upd = () => { preview.textContent = [sel.value, ...parts.filter((x) => x !== undefined && x !== '')].join(' '); };
  const rebuild = () => { parts = []; clear(args); walk(tree.children[sel.value], 0, args); upd(); };
  sel.addEventListener('change', rebuild);
  rebuild();
  return h('div.stack', sel, args, preview, h('div.row', h('button.btn', { on: { click: () => send(preview.textContent) } }, icon('send'), pair('Send command', '傳送指令'))));
}

// ---------------- configuration ----------------
function configView(s) {
  const box = h('div.stack', h('div.skeleton', { style: { height: '200px' } }));
  const file = s.edition === 'bedrock' ? 'server.properties' : 'server.properties';
  (async () => {
    const textv = await window.mt.mc.readFile(s.id, file).catch(() => null);
    clear(box);
    if (!textv) { box.append(h('div.empty', icon('settings'), pair('server.properties does not exist yet. Start the server once (after accepting the EULA) and it will be generated with this version\'s defaults.', 'server.properties 未有。啟動一次伺服器就會生成。'))); return; }
    const lines = parse(textv);
    const values = Object.fromEntries(lines.filter((l) => l.key).map((l) => [l.key, l.value]));
    const changed = {};
    const grid = h('div.flags-grid');
    const search = regexField({ id: 'mc-config', placeholder: pair('Search settings', '搜尋設定'), onChange: () => drawGrid() });
    const drawGrid = () => {
      clear(grid);
      const { q, re } = search.value();
      let rx = null; if (q && re) { try { rx = new RegExp(q, 'i'); } catch { rx = null; } }
      for (const key of Object.keys(values)) {
        if (q && !(rx ? rx.test(key) : key.toLowerCase().includes(q.toLowerCase()))) continue;
        const d = PROPS.describe(s.edition, key);
        const ap = PROPS.applies(d, s.version);
        const v = changed[key] ?? values[key];
        let ctl;
        const set = (x) => { changed[key] = String(x); card.classList.add('changed'); };
        if (d?.type === 'bool') { ctl = switchCtl(v === 'true', { label: key }); ctl.onChange(set); }
        else if (d?.type === 'enum') { ctl = segmented(d.choices.map((c) => ({ value: c, label: c })), v, { label: key }); ctl.onChange(set); }
        else if (d?.type === 'int') { ctl = stepper(Number(v), { min: d.min, max: d.max, label: key }); ctl.onChange((x) => x !== '' && set(x)); }
        else if (d?.type === 'float') { const i2 = h('input.input', { type: 'number', step: 'any', min: d.min, max: d.max, value: v, 'aria-label': key, on: { input: (e) => set(e.target.value) } }); ctl = { el: i2 }; }
        else if (d?.secret) { ctl = secret(v, { label: key, allowFile: false }); ctl.onChange(set); }
        else { ctl = text(v, { label: key, mono: true }); ctl.onChange((x) => set(x ?? '')); }
        const card = h('div.flag-card', { dataset: { el: `mc-prop-${key}` } }, h('div.row.nowrap', infoBtn(key, d?.help || pair('No descriptor for this key yet. Its value is preserved exactly as written.', '呢個設定未有描述，值會原樣保留。')), h('b', { style: { flex: 1 } }, key), d ? h('span.badge.info', d.restart ? pair('restart', '要重啟') : pair('live', '即時')) : h('span.badge.warn', pair('no descriptor', '冇描述'))),
          ctl.el, h('div.small.muted', [d?.help, d?.unit ? `(${d.unit})` : null, d && d.def !== undefined ? `${pair('default', '預設')} ${d.def === '' ? pair('(empty)', '（空）') : d.def}` : null, !ap.ok ? `⚠ ${ap.reason}` : null].filter(Boolean).join(' · ')));
        grid.append(card);
      }
    };
    drawGrid();
    box.append(search.el, grid, h('div.row', h('button.btn', { on: { click: async () => {
      if (!Object.keys(changed).length) { toast(pair('Nothing changed.', '冇改動。')); return; }
      await window.mt.mc.writeFile(s.id, file, serialize(lines, changed));
      window.mt.history.record(`Minecraft ${s.name}: ${Object.keys(changed).join(', ')}`, { [`mc-${s.id}-server.properties`]: serialize(lines, changed).replace(/(rcon\.password|management-server-secret)=.*/g, '$1=(hidden)') }).catch(() => {});
      toast(pair(`Saved ${Object.keys(changed).length} setting(s). A backup copy was kept as server.properties.bak. Restart the server to apply restart-only settings.`, `已儲存 ${Object.keys(changed).length} 項，舊檔存做 .bak。`), { kind: 'ok' });
    } } }, icon('save'), pair('Save', '儲存'))));
  })();
  return box;
}
const parse = (text) => text.split(/\r?\n/).map((raw) => { const m = raw.match(/^([^#!][^=:]*?)\s*[=:]\s*(.*)$/); return m ? { key: m[1].trim(), value: m[2], raw } : { raw }; });
const serialize = (lines, values) => { const seen = new Set(); const out = lines.map((l) => { if (!l.key) return l.raw; seen.add(l.key); return l.key in values ? `${l.key}=${values[l.key]}` : l.raw; }); for (const [k, v] of Object.entries(values)) if (!seen.has(k)) out.push(`${k}=${v}`); return out.join('\n').replace(/\n*$/, '\n'); };

// ---------------- players ----------------
function playersView(s) {
  const files = s.edition === 'bedrock' ? [['allowlist.json', pair('Allowlist', '允許名單')], ['permissions.json', pair('Permissions', '權限')]] : [['ops.json', pair('Operators', '管理員')], ['whitelist.json', pair('Allowlist', '允許名單')], ['banned-players.json', pair('Banned players', '封鎖玩家')], ['banned-ips.json', pair('Banned IPs', '封鎖 IP')]];
  const box = h('div.stack');
  for (const [file, label] of files) {
    const sec = h('div.stack');
    const load = async () => {
      const raw = await window.mt.mc.readFile(s.id, file).catch(() => null);
      let rows = []; try { rows = JSON.parse(raw || '[]'); } catch { rows = []; }
      clear(sec);
      const tbl = h('table.tbl', h('thead', h('tr', ['name', 'uuid', file === 'ops.json' ? 'level' : file.startsWith('banned') ? 'reason' : file === 'permissions.json' ? 'permission' : '', ''].filter((x) => x !== undefined).map((c) => h('th', c)))), h('tbody', rows.map((r, i) => h('tr', h('td', r.name || r.ip || ''), h('td.mono.small', r.uuid || r.xuid || ''), h('td', file === 'ops.json' ? (() => { const st = stepper(r.level ?? 4, { min: 1, max: 4, label: 'level' }); st.onChange((v) => { rows[i].level = v; }); return st.el; })() : file === 'permissions.json' ? (() => { const sg = segmented(['visitor', 'member', 'operator'].map((v) => ({ value: v, label: v })), r.permission, { label: 'permission' }); sg.onChange((v) => { rows[i].permission = v; }); return sg.el; })() : r.reason || ''), h('td', h('button.icon-btn.sm', { 'aria-label': pair('Remove', '移除'), on: { click: () => { rows.splice(i, 1); save(rows); } } }, icon('delete')))))));
      const nameIn = h('input.input', { placeholder: file === 'banned-ips.json' ? '203.0.113.5' : pair('Player name', '玩家名'), 'aria-label': pair('Add entry', '加項目') });
      const add = h('button.btn.small', { on: { click: async () => {
        const n = nameIn.value.trim(); if (!n) return;
        if (file === 'banned-ips.json') rows.push({ ip: n, created: new Date().toISOString(), source: 'Material Tailscale', expires: 'forever', reason: 'Banned by an operator.' });
        else if (s.edition === 'bedrock') rows.push(file === 'permissions.json' ? { permission: 'member', xuid: n } : { name: n, ignoresPlayerLimit: false });
        else { const p = await window.mt.mc.lookupPlayer(n).catch(() => ({ found: false })); if (!p.found) { toast(pair(`No Java account named ${n}.`, `冇 ${n} 呢個 Java 帳戶。`), { kind: 'warn' }); return; } rows.push(file === 'ops.json' ? { uuid: p.uuid, name: p.name, level: 4, bypassesPlayerLimit: false } : file === 'banned-players.json' ? { uuid: p.uuid, name: p.name, created: new Date().toISOString(), source: 'Material Tailscale', expires: 'forever', reason: 'Banned by an operator.' } : { uuid: p.uuid, name: p.name }); }
        save(rows);
      } } }, icon('person_add'), pair('Add', '加'));
      sec.append(h('div.tbl-wrap', tbl), h('div.row.nowrap', nameIn, add, h('button.btn.small.outline', { on: { click: () => save(rows) } }, icon('save'), pair('Save changes', '儲存'))));
    };
    const save = async (rows) => { await window.mt.mc.writeFile(s.id, file, JSON.stringify(rows, null, 2)); if (s.edition !== 'bedrock') await window.mt.mc.command(s.id, file === 'whitelist.json' ? 'whitelist reload' : 'reload').catch(() => {}); toast(pair(`${file} saved.`, `已儲存 ${file}。`), { kind: 'ok' }); load(); };
    load();
    box.append(h('section.card', h('h3', label), sec));
  }
  return box;
}

// ---------------- plugins and mods ----------------
function extensionsView(s) {
  const loader = LOADER[s.flavor];
  const kind = ['fabric', 'forge'].includes(s.flavor) ? 'mod' : 'plugin';
  const installed = h('div.stack');
  const results = h('div.stack');
  const loadInstalled = async () => {
    const list = await window.mt.mc.listExtensions(s.id).catch(() => []);
    clear(installed);
    if (!list.length) installed.append(h('div.empty.small', pair('Nothing installed.', '未有安裝。')));
    for (const x of list) {
      const sw = switchCtl(x.enabled, { label: x.file });
      sw.onChange(async (on) => { await window.mt.mc.toggleExtension(s.id, x.folder, x.file, on); toast(on ? pair('Enabled. Restart to load it.', '已啟用，重啟生效。') : pair('Disabled. Restart to unload it.', '已停用，重啟生效。'), { kind: 'ok' }); loadInstalled(); });
      installed.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('extension')), h('span.meta', h('b', x.file.replace(/\.disabled$/, '')), h('span', `${x.folder}${x.bytes ? ' · ' + fmtBytes(x.bytes) : ''}`)), sw.el,
        h('button.icon-btn.sm', { 'aria-label': pair('Remove', '移除'), on: { click: async () => { if (await superConfirm({ action: pair(`Remove ${x.file}`, `移除 ${x.file}`), affects: pair('The file is moved to .removed in the server folder, so it can be restored.', '檔案會移去 .removed，可以還原。') })) { await window.mt.mc.removeExtension(s.id, x.folder, x.file); loadInstalled(); } } } }, icon('delete'))));
    }
  };
  if (!loader) return h('div.card', h('p', pair('Vanilla servers do not load plugins or mods. Create a Paper, Purpur, Fabric or Forge server to add them.', 'Vanilla 伺服器唔支援插件或模組。')));
  const search = regexField({ id: 'mc-ext', placeholder: pair(`Search Modrinth for ${kind}s`, `喺 Modrinth 搜尋${kind === 'mod' ? '模組' : '插件'}`), onChange: () => {} });
  const go = async () => {
    clear(results).append(h('div.skeleton', { style: { height: '80px' } }));
    try {
      const r = await window.mt.mc.searchExtensions({ query: search.value().q, version: s.version, loader, kind });
      clear(results);
      if (!r.hits.length) results.append(h('div.empty.small', pair('No compatible project found for this version and loader.', '冇搵到兼容嘅項目。')));
      for (const p of r.hits) results.append(h('div.pick-row', { style: { cursor: 'default' } }, p.icon_url ? h('img', { src: p.icon_url, alt: '', style: { width: '36px', height: '36px', borderRadius: '10px' } }) : h('span.ava', icon('extension')),
        h('span.meta', h('b', p.title), h('span', `${p.author} · ${p.downloads.toLocaleString()} downloads · ${p.license || 'licence not stated'}`), h('span', p.description)),
        h('button.btn.small', { on: { click: () => withProgress(pair(`Install ${p.title}`, `安裝 ${p.title}`), (job) => window.mt.mc.installExtension(s.id, p.project_id, { version: s.version, loader }, job), { onDone: (res, b) => { if (res?.file) { b.append(h('p', pair(`Installed ${res.file} (${res.version}); SHA-512 verified. Licence: ${p.license || 'not stated'}.${res.requiredDependencies.length ? ` It needs ${res.requiredDependencies.length} more project(s); install them too.` : ''} Restart to load it.`, `已安裝 ${res.file}，SHA-512 已驗證。`))); loadInstalled(); } } }) } }, icon('download'), pair('Install', '安裝'))));
    } catch (e) { clear(results).append(h('div.err-text', e.message)); }
  };
  loadInstalled();
  return h('div.stack', h('section.card', h('h3', pair('Installed', '已安裝')), installed), h('section.card', h('h3', pair('Add from Modrinth', '由 Modrinth 加')), h('div.row.nowrap', search.el, h('button.btn', { on: { click: go } }, icon('search'), t('search'))), h('p.small.muted', pair(`Only releases marked compatible with ${s.version} and ${loader} are offered. Files are checked against Modrinth's SHA-512 before they are kept.`, `只會顯示兼容 ${s.version} 同 ${loader} 嘅版本，會驗證 SHA-512。`)), results));
}

// ---------------- worlds and backups ----------------
function worldsView(s) {
  const list = h('div.stack');
  const load = async () => {
    const b = await window.mt.mc.listBackups(s.id).catch(() => []);
    clear(list);
    if (!b.length) list.append(h('div.empty.small', pair('No backups yet.', '未有備份。')));
    for (const x of b) list.append(h('div.pick-row', { style: { cursor: 'default' } }, h('span.ava', icon('inventory_2')), h('span.meta', h('b', x.file), h('span', [x.bytes ? fmtBytes(x.bytes) : null, x.at ? new Date(x.at).toLocaleString() : null].filter(Boolean).join(' · '))),
      h('button.btn.small.outline', { on: { click: async () => { if (await superConfirm({ action: pair(`Restore ${x.file}`, `還原 ${x.file}`), affects: pair('The current world and settings are replaced. A safety backup of the current state is made first.', '目前嘅世界同設定會被取代，會先備份。') })) withProgress(pair('Restore backup', '還原備份'), (job) => window.mt.mc.restore(s.id, x.file, job), { onDone: () => load() }); } } }, icon('restore'), pair('Restore', '還原'))));
  };
  load();
  return h('div.stack', h('section.card', h('div.row', h('h3', { style: { flex: 1 } }, pair('Backups', '備份')), h('button.btn', { on: { click: () => withProgress(pair('Back up now', '即刻備份'), (job) => window.mt.mc.backup(s.id, job), { onDone: () => load() }) } }, icon('backup'), pair('Back up now', '即刻備份'))), h('p.small.muted', pair('Running servers are paused for saving (save-off, save-all flush) during the backup and resumed after.', '備份期間會暫停儲存，之後恢復。')), list),
    h('section.card.tonal', h('h3', pair('Import and export a world', '匯入同匯出世界')), h('div.row',
      h('button.btn.outline', { on: { click: async () => { const f = await window.mt.dialog.open({ filters: [{ name: 'World archive', extensions: ['zip', '7z', 'tar', 'gz'] }] }); if (!f || s.target.kind !== 'local') { if (f) toast(pair('Importing is available for local servers.', '只限本機伺服器匯入。'), { kind: 'info' }); return; } if (await superConfirm({ action: pair('Import a world into this server', '匯入世界'), affects: pair('Files with the same names in the server folder are overwritten. Back up first.', '同名檔案會被覆蓋，請先備份。') })) withProgress(pair('Import world', '匯入世界'), (job) => window.mt.tools.archiveExtract({ file: f[0], dest: s.dir }, job)); } } }, icon('upload'), pair('Import world archive', '匯入世界壓縮檔')),
      h('button.btn.outline', { on: { click: async () => { if (s.target.kind !== 'local') { toast(pair('Exporting is available for local servers; use backups for remote ones.', '遠端伺服器請用備份。'), { kind: 'info' }); return; } const d = await window.mt.dialog.save({ defaultPath: `${s.name}-world.zip` }); if (d) withProgress(pair('Export world', '匯出世界'), (job) => window.mt.tools.archiveCreate({ files: [`${s.dir}/world`, `${s.dir}/world_nether`, `${s.dir}/world_the_end`, `${s.dir}/worlds`].filter(Boolean), dest: d, format: 'zip' }, job)); } } }, icon('download'), pair('Export world as ZIP', '匯出世界 ZIP')))));
}

// ---------------- schedule ----------------
function scheduleView(s) {
  const all = store.get('mcSchedules') || {};
  const mine = all[s.id] || [];
  const box = h('div.stack');
  const draw = () => {
    clear(box);
    box.append(h('p.small.muted', pair(`Runs while Material Tailscale is open, in your local time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). A run missed while the app was closed is skipped and noted in the log, never run late.`, '程式開住先會運行，用本地時區。錯過咗唔會補做。')));
    mine.forEach((r, i) => {
      const act = segmented([{ value: 'restart', label: pair('Restart', '重啟') }, { value: 'backup', label: pair('Backup', '備份') }, { value: 'command', label: pair('Command', '指令') }], r.action, { label: 'Action' });
      act.onChange((v) => { mine[i].action = v; save(); });
      const tm = h('input.input', { type: 'time', value: r.time, style: { maxWidth: '150px' }, 'aria-label': 'Time', on: { change: (e) => { mine[i].time = e.target.value; save(); } } });
      const cmdIn = h('input.input', { value: r.command || '', placeholder: 'say Restarting in 5 minutes', hidden: r.action !== 'command', 'aria-label': 'Command', on: { change: (e) => { mine[i].command = e.target.value; save(); } } });
      const days = h('div.row', ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dn, di) => h('button.chip.choice', { 'aria-pressed': String(r.days.includes(di)), on: { click: () => { const ds = new Set(r.days); ds.has(di) ? ds.delete(di) : ds.add(di); mine[i].days = [...ds].sort(); save(); } } }, dn)));
      box.append(h('div.card.tonal', h('div.row', act.el, tm, h('button.icon-btn.sm', { 'aria-label': pair('Remove', '移除'), on: { click: () => { mine.splice(i, 1); save(); } } }, icon('delete'))), days, cmdIn, h('div.small.muted', r.last ? pair(`Last run ${new Date(r.last).toLocaleString()}: ${r.lastResult}`, `上次 ${new Date(r.last).toLocaleString()}：${r.lastResult}`) : pair('Not run yet.', '未運行過。'))));
    });
    box.append(h('div.row', h('button.btn.small', { on: { click: () => { mine.push({ action: 'backup', time: '04:00', days: [0, 1, 2, 3, 4, 5, 6] }); save(); } } }, icon('add'), pair('Add schedule', '加排程'))));
  };
  const save = () => { store.set('mcSchedules', { ...(store.get('mcSchedules') || {}), [s.id]: mine }); draw(); };
  draw();
  return box;
}

/** Called every 30 seconds by the app to run due schedules. */
export async function runMcSchedules() {
  const all = store.get('mcSchedules') || {};
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let changed = false;
  for (const [id, rules] of Object.entries(all)) for (const r of rules) {
    if (r.time !== hm || !r.days.includes(now.getDay()) || (r.last && Date.now() - r.last < 90000)) continue;
    r.last = Date.now(); changed = true;
    try {
      if (r.action === 'backup') await window.mt.mc.backup(id, uid('job'));
      else if (r.action === 'restart') { await window.mt.mc.stop(id); await window.mt.mc.start(id); }
      else if (r.command) await window.mt.mc.command(id, r.command);
      r.lastResult = 'done';
    } catch (e) { r.lastResult = e.message; toast(pair(`Scheduled ${r.action} failed: ${e.message}`, `排程 ${r.action} 失敗：${e.message}`), { kind: 'err' }); }
  }
  if (changed) store.set('mcSchedules', { ...all }, { record: false });
}

// ---------------- world generator ----------------
function generatorView(s) {
  const box = h('div.stack', h('div.skeleton', { style: { height: '160px' } }));
  if (s.edition === 'bedrock') return h('div.card', h('p', pair('Bedrock has no machine-readable world generator route, so the generator is unavailable for Bedrock servers.', 'Bedrock 冇世界生成器途徑。')));
  window.mt.mc.extractWorldgen(s.id, uid('job')).then((p) => { clear(box); if (p.unavailable) { box.append(h('div.card', h('p', p.reason))); return; } box.append(generatorUi(s, p)); }).catch((e) => { clear(box).append(h('div.err-text', e.message), helpRequest('Reading the world generator data', e.message)); });
  return box;
}

function generatorUi(s, p) {
  const st = { w: 100, d: 100, cx: 0, cz: 0, preset: p.worldPresets.map((x) => x.split(':')[1]).includes('normal') ? 'normal' : p.worldPresets[0]?.split(':')[1], output: 'folder', dest: '', rules: {} };
  // ---- size canvas ----
  const cv = h('canvas', { width: 1000, height: 420, tabindex: '0', role: 'application', 'aria-label': pair('Generation area on a chunk grid. Arrow keys move it, Shift with arrows resizes it.', '區塊網格上嘅生成範圍。箭咀移動，Shift 加箭咀改大細。'), style: { width: '100%', borderRadius: '16px', background: 'var(--surface-2)', cursor: 'move', touchAction: 'none' } });
  const g = cv.getContext('2d');
  const W = stepper(st.w, { min: 1, max: 4000, label: pair('Width in chunks', '闊（區塊）') }), D = stepper(st.d, { min: 1, max: 4000, label: pair('Depth in chunks', '深（區塊）') });
  const est = h('div.small');
  const scale = () => Math.min(cv.width / Math.max(st.w * 2.2, 60), cv.height / Math.max(st.d * 2.2, 60));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const drawCv = () => {
    const k = scale(); g.clearRect(0, 0, cv.width, cv.height);
    g.strokeStyle = css('--outline-soft'); g.lineWidth = 1;
    const step = Math.max(k, 4) * Math.ceil(4 / Math.max(k, 0.0001));
    for (let x = (cv.width / 2) % step; x < cv.width; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
    for (let y = (cv.height / 2) % step; y < cv.height; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }
    const rx = cv.width / 2 + (st.cx - st.w / 2) * k, ry = cv.height / 2 + (st.cz - st.d / 2) * k;
    g.fillStyle = css('--secondary') + '33'; g.strokeStyle = css('--secondary'); g.lineWidth = 2;
    g.fillRect(rx, ry, st.w * k, st.d * k); g.strokeRect(rx, ry, st.w * k, st.d * k);
    g.fillStyle = css('--secondary'); g.beginPath(); g.arc(rx + st.w * k, ry + st.d * k, 7, 0, 7); g.fill();
    g.fillStyle = css('--tertiary'); g.beginPath(); g.arc(cv.width / 2, cv.height / 2, 5, 0, 7); g.fill();
    const batches = Math.ceil(st.w / 16) * Math.ceil(st.d / 16);
    est.textContent = pair(`${st.w} × ${st.d} chunks (${st.w * 16} × ${st.d * 16} blocks), centred on chunk ${st.cx}, ${st.cz} · ${st.w * st.d} chunks in ${batches} forceload batches of at most 16 × 16 · roughly ${Math.max(1, Math.round((st.w * st.d) / 400))} to ${Math.max(2, Math.round((st.w * st.d) / 150))} minutes and ${Math.round((st.w * st.d * 9) / 1024)} MB on disk`, `${st.w} × ${st.d} 區塊 · ${batches} 批`);
  };
  const syncSteppers = () => { W.set(st.w); D.set(st.d); drawCv(); };
  W.onChange((v) => { if (v) { st.w = v; drawCv(); } }); D.onChange((v) => { if (v) { st.d = v; drawCv(); } });
  let drag = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
  cv.addEventListener('pointerdown', (e) => { const [x, y] = pos(e); const k = scale(); const cx = cv.width / 2 + (st.cx + st.w / 2) * k, cy = cv.height / 2 + (st.cz + st.d / 2) * k; drag = Math.hypot(x - cx, y - cy) < 14 ? { mode: 'resize' } : { mode: 'move', ox: x, oy: y, cx: st.cx, cz: st.cz }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pos(e); const k = scale(); if (drag.mode === 'move') { st.cx = Math.round(drag.cx + (x - drag.ox) / k); st.cz = Math.round(drag.cz + (y - drag.oy) / k); } else { st.w = Math.max(1, Math.round(((x - cv.width / 2) / k - st.cx) * 2)); st.d = Math.max(1, Math.round(((y - cv.height / 2) / k - st.cz) * 2)); } syncSteppers(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('keydown', (e) => { const dx = { ArrowLeft: -1, ArrowRight: 1 }[e.key] || 0, dz = { ArrowUp: -1, ArrowDown: 1 }[e.key] || 0; if (!dx && !dz) return; e.preventDefault(); const n = e.altKey ? 16 : 1; if (e.shiftKey) { st.w = Math.max(1, st.w + dx * n); st.d = Math.max(1, st.d + dz * n); } else { st.cx += dx * n; st.cz += dz * n; } syncSteppers(); });
  setTimeout(drawCv, 0);
  // ---- world ----
  const seed = text(String(BigInt.asIntN(64, BigInt(Math.floor(Math.random() * 2 ** 53)) * 1009n)), { label: 'Seed', mono: true });
  const presetSeg = segmented(p.worldPresets.map((x) => ({ value: x.split(':')[1], label: x.split(':')[1] })), st.preset, { label: pair('World preset', '世界預設') });
  const presetPanes = h('div');
  const diff = segmented(['peaceful', 'easy', 'normal', 'hard'].map((v) => ({ value: v, label: v })), 'normal', { label: 'Difficulty' });
  const mode = segmented(['survival', 'creative', 'adventure', 'spectator'].map((v) => ({ value: v, label: v })), 'survival', { label: 'Game mode' });
  const hard = switchCtl(false, { label: 'Hardcore' }), structs = switchCtl(true, { label: 'Generate structures' }), border = switchCtl(true, { label: 'World border follows the area' });
  // flat editor
  const flat = { biome: 'minecraft:plains', features: false, lakes: false, layers: [{ block: 'minecraft:bedrock', height: 1 }, { block: 'minecraft:dirt', height: 2 }, { block: 'minecraft:grass_block', height: 1 }], structures: [] };
  const blockList = h('datalist#mc-blocks', p.blocks.map((b) => h('option', { value: b })));
  const biomeList = h('datalist#mc-biomes', p.biomes.map((b) => h('option', { value: b })));
  const flatBox = h('div.stack');
  const drawFlat = () => {
    clear(flatBox);
    flatBox.append(h('div.suggest', Object.keys(p.flatPresetData || {}).map((id) => h('button.chip.choice', { on: { click: () => { const d = p.flatPresetData[id].settings; flat.layers = d.layers.map((l) => ({ ...l })); flat.biome = d.biome; flat.features = !!d.features; flat.lakes = !!d.lakes; drawFlat(); } } }, id.split(':')[1]))));
    flatBox.append(h('b', pair('Layers, bottom to top', '圖層，由下至上')));
    flat.layers.forEach((l, i) => {
      const blk = h('input.input', { value: l.block, list: 'mc-blocks', 'aria-label': `Layer ${i + 1} block`, style: { fontFamily: 'var(--font-mono)' }, on: { change: (e) => { if (!p.blocks.includes(e.target.value)) { e.target.classList.add('invalid'); toast(pair('That block is not in this version\'s block registry.', '呢個版本冇呢種方塊。'), { kind: 'warn' }); return; } e.target.classList.remove('invalid'); flat.layers[i].block = e.target.value; } } });
      const ht = stepper(l.height, { min: 1, max: 4064, label: `Layer ${i + 1} height` }); ht.onChange((v) => { if (v) flat.layers[i].height = v; });
      flatBox.append(h('div.row.nowrap', h('span.mono.small', `#${i + 1}`), blk, ht.el, h('button.icon-btn.sm', { 'aria-label': 'Move up', on: { click: () => { if (i < flat.layers.length - 1) { [flat.layers[i], flat.layers[i + 1]] = [flat.layers[i + 1], flat.layers[i]]; drawFlat(); } } } }, icon('arrow_upward')), h('button.icon-btn.sm', { 'aria-label': 'Move down', on: { click: () => { if (i > 0) { [flat.layers[i], flat.layers[i - 1]] = [flat.layers[i - 1], flat.layers[i]]; drawFlat(); } } } }, icon('arrow_downward')), h('button.icon-btn.sm', { 'aria-label': 'Remove layer', on: { click: () => { flat.layers.splice(i, 1); drawFlat(); } } }, icon('delete'))));
    });
    flatBox.append(h('button.btn.small.outline', { on: { click: () => { flat.layers.push({ block: 'minecraft:stone', height: 1 }); drawFlat(); } } }, icon('add'), pair('Add layer', '加圖層')));
    const bi = h('input.input', { value: flat.biome, list: 'mc-biomes', 'aria-label': 'Flat biome', on: { change: (e) => { flat.biome = e.target.value; } } });
    const fe = switchCtl(flat.features, { label: 'Features' }); fe.onChange((v) => { flat.features = v; });
    const la = switchCtl(flat.lakes, { label: 'Lakes' }); la.onChange((v) => { flat.lakes = v; });
    flatBox.append(h('b', pair('Biome', '生態域')), bi, h('div.switch-row', h('div.txt', h('b', pair('Decorations and features', '裝飾同特徵'))), fe.el), h('div.switch-row', h('div.txt', h('b', pair('Lakes', '湖'))), la.el),
      h('b', pair('Structure sets', '結構集')), h('div.suggest', p.structureSets.map((ss) => { const b = h('button.chip.choice', { 'aria-pressed': String(flat.structures.includes(ss)), on: { click: () => { const k = flat.structures.indexOf(ss); k >= 0 ? flat.structures.splice(k, 1) : flat.structures.push(ss); b.setAttribute('aria-pressed', String(flat.structures.includes(ss))); } } }, ss.split(':')[1]); return b; })));
  };
  let singleBiome = 'minecraft:plains'; let noise = 'minecraft:overworld';
  const showPreset = () => {
    clear(presetPanes);
    if (st.preset === 'flat') { drawFlat(); presetPanes.append(flatBox); }
    else if (st.preset === 'single_biome_surface') presetPanes.append(h('b', pair('Biome', '生態域')), h('input.input', { value: singleBiome, list: 'mc-biomes', 'aria-label': 'Single biome', on: { change: (e) => { singleBiome = e.target.value; } } }));
    else if (['normal'].includes(st.preset)) presetPanes.append(h('b', pair('Noise settings', '噪聲設定')), segmented(p.noiseSettings.map((n) => ({ value: n, label: n.split(':')[1] })), noise, { label: 'Noise settings' }).el);
    else presetPanes.append(h('p.small.muted', pair('This preset is used exactly as the version defines it.', '呢個預設按版本定義使用。')));
  };
  presetSeg.onChange((v) => { st.preset = v; showPreset(); });
  showPreset();
  // game rules typed from commands.json
  const rulesGrid = h('div.flags-grid');
  for (const r of p.gameRules) {
    let ctl;
    if (r.type === 'brigadier:bool') { ctl = switchCtl(undefined, { label: r.name, triState: true }); ctl.onChange((v) => { if (v === undefined) delete st.rules[r.name]; else st.rules[r.name] = String(v); }); }
    else if (r.type === 'brigadier:integer') { ctl = stepper('', { min: -2147483648, max: 2147483647, label: r.name, allowEmpty: true }); ctl.onChange((v) => { if (v === '' || v === undefined) delete st.rules[r.name]; else st.rules[r.name] = String(v); }); }
    else ctl = { el: h('span.badge.warn', pair(`Unsupported value type ${r.type}`, `未支援 ${r.type}`)) };
    rulesGrid.append(h('div.flag-card', h('code.small', r.name), ctl.el));
  }
  // output
  const outSeg = segmented([{ value: 'folder', label: pair('Folder', '資料夾'), icon: 'folder' }, { value: 'zip', label: 'ZIP', icon: 'folder_zip' }], 'folder', { label: pair('Output', '輸出') });
  const destShow = h('span.mono.small', { style: { flex: 1 } }, pair('No destination chosen', '未揀目的地'));
  outSeg.onChange((v) => { st.output = v; st.dest = ''; destShow.textContent = pair('No destination chosen', '未揀目的地'); });
  const browse = h('button.btn.small.tonal', { dataset: { el: 'mc-gen-browse' }, on: { click: async () => { const d = await window.mt.dialog.save({ defaultPath: `${s.name}-world${st.output === 'zip' ? '.zip' : ''}`, filters: st.output === 'zip' ? [{ name: 'ZIP', extensions: ['zip'] }] : undefined }); if (d) { st.dest = d; destShow.textContent = d; } } } }, icon('folder_open'), pair('Browse…', '瀏覽…'));
  const eula = switchCtl(false, { label: 'EULA' });
  const go = h('button.btn.big.green', { dataset: { el: 'mc-gen-go' }, on: { click: () => {
    if (!st.dest) { toast(pair('Choose where to write the world first.', '先揀世界寫去邊度。'), { kind: 'warn' }); return; }
    if (!eula.get()) { toast(pair('Accept the Minecraft EULA to run the generator.', '要接受 Minecraft EULA 先可以生成。'), { kind: 'warn' }); return; }
    const opts = { eulaAccepted: true, dest: st.dest, output: st.output, seed: seed.get(), preset: st.preset, flat, singleBiome, noiseSettings: noise, difficulty: diff.get(), gamemode: mode.get(), hardcore: hard.get(), structures: structs.get(), borderFollows: border.get(), gameRules: st.rules, area: { cx: st.cx, cz: st.cz, w: st.w, d: st.d } };
    let jobRef;
    const prog = withProgress(pair('Generate world', '生成世界'), (job) => { jobRef = job; return window.mt.mc.generateWorld(s.id, opts, job); }, { onDone: (r, b) => { if (r?.verified) b.append(h('p', pair(`Wrote ${r.files} files (${r.chunks} chunks in ${r.batches} batches) to ${r.dest}; every file verified against its digest.`, `已寫入 ${r.files} 個檔案，全部已驗證。`)), h('button.btn.small.outline', { on: { click: () => window.mt.shell.showItem(r.dest) } }, icon('folder_open'), pair('Show', '顯示'))); } });
    prog.dialog.el.append(h('button.btn.small.outline', { on: { click: () => { window.mt.mc.cancelGenerate(jobRef); toast(pair('Cancelling after the current batch…', '做完呢批就取消…')); } } }, icon('cancel'), pair('Cancel between batches', '分批之間取消')));
  } } }, icon('public'), pair('Generate world', '生成世界'));
  return h('div.stack', blockList, biomeList,
    h('section.card', h('div.card-head', h('h3', pair('Size of world to generate', '生成世界大小')), infoBtn(pair('Generation area', '生成範圍'), pair('Drag the rectangle to move it, drag the corner dot to resize, or use the arrow keys (Shift resizes, Alt moves in 16-chunk steps). The default is 100 × 100 chunks.', '拖動長方形移動，拖角落改大細，或者用箭咀。預設 100 × 100 區塊。'))), cv, h('div.row', h('b', pair('Width', '闊')), W.el, h('b', pair('Depth', '深')), D.el, h('span.small.muted', pair('chunks', '區塊'))), est),
    h('section.card', h('h3', pair('World', '世界')), h('b', pair('Seed', '種子')), h('div.row.nowrap', seed.el, h('button.btn.small.outline', { on: { click: () => seed.set(String(BigInt.asIntN(64, BigInt(Math.floor(Math.random() * 2 ** 53)) * 1009n))) } }, icon('casino'), pair('Random', '隨機'))), h('b', pair(`World preset (${p.worldPresets.length} from ${p.version}'s jar)`, `世界預設（${p.worldPresets.length} 個）`)), presetSeg.el, presetPanes,
      h('b', pair('Difficulty', '難度')), diff.el, h('b', pair('Game mode', '遊戲模式')), mode.el, h('div.switch-row', h('div.txt', h('b', 'Hardcore')), hard.el), h('div.switch-row', h('div.txt', h('b', pair('Generate structures', '生成結構'))), structs.el), h('div.switch-row', h('div.txt', h('b', pair('World border follows the area', '世界邊界跟範圍'))), border.el)),
    collapsible(`mc-gen-rules-${s.id}`, pair(`Game rules (${p.gameRules.length}, typed from this version)`, `遊戲規則（${p.gameRules.length} 條）`), h('div.card', h('p.small.muted', pair('Rules left as they are keep the version\'s defaults.', '唔改嘅規則用版本預設。')), rulesGrid), { startCollapsed: true }),
    h('section.card.tonal', h('h3', pair('Output', '輸出')), outSeg.el, h('div.row.nowrap', destShow, browse), h('p.small.muted', pair('Never overwrites. A ZIP is written to a temporary file and renamed only after it is checked; a folder copy is verified file by file against SHA-256 digests.', '唔會覆蓋，寫完會驗證。')),
      h('div.switch-row', h('div.txt', h('b', pair('I have read and accept the Minecraft EULA', '我已閱讀並接受 Minecraft EULA')), h('a', { href: '#', on: { click: (e) => { e.preventDefault(); window.mt.shell.external('https://aka.ms/MinecraftEULA'); } } }, pair('Read the EULA', '睇 EULA'))), eula.el), h('div.row', go)),
    h('div.small.muted', pair(`Pickers were extracted from ${p.version}'s server jar (SHA-1 ${String(p.jarSha1).slice(0, 12)}…) on ${new Date(p.extractedAt).toLocaleString()}: ${p.biomes.length} biomes, ${p.blocks.length} blocks, ${p.structureSets.length} structure sets, data pack format ${p.dataPackFormat}.`, `選項由 ${p.version} jar 提取。`)));
}
