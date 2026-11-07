// Virtual disks: a library of VHD, VHDX, VHD Set and ISO files with attach, detach, grow,
// shrink, compact, convert, merge and details; a guided Create form that shows exactly what will
// run; and Quick pack, which turns dropped files and folders into a new, automatically sized
// VHDX beside them, copies everything in and checks every file before it says done.
import { h, icon, clear, fmtBytes, uid, append } from '../core/dom.js';
import { pair } from '../core/i18n.js';
import * as store from '../core/store.js';
import { registerPage } from '../ui/shell.js';
import { pageHero, heroStats } from '../ui/hero.js';
import { mtabs } from '../ui/mtabs.js';
import { toast, dialog, menu } from '../ui/overlay.js';
import { regexField } from '../ui/regex.js';
import { helpRequest } from '../ui/jobs.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const isWin = () => window.__MT_PLATFORM__ === 'win32';
const WIN_ONLY = pair('Virtual disks are a Windows feature. This computer is not running Windows, so the buttons that change disks are off; everything else here still explains what they do.', '虛擬磁碟係 Windows 功能。呢部電腦唔係 Windows，所以改磁碟嘅掣會停用；其他說明照睇得到。');
const card = (title, ico, ...kids) => h('section.card.stack', h('div.card-head', h('span.ic', icon(ico)), h('h2.h3', title)), ...kids);
const seg = (opts, v, label, onPick) => { const el = h('div.seg', { role: 'radiogroup', 'aria-label': label }, opts.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === v), on: { click: (e) => { for (const b of el.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); onPick(k); } } }, l))); return el; };

/** Runs one operation with a progress dialog; resolves with the result or null. */
function runOp(title, op, request, { onDone } = {}) {
  const job = uid('vd');
  const list = h('ol.steps');
  const note = h('div.small', { 'aria-live': 'polite' }, pair('Waiting for Windows to ask for permission…', '等 Windows 問你攞權限…'));
  const bar = h('div.sc-progress', { role: 'progressbar', 'aria-label': pair('Progress', '進度'), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: '2%' } }));
  const d = dialog({ title, emojiChar: '💽', body: h('div.stack', note, list, bar), actions: [{ label: pair('Close', '關閉'), kind: 'outline', value: true }] });
  const rows = new Map();
  const off = window.mt.vdisk.onProgress((p) => {
    if (p.job !== job) return;
    if (p.msg === 'start') { const li = h('li.now', p.step); rows.set(p.step, li); put(list, li); note.textContent = p.step; }
    if (p.msg === 'done') rows.get(p.step)?.setAttribute('class', 'done');
    if (p.msg === 'fail') rows.get(p.step)?.setAttribute('class', 'fail');
    if (p.msg === 'plan') note.textContent = pair(`${p.files} files, ${fmtBytes(p.bytes)}: a ${Math.round(p.sizeMB / 102.4) / 10} GB dynamic VHDX at ${p.dest}`, `${p.files} 個檔案，${fmtBytes(p.bytes)}：${p.dest}`);
    if (p.msg === 'copy' || p.msg === 'verify') { const pct = Math.round((p.done / p.total) * 100); bar.firstChild.style.width = `${Math.max(2, (p.msg === 'copy' ? 0 : 50) + pct / 2)}%`; note.textContent = p.msg === 'copy' ? pair(`Copying: ${p.done} of ${p.total} files`, `複製緊：${p.total} 個入面 ${p.done} 個`) : pair(`Checking: ${p.done} of ${p.total} files match so far`, `檢查緊：${p.total} 個入面 ${p.done} 個`); }
  });
  return window.mt.vdisk.run(op, request, job).then((r) => {
    off(); bar.firstChild.style.width = '100%';
    note.textContent = pair('Done.', '完成。');
    onDone?.(r, d.el.querySelector('.stack'));
    return r;
  }).catch((e) => {
    off();
    bar.firstChild.style.background = e.code === 'CANCELLED' ? 'var(--tertiary)' : 'var(--error)';
    note.replaceChildren(h('b', e.code === 'CANCELLED' ? pair('Not changed', '冇改') : pair('Stopped', '停咗')), ' ', e.message);
    put(d.el.querySelector('.stack'), helpRequest(title, e.message));
    return null;
  });
}

registerPage('vdisks', (ctx) => {
  const cleanups = []; ctx.onCleanup(() => cleanups.forEach((f) => f()));
  const lib = () => store.get('vdiskLibrary') || [];
  const setLib = (l) => store.set('vdiskLibrary', [...new Set(l)].slice(0, 200), { record: false });
  let infos = {};
  const stats = h('div.hero-stats');
  const body = h('div.stack');
  const tabs = mtabs([{ value: 'library', icon: 'hard_drive', label: pair('Library', '磁碟庫') }, { value: 'create', icon: 'add_circle', label: pair('Create a disk', '建立磁碟') }, { value: 'pack', icon: 'inventory_2', label: pair('Quick pack', '快速打包') }],
    ['library', 'create', 'pack'].includes(ctx.arg) ? ctx.arg : 'library', { label: pair('Virtual disk sections', '虛擬磁碟分區') });
  const drawStats = () => stats.replaceChildren(...heroStats([
    { value: String(Object.values(infos).filter((x) => x.attached).length), label: pair('attached', '已掛載'), tone: 'ok' },
    { value: String(lib().length), label: pair('in the library', '喺磁碟庫') },
    { value: isWin() ? pair('Windows', 'Windows') : pair('Not Windows', '唔係 Windows'), label: pair('this computer', '呢部電腦'), tone: isWin() ? null : 'warn' }
  ]).children);
  const refreshInfo = async () => {
    if (!isWin() || !lib().length) { drawStats(); drawLibrary(); return; }
    try { const r = await window.mt.vdisk.run('info', { paths: lib() }, uid('vd')); infos = Object.fromEntries((r.data.disks || []).map((d) => [d.path, d])); } catch { /* shown per disk */ }
    drawStats(); drawLibrary();
  };

  // ---------- library ----------
  const libBox = h('div.stack');
  const routesBox = h('div.route-chips');
  const search = regexField({ id: 'vdisks', placeholder: pair('Search disks by name, path or format', '用名、路徑或者格式搜尋磁碟'), onChange: () => drawLibrary() });
  let show = 'all';
  const act = (title, op, req) => runOp(title, op, req, { onDone: () => refreshInfo() });
  const attachFile = async () => { const r = await window.mt.dialog.open({ filters: [{ name: pair('Virtual disks and images', '虛擬磁碟同映像'), extensions: ['vhd', 'vhdx', 'vhds', 'iso'] }], title: pair('Attach a disk or image', '掛載磁碟或映像') }); if (!r) return; setLib([...lib(), r[0]]); if (isWin()) act(pair('Attach', '掛載'), 'attach', { path: r[0] }); else { toast(WIN_ONLY, { kind: 'warn' }); refreshInfo(); } };
  const addFiles = async () => { const r = await window.mt.dialog.open({ properties: ['openFile', 'multiSelections'], filters: [{ name: pair('Virtual disks and images', '虛擬磁碟同映像'), extensions: ['vhd', 'vhdx', 'vhds', 'iso'] }], title: pair('Add disk files to the library', '加磁碟檔去磁碟庫') }); if (r) { setLib([...lib(), ...r]); refreshInfo(); } };
  const sizeDialog = (title, p, current, op, extra) => {
    const input = h('input.input', { type: 'number', min: 3, step: 1024, value: Math.ceil((current || 0) / 1048576) || 1024, 'aria-label': pair('New maximum size in MB', '新最大容量（MB）'), style: { width: '160px' } });
    const extend = h('input', { type: 'checkbox', checked: true, 'aria-label': pair('Extend the last partition to fill it', '將最後一個分割區延伸到填滿') });
    dialog({ title, body: h('div.stack', h('div.small', extra), h('div.row', input, 'MB'), op === 'expand' ? h('label.row.nowrap.small', extend, pair('Extend the last partition to fill the new space', '將最後一個分割區延伸到新空間')) : null),
      actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: title, run: () => { act(title, op, { path: p, sizeMB: Number(input.value), extend: extend.checked }); } }] });
  };
  const more = (e, p, info) => menu(e.currentTarget, [
    { icon: 'open_in_full', label: pair('Grow…', '擴大…'), run: () => sizeDialog(pair('Grow the disk', '擴大磁碟'), p, info?.virtualSize, 'expand', pair('Raises the maximum while the disk is detached. Growing never deletes anything.', '喺未掛載時提高上限，唔會刪除任何嘢。')) },
    { icon: 'close_fullscreen', label: pair('Shrink to the smallest safe size', '縮到最細安全大小'), run: () => act(pair('Shrink the disk', '縮細磁碟'), 'shrink', { path: p }) },
    { icon: 'compress', label: pair('Compact', '壓縮'), run: () => act(pair('Compact the disk', '壓縮磁碟'), 'compact', { path: p }) },
    { icon: 'swap_horiz', label: pair('Convert to a new file…', '轉換成新檔案…'), run: () => convertDialog(p) },
    { icon: 'merge', label: pair('Merge into its parent…', '合併入父磁碟…'), run: () => mergeDialog(p) },
    { icon: 'info', label: pair('Details', '詳情'), run: () => act(pair('Disk details', '磁碟詳情'), 'detail', { path: p }).then((r) => r && dialog({ title: p, wide: true, body: h('div.out', r.data.detail) })) },
    { icon: 'lock', label: pair('Attach read-only', '唯讀掛載'), run: () => act(pair('Attach read-only', '唯讀掛載'), 'attach', { path: p, readOnly: true }) },
    { icon: 'folder_open', label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(p) },
    { icon: 'playlist_remove', label: pair('Remove from the library (the file stays)', '由磁碟庫移除（檔案保留）'), run: () => { setLib(lib().filter((x) => x !== p)); delete infos[p]; drawLibrary(); drawStats(); } }
  ]);
  const convertDialog = (p) => {
    let to = /\.vhd$/i.test(p) ? 'vhdx' : 'vhd', type = 'dynamic';
    const dest = () => p.replace(/\.(vhdx?|VHDX?)$/, '') + (to === 'vhdx' ? ' (VHDX).vhdx' : ' (VHD).vhd');
    const out = h('code.small');
    const upd = () => { out.textContent = dest(); };
    dialog({ title: pair('Convert into a new file', '轉換成新檔案'), body: h('div.stack', h('div.small', pair('Copies the disk into a new file in the format you pick. The original stays exactly as it is.', '將磁碟複製成你揀嘅格式嘅新檔案，原本嘅檔案保持不變。')),
      seg([['vhdx', 'VHDX'], ['vhd', 'VHD']], to, pair('Format', '格式'), (k) => { to = k; upd(); }), seg([['dynamic', pair('Dynamic', '動態')], ['fixed', pair('Fixed', '固定')]], type, pair('Type', '類型'), (k) => { type = k; }), out),
    actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Convert', '轉換'), run: () => { act(pair('Convert the disk', '轉換磁碟'), 'convert', { path: p, dest: dest(), type }).then((r) => { if (r) setLib([...lib(), dest()]); }); } }] });
    upd();
  };
  const mergeDialog = (p) => {
    const depth = h('input.input', { type: 'number', min: 1, max: 16, value: 1, style: { width: '90px' }, 'aria-label': pair('Parent levels to merge', '合併幾多層父磁碟') });
    dialog({ title: pair('Merge into the parent', '合併入父磁碟'), body: h('div.stack', h('div.flag-card', h('b', icon('warning'), ' ', pair('Other children of that parent stop working', '同一個父磁碟嘅其他子磁碟會用唔到')), h('div.small', pair('Merging changes the parent. Any other differencing disk made from the same parent becomes invalid.', '合併會改父磁碟。由同一個父磁碟整出嚟嘅其他差異磁碟會失效。'))), h('div.row', depth, pair('levels', '層'))),
      actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Merge', '合併'), kind: 'danger', run: () => { act(pair('Merge the disk', '合併磁碟'), 'merge', { path: p, depth: Number(depth.value) }); } }] });
  };
  const drawLibrary = () => {
    clear(libBox);
    const { q, re } = search.value();
    let test = (p) => !q || p.toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (p) => r.test(p); } catch { test = () => false; } }
    const rows = lib().filter((p) => test(p) && (show === 'all' || (show === 'attached') === !!infos[p]?.attached));
    if (!lib().length) { put(libBox, h('div.empty', icon('hard_drive'), h('p', pair('No disks in the library yet. Add existing files, create a new disk, or pack a folder into one.', '磁碟庫未有嘢。加現有檔案、建立新磁碟，或者將資料夾打包成磁碟。')), h('div.row', h('button.btn.tonal', { type: 'button', on: { click: addFiles } }, icon('note_add'), pair('Add disk files', '加磁碟檔')), h('button.btn.outline', { type: 'button', on: { click: () => { tabs.set('create'); } } }, icon('add'), pair('Create a disk', '建立磁碟'))))); return; }
    put(libBox, h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', [pair('Disk', '磁碟'), pair('Format', '格式'), pair('Size', '大小'), pair('State', '狀態'), ''].map((x) => h('th', x)))),
      h('tbody', rows.map((p) => {
        const i = infos[p] || {};
        const name = p.split(/[\\/]/).pop();
        const fmt = (p.match(/\.(\w+)$/) || [])[1]?.toUpperCase();
        return h('tr', { dataset: { el: `vdisk-${name}` } }, h('td', h('b', name.replace(/\.\w+$/, '')), h('div.small.muted.mono', p)), h('td', i.storageType || fmt),
          h('td', i.virtualSize ? fmtBytes(i.virtualSize) : '—', i.fileSize !== undefined ? h('div.small.muted', pair(`${fmtBytes(i.fileSize)} on disk`, `佔用 ${fmtBytes(i.fileSize)}`)) : null),
          h('td', i.exists === false ? h('span.badge.err', pair('File missing', '搵唔到檔案')) : i.attached ? h('span.badge.ok', icon('link'), i.letters?.length ? pair(`Attached as ${i.letters.join(', ')}:`, `掛載為 ${i.letters.join(', ')}:`) : pair('Attached', '已掛載')) : h('span.badge', pair(isWin() ? 'Detached' : 'Unknown here', isWin() ? '未掛載' : '呢度唔知'))),
          h('td', h('div.row.nowrap', i.attached ? h('button.btn.small.outline', { type: 'button', disabled: !isWin(), on: { click: () => act(pair('Detach', '卸載'), 'detach', { path: p }) } }, icon('eject'), pair('Detach', '卸載'))
            : h('button.btn.small.tonal', { type: 'button', disabled: !isWin(), on: { click: () => act(pair('Attach', '掛載'), 'attach', { path: p }) } }, icon('link'), pair('Attach', '掛載')),
            h('button.icon-btn.sm', { type: 'button', disabled: !isWin(), 'aria-label': pair(`More for ${name}`, `${name} 更多`), on: { click: (e) => more(e, p, i) } }, icon('more_vert')))));
      })))));
  };
  const libraryView = h('div.stack',
    card(pair('Routes on this PC', '呢部電腦用嘅方法'), 'route', h('p.small.muted', { style: { margin: 0 } }, pair('Every operation here uses a route that Windows Home has: DiskPart, the Storage module and the virtual disk API. Windows asks for permission before anything changes a disk; cancelling changes nothing.', '呢度每個操作都用 Windows Home 都有嘅方法：DiskPart、Storage 模組同虛擬磁碟 API。改磁碟之前 Windows 會問你攞權限；取消就乜都唔改。')), routesBox, isWin() ? null : h('div.flag-card', h('b', icon('desktop_windows'), ' ', pair('Windows only', '只限 Windows')), h('div.small', WIN_ONLY))),
    h('section.card.stack', h('div.row', search.el, seg([['all', pair('All', '全部')], ['attached', pair('Attached', '已掛載')], ['detached', pair('Detached', '未掛載')]], show, pair('Show', '顯示'), (k) => { show = k; drawLibrary(); }),
      h('button.btn.small.outline', { type: 'button', on: { click: addFiles } }, icon('note_add'), pair('Add files', '加檔案'))), libBox),
    card(pair('What each action does', '每個動作做乜'), 'help', h('ul.small', { style: { margin: 0, paddingLeft: '18px' } },
      h('li', h('b', pair('Grow', '擴大')), pair(': raises the maximum while detached, then can extend the last partition.', '：未掛載時提高上限，之後可以延伸最後一個分割區。')),
      h('li', h('b', pair('Shrink', '縮細')), pair(': VHDX only, to the smallest size that cuts no partition.', '：只限 VHDX，縮到唔會切到分割區嘅最細大小。')),
      h('li', h('b', pair('Compact', '壓縮')), pair(': frees empty blocks of a dynamic disk; it is attached read-only while that runs.', '：釋放動態磁碟入面嘅空白區；進行期間會唯讀掛載。')),
      h('li', h('b', pair('Convert', '轉換')), pair(': copies the disk into a new VHD or VHDX file; the original stays.', '：複製成新嘅 VHD 或 VHDX 檔；原本嗰個保留。')),
      h('li', h('b', pair('Merge', '合併')), pair(': folds a differencing disk into its parent; other children of that parent stop working.', '：將差異磁碟併入父磁碟；同一父磁碟嘅其他子磁碟會失效。')),
      h('li', h('b', 'VHD Set'), pair(': attach and detach work here; creating one needs Hyper-V on Windows Pro or Enterprise.', '：呢度可以掛載同卸載；建立要 Windows Pro 或 Enterprise 嘅 Hyper-V。')))));

  // ---------- create ----------
  const c = { format: 'vhdx', type: 'dynamic', size: 64, unit: 'GB', path: '', parent: '', prepare: true, style: 'GPT', fs: 'NTFS', label: 'New volume', attach: true };
  const steps = h('div.out');
  const createBtn = h('button.btn', { type: 'button' }, icon('add'), pair('Create the disk', '建立磁碟'));
  const why = h('span.small.muted');
  const pathOut = h('code.small');
  const sizeMB = () => Math.round(c.size * { MB: 1, GB: 1024, TB: 1024 * 1024 }[c.unit]);
  const drawPlan = () => {
    const maxMB = c.format === 'vhd' ? 2040 * 1024 : 64 * 1024 * 1024;
    pathOut.textContent = c.path || pair('No file chosen yet', '未揀檔案');
    const lines = ['diskpart', c.type === 'differencing' ? `  create vdisk file="${c.path || '…'}" parent="${c.parent || '…'}"` : `  create vdisk file="${c.path || '…'}" maximum=${sizeMB()} type=${c.type === 'fixed' ? 'fixed' : 'expandable'}`];
    if (c.prepare || c.attach) lines.push('PowerShell (Storage module)', `  Mount-DiskImage -ImagePath "${c.path || '…'}"`);
    if (c.prepare) lines.push(`  Initialize-Disk -PartitionStyle ${c.style}`, '  New-Partition -UseMaximumSize -AssignDriveLetter', `  Format-Volume -FileSystem ${c.fs} -NewFileSystemLabel "${c.label}"`);
    if (c.prepare && !c.attach) lines.push(`  Dismount-DiskImage -ImagePath "${c.path || '…'}"`);
    steps.textContent = lines.join('\n');
    const problem = !isWin() ? pair('Windows only.', '只限 Windows。') : !c.path ? pair('Choose where to save the disk.', '揀儲存位置。') : c.type === 'differencing' && !c.parent ? pair('Choose the parent disk.', '揀父磁碟。') : c.type !== 'differencing' && (sizeMB() < 3 || sizeMB() > maxMB) ? pair(`The size must be between 3 MB and ${c.format === 'vhd' ? '2,040 GB' : '64 TB'} for ${c.format.toUpperCase()}.`, `${c.format.toUpperCase()} 嘅大小要喺 3 MB 至 ${c.format === 'vhd' ? '2,040 GB' : '64 TB'} 之間。`) : c.prepare && c.fs === 'FAT32' && sizeMB() > 32 * 1024 ? pair('Windows formats FAT32 up to 32 GB; choose exFAT or NTFS for a bigger disk.', 'Windows 只會格式化 32 GB 以內嘅 FAT32；大啲就揀 exFAT 或 NTFS。') : '';
    createBtn.disabled = !!problem; why.textContent = problem;
  };
  const sizeIn = h('input.input', { type: 'number', min: 1, value: c.size, style: { width: '110px' }, 'aria-label': pair('Maximum size', '最大容量'), on: { input: (e) => { c.size = Number(e.target.value); drawPlan(); } } });
  const pickPath = async () => { const p = await window.mt.dialog.save({ defaultPath: `New disk.${c.format}`, filters: [{ name: c.format.toUpperCase(), extensions: [c.format] }] }); if (p) { c.path = p.replace(/\.(vhdx?|VHDX?)$/, '') + '.' + c.format; drawPlan(); } };
  const pickParent = async () => { const r = await window.mt.dialog.open({ filters: [{ name: 'VHD, VHDX', extensions: ['vhd', 'vhdx'] }], title: pair('Choose the parent disk', '揀父磁碟') }); if (r) { c.parent = r[0]; drawPlan(); } };
  const typeRows = h('div.stack', { role: 'radiogroup', 'aria-label': pair('Disk type', '磁碟類型') });
  const drawTypes = () => put(clear(typeRows), ...[['dynamic', 'expand', pair('Dynamic (recommended)', '動態（建議）'), pair('Starts small and grows as you write, up to the maximum.', '開頭好細，寫入先慢慢變大，最多到上限。')], ['fixed', 'crop_square', pair('Fixed', '固定'), pair('Takes the whole size on the drive now; slower to create, a little faster to use.', '一開始就佔用全部空間；建立慢啲，用起嚟快少少。')], ['differencing', 'account_tree', pair('Differencing', '差異'), pair('Records changes on top of a parent disk you choose; the parent becomes read-only.', '喺你揀嘅父磁碟上面記錄改動；父磁碟會變唯讀。')]]
    .map(([k, ic, t, d]) => h('button.pick-row', { type: 'button', role: 'radio', 'aria-checked': String(c.type === k), on: { click: () => { c.type = k; drawTypes(); drawCreate(); drawPlan(); } } }, h('span.ava', icon(ic)), h('span.meta', h('b', t), h('span', d)), h('span.radio-dot'))));
  const sizeBox = h('div.flag-card');
  const drawCreate = () => {
    clear(sizeBox);
    if (c.type === 'differencing') put(sizeBox, h('b', pair('Parent disk', '父磁碟')), h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: pickParent } }, icon('folder_open'), pair('Choose the parent', '揀父磁碟')), h('code.small', c.parent || pair('None chosen', '未揀'))), h('div.small.muted', pair('A differencing disk takes its size from its parent.', '差異磁碟嘅大小跟父磁碟。')));
    else put(sizeBox, h('b', pair('Maximum size', '最大容量')), h('div.row', sizeIn, seg([['MB', 'MB'], ['GB', 'GB'], ['TB', 'TB']], c.unit, pair('Unit', '單位'), (k) => { c.unit = k; drawPlan(); })),
      h('div.suggest', [[8, 'GB'], [32, 'GB'], [64, 'GB'], [256, 'GB'], [1, 'TB']].map(([n, u]) => h('button.chip.choice', { type: 'button', on: { click: () => { c.size = n; c.unit = u; sizeIn.value = n; drawCreate(); drawPlan(); } } }, `${n} ${u}`))),
      h('div.small.muted', pair('A dynamic disk is not checked against free space when it is made, so it can promise more than the drive holds.', '動態磁碟建立時唔會檢查可用空間，所以可以承諾多過磁碟真正有嘅。')));
  };
  createBtn.addEventListener('click', () => runOp(pair('Create a virtual disk', '建立虛擬磁碟'), 'create', { path: c.path, type: c.type, sizeMB: sizeMB(), parent: c.parent || undefined, prepare: c.prepare ? { style: c.style, fs: c.fs, label: c.label } : null, attach: c.attach }, { onDone: (r, b) => { setLib([...lib(), c.path]); put(b, h('p', pair(`Created ${c.path}.`, `已建立 ${c.path}。`))); refreshInfo(); } }));
  const sw = (label, desc, key) => h('div.switch-row', h('div.txt', h('b', label), h('span.small.muted', desc)), h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(c[key]), 'aria-label': label, on: { click: (e) => { c[key] = !c[key]; e.currentTarget.setAttribute('aria-checked', String(c[key])); drawPlan(); } } }));
  const createView = h('div.grid',
    h('section.card.span-6.stack', h('div.card-head', h('span.ic', icon('tune')), h('h2.h3', pair('Format and type', '格式同類型'))),
      h('div.flag-card', h('b', pair('Format', '格式')), seg([['vhdx', pair('VHDX (recommended)', 'VHDX（建議）')], ['vhd', 'VHD']], c.format, pair('Format', '格式'), (k) => { c.format = k; if (c.path) c.path = c.path.replace(/\.\w+$/, '.' + k); drawPlan(); }),
        h('div.small.muted', pair('VHDX holds up to 64 TB and survives a power cut during a metadata update. VHD tops out at 2,040 GB and is for older systems.', 'VHDX 最大 64 TB，更新資料期間斷電都唔會壞。VHD 最大 2,040 GB，俾舊系統用。'))), typeRows),
    h('section.card.span-6.stack', h('div.card-head', h('span.ic', icon('straighten')), h('h2.h3', pair('Size and place', '大小同位置'))), sizeBox,
      h('div.flag-card', h('b', pair('File', '檔案')), h('div.row', h('button.btn.small.outline', { type: 'button', on: { click: pickPath } }, icon('folder_open'), pair('Choose where to save', '揀儲存位置')), pathOut), h('div.small.muted', pair('An existing file is never replaced; pick another name if this one is taken.', '唔會覆蓋現有檔案；個名用咗就揀第二個。')))),
    h('section.card.span-6.stack', h('div.card-head', h('span.ic', icon('storage')), h('h2.h3', pair('Ready to use', '即刻用得'))),
      sw(pair('Partition and format after creating', '建立後分割同格式化'), pair('Initialise the disk, make one partition and format it, so it shows up in File Explorer.', '初始化、整一個分割區再格式化，咁檔案總管就見到。'), 'prepare'),
      h('div.row', seg([['GPT', 'GPT'], ['MBR', 'MBR']], c.style, pair('Partition style', '分割樣式'), (k) => { c.style = k; drawPlan(); }), seg([['NTFS', 'NTFS'], ['exFAT', 'exFAT'], ['FAT32', 'FAT32'], ['ReFS', 'ReFS']], c.fs, pair('File system', '檔案系統'), (k) => { c.fs = k; drawPlan(); })),
      h('input.input', { value: c.label, 'aria-label': pair('Volume label', '磁碟區標籤'), on: { input: (e) => { c.label = e.target.value; drawPlan(); } } }),
      sw(pair('Attach when done', '完成後掛載'), pair('Give it a drive letter straight away.', '即刻俾佢一個磁碟機代號。'), 'attach')),
    h('section.card.span-6.tonal.stack', h('div.card-head', h('span.ic.alt', icon('terminal')), h('h2.h3', pair('What will run', '會行乜嘢'))), steps,
      h('p.small.muted', { style: { margin: 0 } }, icon('shield'), ' ', pair('Windows asks for permission once. Cancelling changes nothing.', 'Windows 會問一次權限；取消就乜都唔改。')),
      h('div.row', createBtn, h('button.btn.text', { type: 'button', on: { click: () => { navigator.clipboard.writeText(steps.textContent); toast(pair('Copied.', '已複製。'), { kind: 'ok' }); } } }, icon('content_copy'), pair('Copy these steps', '複製步驟'))), why));
  drawTypes(); drawCreate(); drawPlan();

  // ---------- quick pack ----------
  let items = [];
  const planBox = h('div.stack');
  const packBtn = h('button.btn', { type: 'button', disabled: true }, icon('inventory_2'), pair('Pack into a new VHDX', '打包成新 VHDX'));
  const drop = h('section.card.span-12.b64-drop', { tabindex: '0', dataset: { el: 'vdisk-drop' }, 'aria-label': pair('Drop files and folders to pack', '拖入要打包嘅檔案同資料夾') },
    h('div.b64-drop-art', icon('inventory_2')), h('h2.h3', pair('Drop files and folders here', '將檔案同資料夾拖入嚟')),
    h('p.small', pair('A new VHDX is made beside them, sized to fit, everything is copied in, and every file is checked against its original before it says done. Nothing is ever overwritten.', '會喺旁邊整一個啱啱好大細嘅新 VHDX，複製晒入去，逐個檔案同原本核對先話完成。唔會覆蓋任何嘢。')),
    h('div.row', h('button.btn.outline', { type: 'button', on: { click: async () => { const r = await window.mt.dialog.open({ properties: ['openFile', 'openDirectory', 'multiSelections'], title: pair('Choose what to pack', '揀要打包嘅嘢') }); if (r) plan(r); } } }, icon('note_add'), pair('Choose files or folders', '揀檔案或資料夾'))));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); plan([...e.dataTransfer.files].map((f) => window.mt.pathForFile(f)).filter(Boolean)); });
  async function plan(list) {
    items = list;
    clear(planBox);
    try {
      const m = await window.mt.vdisk.measure(items);
      put(planBox, h('div.tbl-wrap', h('table.tbl', h('tbody', items.map((p) => h('tr', h('td.mono.small', p)))))),
        h('div.flag-card', h('b', pair('Disk size', '磁碟大小')), h('div.small', pair(`${fmtBytes(m.bytes)} in ${m.files.toLocaleString('en-US')} files, plus room for the file system and 10% to spare: a ${fmtBytes(m.sizeMB * 1048576)} dynamic VHDX that only takes what it holds.`, `${m.files} 個檔案共 ${fmtBytes(m.bytes)}，加檔案系統空間同多 10%：一個 ${fmtBytes(m.sizeMB * 1048576)} 嘅動態 VHDX，用幾多先佔幾多。`))),
        h('div.flag-card', h('b', pair('New file', '新檔案')), h('code', m.dest), h('div.small.muted', pair('Beside what you dropped. If that name is taken the app adds (2), (3) and so on; nothing is ever overwritten.', '喺你拖入嘅嘢旁邊。個名用咗就會加 (2)、(3)；唔會覆蓋任何嘢。'))),
        isWin() ? null : h('div.small.muted', WIN_ONLY));
      packBtn.disabled = !isWin();
    } catch (e) { put(planBox, h('div.err-text', e.message)); packBtn.disabled = true; }
  }
  packBtn.addEventListener('click', () => runOp(pair('Quick pack', '快速打包'), 'pack', { items }, { onDone: (r, b) => {
    setLib([...lib(), r.data.dest]);
    put(b, h('div.row', h('span.badge.ok', icon('verified'), pair(`${r.data.verified} files checked, all match`, `${r.data.verified} 個檔案核對過，全部一樣`)), h('span.badge.info', pair('Detached', '已卸載'))), h('div.small.mono', r.data.dest));
    refreshInfo();
  } }));
  const packView = h('div.grid', drop, h('section.card.span-8.stack', h('div.card-head', h('span.ic', icon('folder_zip')), h('h2.h3', pair('What will be packed', '會打包乜嘢'))), planBox, h('div.row', packBtn)),
    h('section.card.span-4.tonal.stack', h('div.card-head', h('span.ic.alt', icon('checklist')), h('h2.h3', pair('How it works', '點運作'))), h('ol.steps', h('li', pair('Create a dynamic VHDX sized to fit', '建立啱啱好大細嘅動態 VHDX')), h('li', pair('Attach and format NTFS', '掛載同格式化 NTFS')), h('li', pair('Copy every file', '複製每個檔案')), h('li', pair('Check every file against its original (SHA-256)', '逐個檔案同原本核對（SHA-256）')), h('li', pair('Detach', '卸載'))),
      h('div.small.muted', pair('A mismatch stops the pack and keeps the disk attached so you can look.', '有唔一樣就會停，磁碟會保持掛載俾你睇。'))));

  const views = { library: libraryView, create: createView, pack: packView };
  const showTab = (v) => put(clear(body), views[v]);
  tabs.onChange(showTab); showTab(tabs.get());
  if (isWin()) window.mt.vdisk.run('probe', {}, uid('vd')).then((r) => { const d = r.data; put(clear(routesBox), ...[[d.diskpart, 'DiskPart'], [d.storage, pair('Storage module', 'Storage 模組')], [d.virtdisk, pair('Virtual disk API', '虛擬磁碟 API')], [d.hyperv, d.hyperv ? pair('Hyper-V module', 'Hyper-V 模組') : pair('Hyper-V module: not on this edition', 'Hyper-V 模組：呢個版本冇')]].map(([ok, l]) => h(`span.badge${ok ? '.ok' : ''}`, icon(ok ? 'check_circle' : 'block'), l)), h('span.small.muted', d.edition || '')); }).catch((e) => put(clear(routesBox), h('span.err-text', e.message)));
  else put(clear(routesBox), h('span.badge', icon('block'), pair('Not Windows: no disk routes', '唔係 Windows：冇磁碟方法')));
  refreshInfo();
  return h('div.page',
    pageHero(pair('Storage', '儲存'), pair('Virtual disks', '虛擬磁碟'), pair('Create, attach, grow, shrink, compact, convert and merge VHD, VHDX and VHD Set files, attach ISO images, and pack folders into a new VHDX.', '建立、掛載、擴大、縮細、壓縮、轉換同合併 VHD、VHDX 同 VHD Set，掛載 ISO，仲可以將資料夾打包成新 VHDX。'),
      h('button.btn', { type: 'button', on: { click: () => tabs.set('create') } }, icon('add'), pair('Create a disk', '建立磁碟')), h('button.btn.outline', { type: 'button', on: { click: attachFile } }, icon('link'), pair('Attach a file', '掛載檔案')), h('button.btn.tonal', { type: 'button', on: { click: () => tabs.set('pack') } }, icon('inventory_2'), pair('Quick pack', '快速打包')), stats),
    tabs.el, body);
});
