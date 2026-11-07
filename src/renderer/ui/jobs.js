// Long operations show their real progress in the dialog that started them,
// and recovery sits beside the control when they fail.
import { h, icon, uid, fmtBytes } from '../core/dom.js';
import { pair, t } from '../core/i18n.js';
import { dialog, toast } from './overlay.js';
import { sound } from '../core/feedback.js';

export function withProgress(title, run, { onDone } = {}) {
  const job = uid('job');
  const bar = h('div.sc-progress', h('i', { style: { background: 'var(--primary)', width: '2%' } }));
  const phase = h('div', pair('Starting…', '開始緊…'));
  const detail = h('div.small.muted', { 'aria-live': 'polite' });
  const result = h('div.stack');
  const d = dialog({ title, emojiChar: '⏳', body: h('div.stack', phase, bar, detail, result), actions: [{ label: t('close'), kind: 'outline', value: true }] });
  const off = window.mt.tools.onProgress((p) => {
    if (p.job !== job) return;
    if (p.phase) phase.textContent = p.phase;
    const pct = p.percent ?? (p.total ? (p.got / p.total) * 100 : null);
    if (pct !== null && pct !== undefined) bar.firstChild.style.width = `${Math.max(2, Math.min(100, pct))}%`;
    detail.textContent = p.total ? `${fmtBytes(p.got)} / ${fmtBytes(p.total)}` : p.got ? fmtBytes(p.got) : pct !== null && pct !== undefined ? `${Math.round(pct)}%` : '';
  });
  const p = run(job).then((r) => {
    off();
    bar.firstChild.style.width = '100%';
    if (r && r.ok === false) { phase.textContent = r.message || pair('Not completed.', '未完成。'); bar.firstChild.style.background = 'var(--tertiary)'; sound('error'); }
    else { phase.textContent = pair('Done.', '完成。'); sound('success'); }
    onDone?.(r, result);
    return r;
  }).catch((e) => {
    off();
    bar.firstChild.style.background = 'var(--error)';
    phase.textContent = pair('Something went wrong.', '出咗問題。');
    result.append(h('div.err-text', e.message), helpRequest(title, e.message));
    sound('error');
    throw e;
  });
  return { promise: p, dialog: d };
}

/** Copyable hand-off for a local coding assistant that names the real situation. */
export function helpRequest(what, error) {
  const text = `I need help with Material Tailscale.\nWhat I was doing: ${what}\nWhat happened: ${error}\nApp version: ${window.__MT_VERSION__ || 'unknown'}\nPlease diagnose the cause first. Do not delete my data, reinstall over my settings, or force-push anything.`;
  return h('button.btn.small.outline', { type: 'button', on: { click: () => { navigator.clipboard.writeText(text); toast(pair('A help request was copied. Paste it to your coding assistant.', '已複製求助訊息，可以貼畀你嘅編程助手。'), { kind: 'ok' }); } } }, icon('support'), pair('Copy a help request', '複製求助訊息'));
}

export function installTailscaleButton(label) {
  return h('button.btn', { type: 'button', dataset: { el: 'install-tailscale' }, on: { click: () => withProgress(pair('Install Tailscale', '安裝 Tailscale'), (job) => window.mt.tools.installTailscale(job), { onDone: (r, box) => {
    if (r?.ok) { box.append(h('p', pair(`Tailscale ${r.version} is installed. Checksum verified (SHA-256 ${String(r.sha256).slice(0, 16)}…).`, `已安裝 Tailscale ${r.version}，校驗碼已驗證。`))); window.mt.ts.locate(); }
    else if (r?.manual || r?.cancelled) box.append(h('p', r.message));
  } }) } }, icon('download'), label || pair('Install Tailscale', '安裝 Tailscale'));
}
