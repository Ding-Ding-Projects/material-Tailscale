// Models section: the runtime with its troubleshooter, this computer's facts for the fit check,
// and the installed models with details, chat, load and unload, copy and delete.
import { h, icon, clear, fmtBytes, fmtAgo, append } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import { toast, dialog, menu } from '../../ui/overlay.js';
import { superConfirm } from '../../ui/safety.js';
import { withProgress, helpRequest } from '../../ui/jobs.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const card = (title, ico, ...kids) => h('section.card.stack', h('div.card-head', h('span.ic', icon(ico)), h('h3', title)), ...kids);
const until = (d) => { const s = Math.round((new Date(d) - Date.now()) / 1000); if (!Number.isFinite(s)) return ''; if (s > 365 * 86400) return pair('stays loaded', '一直載入'); if (s <= 0) return pair('unloading now', '而家卸載'); return pair(`unloads in ${s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h'}`, `${s < 60 ? s + ' 秒' : s < 3600 ? Math.round(s / 60) + ' 分鐘' : Math.round(s / 3600) + ' 小時'}後卸載`); };
const cap = (c) => h('span.chip', icon({ tools: 'build', vision: 'visibility', thinking: 'psychology', embedding: 'scatter_plot', completion: 'chat', insert: 'input' }[c] || 'label'), c);

/** What each runtime state means and the one next step, used here and on the Help section. */
export const RUNTIME_HELP = {
  missing: { title: pair('Ollama is not installed', '未安裝 Ollama'), body: pair('Ollama runs the models; this app manages it. One click downloads the official installer, checks its SHA-256 checksum from the release and installs it. Your models are kept if you are repairing a broken install.', 'Ollama 負責行模型，呢個程式負責管理。一撳就下載官方安裝程式、核對 SHA-256 再安裝；修復都會保留模型。') },
  stopped: { title: pair('Ollama is installed but not running', 'Ollama 已安裝但未運行'), body: pair('Start it here: the app runs "ollama serve" on 127.0.0.1:11434 and stops it again when you ask. If Ollama\'s own tray icon is set to start it, that works too.', '喺度啟動：程式會喺 127.0.0.1:11434 行 "ollama serve"，你叫停就停。用 Ollama 自己嘅系統匣圖示啟動都得。') },
  unhealthy: { title: pair('Something answers, but not like Ollama', '有嘢回應，但唔似 Ollama'), body: pair('Port 11434 answered with an error. Another program may be using the port, or Ollama is still starting. Wait a few seconds and refresh; if it stays, repair Ollama.', '11434 埠有回應但出錯。可能有其他程式用緊個埠，或者 Ollama 仲啟動緊。等幾秒再重新整理；一直咁就修復 Ollama。') }
};

export function runtimeCard(suite) {
  const box = h('div.stack');
  const draw = (s) => {
    const rt = s.rt;
    clear(box);
    if (!rt) { put(box, h('div.skeleton', { style: { height: '60px' } })); return; }
    if (rt.state === 'healthy') {
      put(box, h('div.row', h('span.badge.ok', icon('check_circle'), pair(`Ollama ${rt.version || ''} is running`, `Ollama ${rt.version || ''} 運行緊`)), h('span.small.muted', `${rt.endpoint}`),
        rt.owned ? h('span.badge', pair('started by this app', '由呢個程式啟動')) : h('span.badge', pair('started outside this app', '喺程式外面啟動'))),
        h('div.row', rt.owned ? h('button.btn.small.outline', { type: 'button', on: { click: async () => { try { await window.mt.ollama.stop(); toast(pair('Ollama stopped.', 'Ollama 已停止。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } suite.refresh(); } } }, icon('stop_circle'), pair('Stop Ollama', '停止 Ollama'))
          : h('span.small.muted', pair('To stop it, use Ollama\'s own tray icon or service; the app leaves a copy it did not start alone.', '要停就用 Ollama 自己嘅系統匣圖示；唔係呢個程式啟動嘅，程式唔會亂停。'))));
      return;
    }
    const help = RUNTIME_HELP[rt.state];
    put(box, h('div.flag-card', h('b', icon('warning'), ' ', help.title), h('div.small', help.body), rt.error ? h('div.small.err-text', rt.error) : null),
      h('div.row',
        rt.state === 'stopped' ? h('button.btn', { type: 'button', dataset: { el: 'ollama-start' }, on: { click: async () => { try { await window.mt.ollama.start(); toast(pair('Ollama is running.', 'Ollama 運行緊。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err', actions: [{ label: pair('Copy a help request', '複製求助訊息'), run: () => navigator.clipboard.writeText(e.message) }] }); } suite.refresh(); } } }, icon('play_arrow'), pair('Start Ollama', '啟動 Ollama')) : null,
        h(`button.btn${rt.state === 'stopped' ? '.outline' : ''}`, { type: 'button', dataset: { el: 'install-ollama' }, on: { click: () => withProgress(pair('Install or repair Ollama', '安裝或修復 Ollama'), (job) => window.mt.tools.installOllama(job), { onDone: (r, b) => { if (r?.ok) { put(b, h('p', pair(`Ollama ${r.version} installed; checksum verified.`, `已安裝 Ollama ${r.version}，已核對校驗碼。`))); setTimeout(() => suite.refresh(), 3000); } else if (r?.message) put(b, h('p', r.message)); } }) } }, icon('download'), pair('Install or repair Ollama', '安裝或修復 Ollama')),
        h('button.btn.small.text', { type: 'button', on: { click: () => suite.refresh() } }, icon('refresh'), pair('Check again', '再檢查'))));
  };
  suite.on(draw); draw(suite);
  return card(pair('Ollama on this computer', '呢部電腦嘅 Ollama'), 'smart_toy', box);
}

export function hardwareCard(suite) {
  const box = h('div.stack');
  const draw = (s) => {
    clear(box);
    const hw = s.hw;
    if (!hw) { put(box, h('div.skeleton', { style: { height: '60px' } })); return; }
    const g = hw.gpu || {};
    put(box, h('div.kpis',
      h('div.kpi', h('b', fmtBytes(hw.ram.total)), h('span', pair(`memory, ${fmtBytes(hw.ram.free)} free`, `記憶體，${fmtBytes(hw.ram.free)} 可用`))),
      h('div.kpi', h('b', g.known && g.vram ? fmtBytes(g.vram) : pair('Unknown', '未知')), h('span', g.name ? `${g.name}${g.known ? '' : pair(' (video memory not readable)', '（讀唔到顯示記憶體）')}` : pair('no graphics card found', '搵唔到顯示卡'))),
      h('div.kpi', h('b', hw.disk.free === null ? pair('Unknown', '未知') : fmtBytes(hw.disk.free)), h('span', pair('free for models', '模型可用空間')))),
      h('div.small.muted', pair(`Read ${fmtAgo(hw.at)}${g.source ? ` · video memory from ${g.source}` : ''}. ${g.note || ''}`, `${fmtAgo(hw.at)}讀取。${g.note || ''}`)),
      h('div.row', h('button.btn.small.text', { type: 'button', on: { click: () => suite.hardware() } }, icon('refresh'), pair('Read again', '再讀一次'))));
  };
  suite.on(draw); draw(suite);
  return card(pair('This computer', '呢部電腦'), 'memory', box);
}

function details(name) {
  window.mt.ollama.call('show', { model: name }).then((d) => {
    const info = Object.entries(d.model_info || {}).filter(([k]) => /\.(context_length|block_count|embedding_length|parameter_count)$|general\.(architecture|parameter_count)/.test(k));
    dialog({ title: name, wide: true, body: h('div.stack',
      h('div.suggest', (d.capabilities || []).map(cap)),
      h('div.tbl-wrap', h('table.tbl', h('tbody', [['Family', d.details?.family], ['Parameters', d.details?.parameter_size], ['Quantization', d.details?.quantization_level], ['Format', d.details?.format], ...info.map(([k, v]) => [k, String(v)])].filter(([, v]) => v).map(([k, v]) => h('tr', h('th', k), h('td.mono', v)))))),
      d.parameters ? [h('b', pair('Parameters', '參數')), h('div.out', d.parameters)] : null,
      d.system ? [h('b', pair('System prompt', '系統提示')), h('div.out', d.system)] : null,
      d.license ? h('details', h('summary', pair('Licence', '授權')), h('div.out', String(d.license).slice(0, 20000))) : null) });
  }).catch((e) => toast(e.message, { kind: 'err' }));
}

function copyDialog(suite, source) {
  const input = h('input.input.mono', { value: source.split(':')[0] + '-copy', 'aria-label': pair('New name', '新名') });
  const err = h('div.err-text');
  const check = () => { const v = input.value.trim(); err.textContent = !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(:[A-Za-z0-9._-]{1,128})?$/.test(v) ? pair('Use letters, digits, dots and dashes, with one optional :tag.', '用字母、數字、點同橫線，可以加一個 :tag。') : suite.installed.some((m) => m.name === v || m.name === v + ':latest') ? pair('A model with that name is already installed.', '已經有同名模型。') : ''; return !err.textContent; };
  input.addEventListener('input', check);
  dialog({ title: pair(`Copy ${source}`, `複製 ${source}`), body: h('div.stack', h('div.small', pair('The copy shares the same files on disk until one of them changes, so it takes almost no space.', '副本同原本共用磁碟上嘅檔案，幾乎唔使額外空間。')), input, err),
    actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Copy', '複製'), run: async () => { if (!check()) return false; try { await window.mt.ollama.call('copy', { source, destination: input.value.trim() }); toast(pair('Copied.', '已複製。'), { kind: 'ok' }); suite.refresh(); } catch (e) { err.textContent = e.message; return false; } } }] });
}

export function installedCard(suite) {
  const box = h('div.stack');
  const badgeCount = h('span.badge.info');
  const draw = (s) => {
    clear(box);
    badgeCount.textContent = pair(`${s.installed.length} models · ${fmtBytes(s.installed.reduce((n, m) => n + (m.size || 0), 0))}`, `${s.installed.length} 個模型`);
    if (s.rt?.state !== 'healthy') { put(box, h('div.empty.small', icon('cloud_off'), pair('Start Ollama to see the installed models.', '啟動 Ollama 先睇到已安裝模型。'))); return; }
    if (!s.installed.length) { put(box, h('div.empty', icon('inventory_2'), h('p', pair('No models yet. The Store lists every model with a fit check for this computer.', '未有模型。商店列晒所有模型，仲會睇吓呢部電腦行唔行到。')), h('button.btn.tonal', { type: 'button', on: { click: () => suite.go('store') } }, icon('storefront'), pair('Open the store', '打開商店')))); return; }
    const rows = s.installed.map((m) => {
      const live = s.running.find((r) => r.name === m.name);
      const c = s.caps[m.name] || { capabilities: [] };
      return h('tr', { dataset: { el: `ollama-model-${m.name}` } },
        h('td', h('b.mono', m.name)), h('td.mono', fmtBytes(m.size)),
        h('td.small', [m.details?.parameter_size, m.details?.quantization_level, c.contextLength ? `${Number(c.contextLength).toLocaleString('en-US')} ${pair('context', '上下文')}` : null].filter(Boolean).join(' · ')),
        h('td', h('div.suggest', c.capabilities.map(cap))),
        h('td', live ? h('span.badge.ok', icon('memory'), pair(`Loaded · ${fmtBytes(live.size_vram || live.size)} video memory`, `已載入 · ${fmtBytes(live.size_vram || live.size)} 顯示記憶體`), live.expires_at ? ` · ${until(live.expires_at)}` : '') : h('span.badge', pair('On disk', '喺磁碟'))),
        h('td', h('div.row.nowrap',
          c.capabilities.includes('embedding') ? null : h('button.btn.small.tonal', { type: 'button', on: { click: () => { suite.chatModel = m.name; suite.go('chat'); } } }, icon('forum'), pair('Chat', '對話')),
          h('button.btn.small.outline', { type: 'button', on: { click: async () => { try { await window.mt.ollama.call('generate', { model: m.name, keep_alive: live ? 0 : '10m' }); toast(live ? pair('Unloaded from memory.', '已由記憶體卸載。') : pair('Loaded for ten minutes.', '已載入十分鐘。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } suite.refresh(); } } }, icon(live ? 'eject' : 'play_arrow'), live ? pair('Unload', '卸載') : pair('Load', '載入')),
          h('button.icon-btn.sm', { type: 'button', 'aria-label': pair(`More for ${m.name}`, `${m.name} 更多`), on: { click: (e) => menu(e.currentTarget, [
            { icon: 'info', label: pair('Details', '詳情'), run: () => details(m.name) },
            { icon: 'content_copy', label: pair('Copy under a new name', '用新名複製'), run: () => copyDialog(suite, m.name) },
            { icon: 'build', label: pair('Make a model from this', '用佢製作模型'), run: () => { suite.createFrom = m.name; suite.go('create'); } },
            { icon: 'delete', danger: true, label: pair('Delete', '刪除'), run: async () => { if (await superConfirm({ action: pair(`Delete the model ${m.name}`, `刪除模型 ${m.name}`), affects: fmtBytes(m.size) })) { try { await window.mt.ollama.call('delete', { model: m.name }); toast(pair('Model deleted.', '已刪除模型。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } suite.refresh(); } } }
          ]) } }, icon('more_vert')))));
    });
    put(box, h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', [pair('Model', '模型'), pair('Size', '大小'), pair('Details', '詳情'), pair('Can', '能力'), pair('State', '狀態'), ''].map((x) => h('th', x)))), h('tbody', rows))));
  };
  suite.on(draw); draw(suite);
  return h('section.card.stack', h('div.card-head', h('span.ic', icon('inventory_2')), h('h3', pair('Installed', '已安裝')), badgeCount), box);
}

export function modelsTab(ctx, suite) {
  return h('div.stack', h('div.grid', h('div.span-6', runtimeCard(suite)), h('div.span-6', hardwareCard(suite))), installedCard(suite), h('div.small.muted', helpRequest(pair('Managing Ollama models', '管理 Ollama 模型'), suite.rt?.error || 'none')));
}
