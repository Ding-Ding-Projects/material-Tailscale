// Build companion window: pick the source (bundled with this program, or a checkout folder),
// then Build, Build and run, or Build installer. The log streams live; progress follows the
// "[n/3]" steps the scripts print. Text is shown in English and Cantonese together.
const $ = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'on') for (const [e, f] of Object.entries(v)) el.addEventListener(e, f); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
};
const icon = (n) => $('span', { class: 'msr', 'aria-hidden': 'true' }, n);
const pair = (en, yue) => `${en} · ${yue}`;
if (matchMedia('(prefers-color-scheme: light)').matches) document.documentElement.dataset.theme = 'light';

const state = { info: null, running: false, step: 0 };
const app = document.getElementById('app');
const sourceText = $('div', { class: 'small muted' });
const sourceTitle = $('b');
const logBox = $('div', { class: 'out', role: 'log', 'aria-live': 'polite', style: 'max-height: 380px; min-height: 200px; white-space: pre-wrap' });
const bar = $('i', { style: 'width: 0%' });
const progress = $('div', { class: 'sc-progress', role: 'progressbar', 'aria-label': pair('Build progress', '建置進度'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, bar);
const result = $('div', { role: 'status' });
const buttons = [
  ['build', 'construction', pair('Build', '建置'), 'btn big'],
  ['run', 'play_arrow', pair('Build and run', '建置並執行'), 'btn big tonal'],
  ['installer', 'package_2', pair('Build installer', '建置安裝程式'), 'btn big tonal']
].map(([action, ic, label, cls]) => $('button', { type: 'button', class: cls, on: { click: () => start(action) } }, icon(ic), label));
const stopBtn = $('button', { type: 'button', class: 'btn outline', disabled: true, on: { click: () => window.build.stop() } }, icon('stop'), pair('Stop', '停'));
const copyBtn = $('button', { type: 'button', class: 'btn text', on: { click: async () => { const n = await window.build.copy(); result.textContent = pair(`Copied ${n} lines.`, `已複製 ${n} 行。`); } } }, icon('content_copy'), pair('Copy log', '複製記錄'));

function drawSource() {
  const s = state.info.source, b = state.info.bundled;
  if (s?.kind === 'folder') { sourceTitle.textContent = pair('Source: a checkout folder', '來源：本機程式碼資料夾'); sourceText.textContent = s.dir; }
  else if (b) { sourceTitle.textContent = pair('Source: bundled with this program', '來源：程式自帶'); sourceText.textContent = pair(`Material Tailscale ${b.version}, commit ${b.commit.slice(0, 7)}, ${b.files.toLocaleString('en-US')} files. No checkout needed.`, `Material Tailscale ${b.version}，commit ${b.commit.slice(0, 7)}，${b.files} 個檔案，唔使另外下載。`); }
  else { sourceTitle.textContent = pair('Source: choose a checkout folder', '來源：請揀程式碼資料夾'); sourceText.textContent = pair('This copy carries no bundled source.', '呢個版本冇自帶程式碼。'); }
}
function setRunning(on) {
  state.running = on;
  for (const b of buttons) b.disabled = on || state.info.platform !== 'win32';
  stopBtn.disabled = !on;
}
async function start(action) {
  logBox.textContent = ''; result.textContent = ''; state.step = 0; bar.style.width = '2%'; progress.setAttribute('aria-valuenow', '2');
  try { const r = await window.build.start(action); setRunning(true); result.textContent = pair(`Running in ${r.dir}`, `喺 ${r.dir} 行緊`); }
  catch (e) { result.replaceChildren($('span', { class: 'badge err' }, icon('error'), e.message)); }
}
window.build.onLine(({ stream, line }) => {
  const m = /^\[(\d)\/(\d)\]/.exec(line);
  if (m) { const pct = Math.round(((Number(m[1]) - 1) / Number(m[2])) * 100) + 5; bar.style.width = `${pct}%`; progress.setAttribute('aria-valuenow', String(pct)); }
  logBox.append($('div', stream === 'err' ? { class: 'err' } : {}, line));
  if (logBox.childNodes.length > 4000) logBox.firstChild.remove();
  logBox.scrollTop = logBox.scrollHeight;
});
window.build.onDone(({ code, error }) => {
  setRunning(false);
  bar.style.width = '100%'; progress.setAttribute('aria-valuenow', '100');
  bar.style.background = code === 0 ? 'var(--secondary)' : 'var(--error)';
  result.replaceChildren(code === 0 ? $('span', { class: 'badge ok' }, icon('task_alt'), pair('Finished: the script exited with 0.', '完成：指令碼以 0 結束。')) : $('span', { class: 'badge err' }, icon('error'), pair(`Stopped: exit code ${code}${error ? `, ${error}` : ''}. The log above says why.`, `停咗：結束碼 ${code}。上面嘅記錄有原因。`)));
});

(async () => {
  state.info = await window.build.info();
  const winOnly = state.info.platform !== 'win32';
  app.append(
    $('section', { class: 'card stack' }, $('div', { class: 'row' }, $('span', { class: 'ic' }, icon('inventory_2')), $('div', { style: 'flex: 1; min-width: 0' }, sourceTitle, sourceText),
      $('button', { type: 'button', class: 'btn small outline', on: { click: async () => { state.info.source = await window.build.pickFolder(); drawSource(); } } }, icon('folder_open'), pair('Use a folder instead', '改用資料夾')),
      state.info.bundled ? $('button', { type: 'button', class: 'btn small text', on: { click: async () => { try { state.info.source = await window.build.useBundled(); drawSource(); } catch (e) { result.textContent = e.message; } } } }, icon('inventory_2'), pair('Use the bundled source', '用自帶程式碼')) : null),
      winOnly ? $('div', { class: 'flag-card' }, $('b', {}, icon('desktop_windows'), ' ', pair('Windows only', '只限 Windows')), $('div', { class: 'small' }, pair('build.bat and build-installer.bat run on Windows; the buttons are off here.', 'build.bat 同 build-installer.bat 要喺 Windows 行；呢度啲掣停用。'))) : null),
    $('div', { class: 'build-actions' }, buttons),
    $('div', { class: 'grid' },
      $('section', { class: 'card span-5 stack' }, $('div', { class: 'card-head' }, $('span', { class: 'ic' }, icon('checklist')), $('h3', {}, pair('Needed to build', '建置需要'))),
        $('div', { class: 'tbl-wrap' }, $('table', { class: 'tbl' }, $('tbody', {}, [['Node.js 22', pair('fetched by the script if missing', '冇就由指令碼下載')], ['npm packages', pair('installed by npm ci', '由 npm ci 安裝')], ['7-Zip, ffmpeg', pair('bundled npm packages', '隨 npm 套件附帶')]].map(([a, b]) => $('tr', {}, $('td', {}, a), $('td', {}, $('span', { class: 'badge info' }, b))))))),
        $('div', { class: 'small muted' }, pair('download-dependencies.bat fetches anything missing from its official source and checks it before use. When a step needs permission, Windows asks you.', 'download-dependencies.bat 會由官方來源下載缺少嘅嘢，用之前會檢查；要權限嗰陣 Windows 會問你。'))),
      $('section', { class: 'card span-7 tonal stack' }, $('div', { class: 'card-head' }, $('span', { class: 'ic alt' }, icon('terminal')), $('h3', {}, pair('Build log', '建置記錄'))), progress, logBox, $('div', { class: 'row' }, stopBtn, copyBtn), result)));
  drawSource();
  setRunning(state.info.running);
})();
