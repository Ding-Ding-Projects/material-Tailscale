// Harnesses section: launch another program pointed at a local model through allowlisted
// profiles. Shows a full preview and every check before anything starts; the app saves a
// snapshot first and puts it back by itself when a launch fails.
import { h, icon, clear, fmtAgo, append } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import { toast, dialog } from '../../ui/overlay.js';
import FIT from '../../../shared/ollama-fit.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

export function harnessTab(ctx, suite) {
  let profiles = [], lastUsed = {}, selected = 'terminal', folder = null;
  const listBox = h('div.stack', { role: 'radiogroup', 'aria-label': pair('Launch profiles', '啟動設定') });
  const pre = h('div.stack');
  const snaps = h('div.stack');
  const modelSel = h('select.input', { 'aria-label': pair('Model', '模型'), on: { change: () => check() } });
  const folderBtn = h('button.btn.small.outline', { type: 'button', on: { click: async () => { const r = await window.mt.dialog.open({ properties: ['openDirectory'], title: pair('Working folder', '工作資料夾') }); if (r) { folder = r[0]; check(); } } } }, icon('folder_open'), pair('Choose the working folder', '揀工作資料夾'));

  const drawList = () => {
    put(clear(listBox), ...profiles.map((p) => h('button.pick-row', { type: 'button', role: 'radio', 'aria-checked': String(p.id === selected), dataset: { el: `harness-${p.id}` }, on: { click: () => { selected = p.id; drawList(); check(); } } },
      h('span.ava', icon({ terminal: 'terminal', aider: 'code', 'open-webui': 'web' }[p.id] || 'apps')), h('span.meta', h('b', p.name), h('span', p.found ? `${p.about || ''} ${pair('Found:', '搵到：')} ${p.program}` : `${pair('Not found.', '搵唔到。')} ${p.about || ''}`)), h('span.radio-dot'))),
    h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: addDialog } }, icon('add'), pair('Add a profile', '加設定')),
      !profiles.find((p) => p.id === selected)?.builtin ? h('button.btn.small.text', { type: 'button', on: { click: async () => { const r = await window.mt.harness.remove(selected); profiles = r.profiles; selected = 'terminal'; drawList(); check(); } } }, icon('delete'), pair('Remove this profile', '移除呢個設定')) : null,
      h('button.btn.small.text', { type: 'button', on: { click: load } }, icon('refresh'), pair('Look again', '再搵一次'))));
  };
  const check = async () => {
    const p = profiles.find((x) => x.id === selected);
    clear(pre);
    if (!p) return;
    const r = await window.mt.harness.preflight({ id: p.id, model: modelSel.value || null, folder });
    const tag = suite.installed.find((m) => m.name === modelSel.value);
    const fit = tag ? FIT.fit({ size: tag.size, context: suite.caps[tag.name]?.contextLength || null }, suite.hw) : null;
    put(pre, h('div.tbl-wrap', h('table.tbl', h('tbody',
      ...r.checks.map((c) => h('tr', h('td', c.what), h('td', c.ok ? h('span.badge.ok', icon('check'), pair('Ready', '準備好')) : h('span.badge.err', icon('close'), c.fix || pair('Not ready', '未準備好'))))),
      fit ? h('tr', h('td', pair('Fit on this computer', '呢部電腦行唔行到')), h('td', h(`span.badge.${{ 'Runs well': 'ok', 'Runs with limits': 'warn', Unlikely: 'err', Unknown: 'info' }[fit.verdict]}`, fit.verdict))) : null))),
      p.needsFolder ? h('div.row', folderBtn, h('span.small.mono', folder || pair('No folder chosen', '未揀資料夾'))) : null,
      h('b.small', pair('What will run', '會行乜嘢')),
      h('div.out', [`${r.preview.program || pair('(program not found)', '（搵唔到程式）')}`, ...r.preview.args.map((a) => `  ${a}`), r.preview.folder ? `${pair('working folder', '工作資料夾')}: ${r.preview.folder}` : null, ...Object.entries(r.preview.env).map(([k, v]) => `${k}=${v}`), `${pair('health check', '健康檢查')}: ${r.preview.health === 'alive' ? pair('still running after 2.5 seconds', '2.5 秒後仲行緊') : r.preview.health}`].filter(Boolean).join('\n')),
      h('div.small.muted', icon('history'), ' ', pair('The profiles are saved before launch. If the launch or its health check fails, they are put back automatically.', '啟動前會儲存設定；啟動或者健康檢查失敗，會自動還原。')),
      h('div.row', h('button.btn', { type: 'button', disabled: !r.ok, title: r.ok ? '' : pair('Fix the checks marked above first.', '先解決上面標咗嘅檢查。'), on: { click: () => launch(p) } }, icon('play_arrow'), pair('Launch', '啟動')), r.ok ? null : h('span.small.muted', pair('Launch unlocks when every check is ready.', '全部檢查準備好先可以啟動。'))));
  };
  const launch = async (p) => {
    try { const r = await window.mt.harness.launch({ id: p.id, model: modelSel.value, folder }); toast(pair(`${p.name} started: ${r.health}.`, `${p.name} 已啟動：${r.health}。`), { kind: 'ok' }); }
    catch (e) { toast(e.message, { kind: e.code === 'ROLLED_BACK' ? 'warn' : 'err', title: e.code === 'ROLLED_BACK' ? pair('Launch failed; snapshot restored', '啟動失敗，已還原快照') : pair('Not launched', '冇啟動') }); }
    load();
  };
  const drawSnaps = async () => {
    const list = await window.mt.harness.snapshots();
    put(clear(snaps), ...(list.length ? list.slice(0, 8).map((s) => h('div.row.nowrap', h('span.small', { style: { flex: 1 } }, `${fmtAgo(s.at)} · ${s.reason}`), h('button.btn.small.text', { type: 'button', on: { click: async () => { const r = await window.mt.harness.restore(s.file); profiles = r.profiles; drawList(); check(); toast(pair('Snapshot restored.', '已還原快照。'), { kind: 'ok' }); } } }, icon('restore'), pair('Restore', '還原'))))
      : [h('div.small.muted', pair('No snapshots yet: one is saved before every launch.', '未有快照：每次啟動前都會存一個。'))]));
  };
  const addDialog = () => {
    let program = null;
    const nameIn = h('input.input', { 'aria-label': pair('Profile name', '設定名稱'), placeholder: pair('My tool', '我嘅工具') });
    const progLabel = h('span.small.mono', pair('No program chosen', '未揀程式'));
    const args = h('textarea.input.mono', { 'aria-label': pair('Arguments, one per line', '參數，一行一個'), placeholder: '--model\n{model}', style: { minHeight: '90px' } });
    const env = Object.fromEntries(['OLLAMA_HOST', 'OLLAMA_API_BASE', 'OLLAMA_BASE_URL'].map((k) => [k, h('input', { type: 'checkbox', 'aria-label': k })]));
    const needs = h('input', { type: 'checkbox', 'aria-label': pair('Needs a working folder', '要工作資料夾') });
    const err = h('div.err-text');
    dialog({ title: pair('Add a harness profile', '加啟動設定'), wide: true, body: h('div.stack',
      h('div.small', pair('A profile is a program and its arguments, one per line. No shell runs, so there is nothing to escape; {model} and {host} are the only words that get filled in.', '設定就係一個程式同佢嘅參數，一行一個。唔經 shell，唔使跳脫字元；只有 {model} 同 {host} 會被填入。')),
      nameIn, h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: async () => { const r = await window.mt.dialog.open({ properties: ['openFile'], title: pair('Choose the program', '揀程式') }); if (r) { program = r[0]; progLabel.textContent = program; } } } }, icon('folder_open'), pair('Choose the program', '揀程式')), progLabel), args,
      h('div.row', ...Object.entries(env).map(([k, box]) => h('label.row.nowrap.small', box, h('code', k))), h('label.row.nowrap.small', needs, pair('Needs a working folder', '要工作資料夾'))),
      h('div.small.muted', pair('Ticked variables are set to this computer\'s Ollama address, 127.0.0.1:11434.', '剔咗嘅變數會設做本機 Ollama 地址 127.0.0.1:11434。')), err),
    actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Add', '加'), run: async () => {
      try { const r = await window.mt.harness.add({ name: nameIn.value, program, args: args.value.split('\n').map((x) => x.trim()).filter(Boolean), env: Object.keys(env).filter((k) => env[k].checked), needsFolder: needs.checked }); profiles = r.profiles; selected = profiles[profiles.length - 1].id; drawList(); check(); }
      catch (e) { err.textContent = e.message; return false; }
    } }] });
  };
  const fillModels = () => {
    const keep = modelSel.value;
    put(clear(modelSel), ...suite.installed.filter((m) => !(suite.caps[m.name]?.capabilities || []).includes('embedding')).map((m) => h('option', { value: m.name }, m.name)));
    const last = lastUsed[selected]?.model;
    modelSel.value = [keep, last].find((x) => x && suite.installed.some((m) => m.name === x)) || modelSel.options[0]?.value || '';
  };
  async function load() { const r = await window.mt.harness.list(); profiles = r.profiles; lastUsed = r.lastUsed; drawList(); fillModels(); check(); drawSnaps(); }
  ctx.onCleanup(suite.on(() => { fillModels(); }));
  load();
  return h('div.grid',
    h('section.card.span-5.stack', h('div.card-head', h('span.ic', icon('rocket_launch')), h('h2.h3', pair('Profiles', '設定'))), h('div.small.muted', pair('Ollama itself never starts other programs; this app does, only from these profiles.', 'Ollama 本身唔會開其他程式；係呢個程式按呢啲設定去開。')), listBox),
    h('section.card.span-7.tonal.stack', { dataset: { el: 'harness-preflight' } }, h('div.card-head', h('span.ic.alt', icon('checklist')), h('h2.h3', pair('Before launching', '啟動之前'))), h('div.row', h('b.small', pair('Model', '模型')), modelSel), pre),
    h('section.card.span-12.stack', h('div.card-head', h('span.ic', icon('history')), h('h2.h3', pair('Snapshots', '快照'))), snaps));
}
