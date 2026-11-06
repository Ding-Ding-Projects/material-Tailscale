// Export everything in every format that can faithfully carry it, stating any
// loss before the export runs. Also hands any export to an external editor.
import { h, icon } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import { menu, toast } from './overlay.js';

function toYaml(v, ind = '') {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return /^[\w./@:-]+$/.test(v) && !/^(true|false|null|\d)/.test(v) ? v : JSON.stringify(v);
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return v.length ? v.map((x) => `\n${ind}- ${toYaml(x, ind + '  ').replace(/^\n\s*/, '')}`).join('') : '[]';
  const e = Object.entries(v);
  return e.length ? e.map(([k, x]) => `\n${ind}${/^[\w-]+$/.test(k) ? k : JSON.stringify(k)}: ${toYaml(x, ind + '  ')}`).join('') : '{}';
}

function rowsOf(data) {
  if (Array.isArray(data) && data.every((x) => x && typeof x === 'object')) return data;
  if (data && typeof data === 'object') {
    for (const k of ['devices', 'keys', 'users', 'webhooks', 'logs', 'Peer']) if (data[k]) return Array.isArray(data[k]) ? data[k] : Object.values(data[k]);
  }
  return null;
}
const flat = (o, p = '', out = {}) => { for (const [k, v] of Object.entries(o || {})) { const key = p ? `${p}.${k}` : k; if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = Array.isArray(v) ? v.join(';') : v; } return out; };
function toCsv(rows) {
  const fr = rows.map((r) => flat(r));
  const cols = [...new Set(fr.flatMap((r) => Object.keys(r)))];
  const esc = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...fr.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n') + '\r\n';
}
function toMd(rows) {
  const fr = rows.map((r) => flat(r));
  const cols = [...new Set(fr.flatMap((r) => Object.keys(r)))].slice(0, 12);
  const e = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return `| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n` + fr.map((r) => `| ${cols.map((c) => e(r[c])).join(' | ')} |`).join('\n') + '\n';
}
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const FORMATS = [
  { id: 'json', label: 'JSON', ext: 'json', make: (d) => ({ text: JSON.stringify(d.data, null, 2) + '\n' }) },
  { id: 'yaml', label: 'YAML', ext: 'yaml', make: (d) => ({ text: `# ${d.name}\n# schema: material-tailscale export v1, UTF-8, LF line endings${toYaml(d.data)}\n` }) },
  { id: 'csv', label: 'CSV', ext: 'csv', make: (d) => { const r = rowsOf(d.data); return r ? { text: toCsv(r), loss: pair('Nested objects are flattened into dotted columns; lists are joined with semicolons.', '巢狀資料會攤平，列表用分號連接。') } : null; } },
  { id: 'md', label: 'Markdown', ext: 'md', make: (d) => { const r = rowsOf(d.data); return { text: r ? `# ${d.name}\n\n${toMd(r)}` : `# ${d.name}\n\n\`\`\`json\n${JSON.stringify(d.data, null, 2)}\n\`\`\`\n`, loss: r ? pair('Only the first 12 columns are tabulated.', '只列頭 12 欄。') : null }; } },
  { id: 'html', label: 'HTML', ext: 'html', make: (d) => ({ text: `<!doctype html><meta charset="utf-8"><title>${escHtml(d.name)}</title><pre>${escHtml(JSON.stringify(d.data, null, 2))}</pre>\n` }) },
  { id: 'txt', label: pair('Plain text', '純文字'), ext: 'txt', make: (d) => ({ text: d.text ?? (typeof d.data === 'string' ? d.data : JSON.stringify(d.data, null, 2)) }) }
];

export async function exportTo(fmt, getter) {
  const d = getter();
  const out = fmt.make(d);
  if (!out) { toast(pair(`${fmt.label} cannot carry this data (it is not a list of records).`, `${fmt.label} 裝唔到呢啲資料。`), { kind: 'warn' }); return null; }
  if (out.loss) toast(out.loss, { kind: 'warn', title: pair(`${fmt.label} export changes the shape`, `${fmt.label} 匯出會改形狀`) });
  const p = await window.mt.dialog.save({ defaultPath: `${d.name}.${fmt.ext}`, filters: [{ name: fmt.label, extensions: [fmt.ext] }] });
  if (!p) return null;
  await window.mt.fs.writeText(p, out.text);
  toast(pair(`Exported ${fmt.label} to ${p}`, `已匯出 ${fmt.label} 去 ${p}`), { kind: 'ok', actions: [{ label: pair('Show in folder', '喺資料夾顯示'), run: () => window.mt.shell.showItem(p) }, { label: pair('Open in editor', '用編輯器開'), run: () => openInEditor(p) }] });
  return p;
}

export async function openInEditor(p) {
  const eds = await window.mt.editor.detect();
  const chosen = JSON.parse(localStorage.getItem('mt.settings.v1') || '{}').editor;
  const ed = eds.find((e) => e.path === chosen) || eds.find((e) => /Code/.test(e.name)) || eds[0];
  if (!ed) { toast(pair('No editor was found. Visual Studio Code is free at code.visualstudio.com.', '搵唔到編輯器。可以喺 code.visualstudio.com 免費下載 VS Code。'), { kind: 'warn', actions: [{ label: pair('Get VS Code', '下載 VS Code'), run: () => window.mt.shell.external('https://code.visualstudio.com/download') }] }); return; }
  await window.mt.editor.open(ed.path, p);
  toast(pair(`Opened in ${ed.name}.`, `已用 ${ed.name} 開。`), { kind: 'ok' });
}

export function exportMenu(getter) {
  return h('button.icon-btn.sm', { type: 'button', 'aria-label': t('export'), title: t('export'), on: { click: (e) => menu(e.currentTarget, [
    ...FORMATS.map((f) => ({ label: `${t('export')} ${f.label}`, icon: 'download', run: () => exportTo(f, getter) })),
    '-',
    { label: pair('Copy as JSON', '複製 JSON'), icon: 'content_copy', run: () => { navigator.clipboard.writeText(JSON.stringify(getter().data, null, 2)); toast(t('copied'), { kind: 'ok' }); } }
  ]) } }, icon('ios_share'));
}
