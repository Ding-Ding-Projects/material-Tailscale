// Turns one CLI catalogue entry into a full rich form: one card per flag with
// its own info button, a live preview of the exact command, validation, run
// or stream, and a rendered output panel.
import { h, icon, clear, uid } from '../core/dom.js';
import { t, pair, emoji } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as ts from '../core/tsdata.js';
import { forSpec } from './controls.js';
import { toast, popover, confirmDialog } from './overlay.js';
import { superConfirm } from './safety.js';
import { jsonTree } from './jsontree.js';
import { sound, narrate } from '../core/feedback.js';
import { buildArgs } from '../../shared/cli-catalog.js';
import { exportMenu } from './exporter.js';
import { YUE_TITLES } from './cli-yue.js';

const PLATFORM = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };

export function infoBtn(title, explanation, { example, steps } = {}) {
  return h('button.info-btn', { type: 'button', 'aria-label': pair(`About ${title}`, `關於 ${title}`), on: { click: (e) => {
    e.stopPropagation();
    popover(e.currentTarget, h('div.stack', { style: { padding: '6px', maxWidth: '380px' } },
      h('h3', title), h('div', explanation),
      example ? h('div.stack', h('b.small', pair('Worked example', '例子')), h('div.cmdline', example)) : null,
      steps?.length ? h('div.stack', h('b.small', pair('Step by step', '一步步')), h('ol', { style: { margin: 0, paddingLeft: '20px' } }, steps.map((s) => h('li', s)))) : null,
      h('div.small.muted', pair('This explanation never runs anything.', '呢個說明唔會執行任何嘢。'))));
  } } }, icon('info'));
}

function exampleFor(cmd, spec) {
  const val = { bool: 'true', int: String(spec.default ?? 3), port: '443', duration: spec.default || '5s', cidrs: '192.168.1.0/24', tags: 'tag:server', enum: spec.options?.find(Boolean) || '', exitnode: 'nas-01', peer: 'nas-01' }[spec.type] ?? 'value';
  return `tailscale ${cmd.path.join(' ')} --${spec.name}=${val}`;
}

export function commandForm(cmd, { compact, onResult, preset } = {}) {
  const triState = !!cmd.triState;
  const controls = new Map();
  const pos = [];
  const preview = h('div.cmdline', { 'aria-live': 'polite' });
  const errBox = h('div.err-text');
  const outBox = h('div.stack');
  const runBtn = h('button.btn.big', { type: 'button' });
  const cancelBtn = h('button.btn.outline', { type: 'button', hidden: true }, icon('stop'), t('cancel'));
  let streamId = null;

  const values = () => {
    const flags = {};
    for (const [name, c] of controls) {
      const v = c.get();
      const spec = cmd.flags.find((f) => f.name === name);
      if (v === undefined || v === '' && spec.type !== 'port' || (Array.isArray(v) && !v.length && spec.type !== 'cidrs')) continue;
      if (Array.isArray(v) && !v.length && spec.type === 'cidrs' && !c.touched) continue;
      if (!triState && spec.type === 'bool' && v === (spec.default ?? false) && !c.touched) continue;
      if (spec.type !== 'bool' && !c.touched && v === spec.default) continue;
      flags[name] = v;
    }
    return { flags, positionals: pos.map((c) => c.get()) };
  };

  const refresh = () => {
    clear(preview); errBox.textContent = '';
    try {
      const argv = buildArgs(cmd.id, { ...values(), global: ts.globalValues() });
      preview.append(h('span', 'tailscale '));
      for (const a of argv) {
        const m = a.match(/^(--[\w-]+)(=?)(.*)$/);
        if (m) preview.append(h('span.tok-flag', m[1]), m[2], m[3] ? h('span.tok-val', m[3]) : '', ' ');
        else preview.append(h('span', a + ' '));
      }
      runBtn.disabled = false;
      return argv;
    } catch (e) {
      preview.append(h('span.muted', 'tailscale ' + cmd.path.join(' ') + ' …'));
      errBox.textContent = e.message;
      runBtn.disabled = true;
      return null;
    }
  };

  const cards = [];
  (cmd.positionals || []).forEach((p, i) => {
    const c = forSpec(p, { value: preset?.positionals?.[i] });
    c.onChange(() => { c.touched = true; refresh(); });
    pos.push(c);
    cards.push(h('div.flag-card.span2', { dataset: { el: `cmd-${cmd.id}-arg-${i}` } },
      h('div.row.nowrap', infoBtn(p.name, pair(`Argument: ${p.name}${p.required ? ' (required)' : ' (optional)'}.`, `參數：${p.name}${p.required ? '（必填）' : '（可選）'}。`)), h('b', p.name), p.required ? h('span.badge.warn', pair('required', '必填')) : h('span.badge.info', pair('optional', '可選'))),
      c.el));
  });
  for (const spec of cmd.flags || []) {
    const c = forSpec(spec, { triState, value: preset?.flags?.[spec.name] });
    const card = h('div.flag-card', { dataset: { el: `cmd-${cmd.id}-flag-${spec.name}` } });
    c.onChange(() => { c.touched = true; card.classList.add('changed'); refresh(); });
    controls.set(spec.name, c);
    const wide = ['exitnode', 'servetarget', 'cidrs', 'tags', 'keys', 'duration', 'files'].includes(spec.type);
    if (wide) card.classList.add('span2');
    const plat = spec.platforms?.length ? h('span.badge.info', spec.platforms.map((p) => PLATFORM[p] || p).join(', ') + pair(' only', ' 限定')) : null;
    card.append(
      h('div.row.nowrap', infoBtn('--' + spec.name, spec.desc + (spec.defaultNote ? ' ' + spec.defaultNote : ''), { example: exampleFor(cmd, spec) }),
        h('b', { style: { flex: 1 } }, spec.name.replace(/-/g, ' ')), h('code.small.mono', { style: { color: 'var(--primary)' } }, '--' + spec.name), plat),
      c.el,
      h('div.small.muted', pair(spec.desc, ''), spec.default !== undefined ? h('span', ` · ${pair('default', '預設')}: ${String(spec.default)}`) : null));
    cards.push(card);
  }

  const isExternal = !!cmd.external;
  runBtn.append(icon(isExternal ? 'open_in_new' : cmd.output === 'stream' ? 'play_circle' : 'play_arrow'), isExternal ? pair('Open in terminal', '喺終端開') : t('run'));
  if (cmd.danger === 'hard') runBtn.classList.add('danger');

  runBtn.addEventListener('click', async () => {
    const argv = refresh();
    if (!argv) return;
    if (cmd.danger === 'hard' && !(await superConfirm({ action: `tailscale ${argv.join(' ')}`, affects: cmd.desc, anchor: runBtn }))) return;
    if (cmd.danger === 'soft' && !(await confirmDialog(pair('Run this command?', '執行呢個指令？'), `tailscale ${argv.join(' ')}`, { okLabel: t('run') }))) return;
    const v = { ...values(), global: ts.globalValues() };
    window.mt.history.record(`Ran tailscale ${cmd.path.join(' ')}`, { 'last-command.json': { at: new Date().toISOString(), command: cmd.id, argv: argv.map((a) => (/key|secret|token/i.test(a) ? a.replace(/=.*/, '=(hidden)') : a)) } }).catch(() => {});
    if (isExternal) {
      try { await window.mt.ts.terminal(cmd.id, v); toast(pair('Opened in a terminal window.', '已經喺終端開咗。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); }
      return;
    }
    clear(outBox);
    runBtn.disabled = true;
    const started = performance.now();
    const status = h('div.row', h('span.dot.live'), h('span', pair('Running…', '執行緊…')));
    outBox.append(status);
    if (cmd.output === 'stream') {
      streamId = uid('s');
      const log = h('div.out', { role: 'log', 'aria-live': 'polite' });
      outBox.append(log);
      cancelBtn.hidden = false;
      const off = window.mt.ts.onStream((m) => {
        if (m.streamId !== streamId) return;
        if (m.type === 'stdout' || m.type === 'stderr') {
          const txt = m.text;
          const urls = txt.match(/https:\/\/login\.tailscale\.com\/\S+/g);
          log.append(h(m.type === 'stderr' ? 'span.err' : 'span', txt));
          if (urls) urls.forEach((u) => log.append(h('div', h('button.btn.small.green', { type: 'button', on: { click: () => window.mt.shell.external(u) } }, icon('open_in_new'), pair('Open login page', '開登入頁')))));
          log.scrollTop = log.scrollHeight;
        }
        if (m.type === 'end') {
          off(); cancelBtn.hidden = true; runBtn.disabled = false; streamId = null;
          clear(status).append(m.code === 0 ? h('span.badge.ok', t('cmdOk')) : m.missing ? h('span.badge.err', t('notInstalled')) : h('span.badge.err', t('cmdFail', { code: m.code })), h('span.small.muted', ` ${Math.round(performance.now() - started)} ms`));
          sound(m.code === 0 ? 'success' : 'error');
          narrate(m.code === 0 ? 'ok' : 'error', m.code === 0 ? `${cmd.title} finished.` : `${cmd.title} failed with code ${m.code}.`, m.code === 0 ? `${YUE_TITLES[cmd.id] || cmd.title} 完成。` : `${YUE_TITLES[cmd.id] || cmd.title} 失敗。`);
          ts.poll(); onResult?.({ code: m.code });
        }
      });
      try { await window.mt.ts.stream(cmd.id, v, streamId); } catch (e) { off(); runBtn.disabled = false; toast(e.message, { kind: 'err' }); }
      return;
    }
    let r;
    try { r = await window.mt.ts.run(cmd.id, v); } catch (e) { runBtn.disabled = false; clear(outBox).append(h('div.err-text', e.message)); return; }
    runBtn.disabled = false;
    renderResult(outBox, r, cmd);
    onResult?.(r);
    ts.poll();
  });
  cancelBtn.addEventListener('click', () => { if (streamId) window.mt.ts.cancel(streamId); });

  const fav = store.get('favoritesCli').includes(cmd.id);
  const star = h('button.icon-btn', { type: 'button', 'aria-pressed': String(fav), 'aria-label': pair('Favourite', '收藏'), on: { click: () => {
    const f = new Set(store.get('favoritesCli')); f.has(cmd.id) ? f.delete(cmd.id) : f.add(cmd.id); store.set('favoritesCli', [...f]);
    star.setAttribute('aria-pressed', String(f.has(cmd.id))); star.firstChild.classList.toggle('fill', f.has(cmd.id));
  } } }, icon('star', fav ? '.fill' : ''));

  refresh();
  const head = compact ? null : h('div.page-head',
    h('div.titles', h('div.eyebrow', 'tailscale ' + cmd.path.join(' ')), h('h1', pair(cmd.title, YUE_TITLES[cmd.id])), h('p', cmd.desc),
      h('div.row', cmd.platforms ? h('span.badge.info', cmd.platforms.map((p) => PLATFORM[p]).join(', ') + pair(' only', ' 限定')) : null, cmd.danger ? h('span.badge.' + (cmd.danger === 'hard' ? 'err' : 'warn'), cmd.danger === 'hard' ? pair('Destructive', '危險') : pair('Changes state', '會改狀態')) : null, h('span.badge.info', `${(cmd.flags || []).length} ${pair('flags', '個旗標')}`))), star);
  const reset = h('button.btn.text', { type: 'button', on: { click: () => { for (const [, c] of controls) { c.touched = false; } cards.forEach((c) => c.classList.remove('changed')); const fresh = commandForm(cmd, { compact, onResult }); root.replaceWith(fresh); } } }, icon('restart_alt'), t('reset'));
  const root = h('div.stack', head,
    h('div.cmd-layout',
      h('div.flags-grid.stagger', cards.length ? cards : h('div.empty', icon('bolt'), pair('This command has no options. Just run it.', '呢個指令冇選項，直接執行。'))),
      h('div.stack.preview',
        h('div.card', h('div.card-head', h('h3', t('pendingCommand')), h('button.icon-btn.sm', { type: 'button', 'aria-label': t('copy'), on: { click: () => { navigator.clipboard.writeText(preview.textContent.trim()); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy'))), preview, errBox,
          h('div.row', runBtn, cancelBtn, reset)),
        h('div.card', h('h3', t('output')), outBox))));
  return root;
}

export function renderResult(box, r, cmd) {
  clear(box);
  if (r.missing) {
    box.append(h('div.stack', h('span.badge.err', t('notInstalled')), h('div', t('tsMissing')), h('details', h('summary', pair('Places searched', '搵過嘅位置')), h('div.out', (r.searched || []).join('\n')))));
    sound('error');
    return;
  }
  const ok = r.code === 0;
  box.append(h('div.row', ok ? h('span.badge.ok', emoji('✅') + t('cmdOk')) : h('span.badge.err', emoji('🚨') + t('cmdFail', { code: r.code })), h('span.small.muted', `${r.ms} ms`),
    h('span.spacer'),
    h('button.icon-btn.sm', { type: 'button', 'aria-label': t('copy'), on: { click: () => { navigator.clipboard.writeText(r.stdout || r.stderr); toast(t('copied'), { kind: 'ok' }); } } }, icon('content_copy')),
    exportMenu(() => ({ name: `tailscale-${cmd?.id || 'output'}`, data: r.json ?? r.stdout, text: r.stdout }))));
  if (r.json !== undefined) box.append(h('div.out', jsonTree(r.json)));
  else if (r.stdout) box.append(h('div.out', r.stdout));
  if (r.stderr) box.append(h('div.out', h('span.err', r.stderr)));
  if (!r.stdout && !r.stderr) box.append(h('div.small.muted', pair('No output.', '冇輸出。')));
  sound(ok ? 'success' : 'error');
  if (!ok) toast(t('cmdFail', { code: r.code }) + (r.stderr ? ` ${r.stderr.trim().split('\n')[0]}` : ''), { kind: 'err', title: cmd?.title });
}
