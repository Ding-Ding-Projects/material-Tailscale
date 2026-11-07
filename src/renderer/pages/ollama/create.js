// Create section: make a new local model from an installed one with a guided Modelfile (system
// prompt and documented settings), see exactly what is sent, and copy a model under a new name.
import { h, icon, clear, append } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import { toast } from '../../ui/overlay.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const NAME = /^[a-z0-9][a-z0-9._-]{0,127}(:[A-Za-z0-9._-]{1,128})?$/;

export function createTab(ctx, suite) {
  const base = h('select.input', { 'aria-label': pair('Start from', '由邊個模型開始'), on: { change: () => preview() } });
  const name = h('input.input.mono', { 'aria-label': pair('New model name', '新模型名'), placeholder: 'tailnet-helper', on: { input: () => preview() } });
  const nameErr = h('div.small');
  const system = h('textarea.input', { 'aria-label': pair('System prompt', '系統提示'), style: { minHeight: '80px', fontFamily: 'var(--font-body)' }, placeholder: pair('How the new model should behave, in your own words.', '用你自己嘅說話寫低新模型應該點表現。'), on: { input: () => preview() } });
  const temp = h('input.slider', { type: 'range', min: 0, max: 2, step: 0.1, value: 0.6, 'aria-label': pair('Temperature', '隨機程度'), style: { width: '140px', '--p': '30%' }, on: { input: (e) => { tempOut.textContent = e.target.value; e.target.style.setProperty('--p', `${(Number(e.target.value) / 2) * 100}%`); preview(); } } });
  const tempOut = h('b.mono', '0.6');
  const ctxIn = h('input.input', { type: 'number', min: 256, max: 1048576, step: 256, value: 8192, 'aria-label': pair('Context length', '上下文長度'), style: { width: '110px' }, on: { input: () => preview() } });
  const out = h('div.out');
  const prog = h('div.small', { 'aria-live': 'polite' });
  const createBtn = h('button.btn', { type: 'button', on: { click: () => create() } }, icon('build'), pair('Create the model', '製作模型'));
  const reason = h('span.small.muted');
  const copyFrom = h('select.input', { 'aria-label': pair('Copy from', '由邊個複製') });
  const copyTo = h('input.input.mono', { 'aria-label': pair('New name', '新名'), placeholder: 'my-copy' });

  const body = () => ({ model: name.value.trim(), from: base.value, system: system.value.trim() || undefined, parameters: { temperature: Number(temp.value), num_ctx: Number(ctxIn.value) } });
  const preview = () => {
    const b = body();
    const taken = suite.installed.some((m) => m.name === b.model || m.name === b.model + ':latest');
    const valid = NAME.test(b.model);
    put(clear(nameErr), !b.model ? '' : !valid ? h('span.err-text', pair('Use lowercase letters, digits, dots and dashes, with one optional :tag.', '用細階字母、數字、點同橫線，可以加一個 :tag。')) : taken ? h('span.err-text', pair('A model with this name is already installed; pick another so nothing is replaced.', '已經有同名模型；揀第二個名，咁就唔會覆蓋。')) : h('span.muted', pair('This name is free.', '呢個名未用。')));
    const ctxOk = Number(ctxIn.value) >= 256 && Number(ctxIn.value) <= 1048576;
    out.textContent = `FROM ${b.from || '…'}\n${b.system ? `SYSTEM """${b.system}"""\n` : ''}PARAMETER temperature ${b.parameters.temperature}\nPARAMETER num_ctx ${b.parameters.num_ctx}`;
    const why = suite.rt?.state !== 'healthy' ? pair('Start Ollama on the Models section first.', '先喺模型分區啟動 Ollama。') : !b.from ? pair('Install a model to start from.', '先安裝一個起點模型。') : !valid || taken ? pair('Choose a free, valid name.', '揀一個未用而且有效嘅名。') : !ctxOk ? pair('The context must be between 256 and 1,048,576.', '上下文要喺 256 至 1,048,576 之間。') : '';
    createBtn.disabled = !!why; reason.textContent = why;
  };
  const create = async () => {
    const id = 'create-' + Date.now();
    const off = window.mt.ollama.onStream((m) => { if (m.id === id) prog.textContent = m.line?.status || ''; });
    createBtn.disabled = true;
    try { await window.mt.ollama.stream('create', body(), id); toast(pair(`${body().model} is ready.`, `${body().model} 整好咗。`), { kind: 'ok' }); prog.textContent = pair('Done. It is on the Models section now.', '完成，喺模型分區見到。'); suite.refresh(); }
    catch (e) { prog.textContent = ''; toast(e.message, { kind: 'err', title: pair('The model was not created', '模型冇整到') }); }
    finally { off(); preview(); }
  };
  const fill = () => {
    const usable = suite.installed.filter((m) => !(suite.caps[m.name]?.capabilities || []).includes('embedding'));
    const keep = suite.createFrom || base.value;
    put(clear(base), ...usable.map((m) => h('option', { value: m.name }, m.name)));
    if (keep && usable.some((m) => m.name === keep)) base.value = keep;
    suite.createFrom = null;
    put(clear(copyFrom), ...suite.installed.map((m) => h('option', { value: m.name }, m.name)));
    preview();
  };
  ctx.onCleanup(suite.on(fill));
  fill();
  return h('div.grid',
    h('section.card.span-7.stack', { dataset: { el: 'ollama-create' } }, h('div.card-head', h('span.ic', icon('build')), h('h2.h3', pair('Make a model from a Modelfile', '用 Modelfile 製作模型'))),
      h('div.flag-card', h('b', pair('Start from', '由邊個開始')), base, h('div.small.muted', pair('Only models on this computer are listed. The new model reuses its files, so it takes almost no extra space.', '只列出呢部電腦嘅模型。新模型共用佢嘅檔案，幾乎唔使額外空間。'))),
      h('div.flag-card', h('b', pair('Name', '名稱')), name, nameErr),
      h('div.flag-card', h('b', pair('System prompt', '系統提示')), system),
      h('div.flag-card', h('b', pair('Settings', '設定')), h('div.row', pair('Temperature', '隨機程度'), temp, tempOut, pair('Context', '上下文'), ctxIn), h('div.small.muted', pair('Recommended for a focused helper: temperature 0.6 and an 8,192-token context.', '專注助手建議：隨機程度 0.6、上下文 8,192。'))),
      h('div.row', createBtn, reason), prog),
    h('section.card.span-5.tonal.stack', h('div.card-head', h('span.ic.alt', icon('description')), h('h2.h3', pair('The Modelfile', 'Modelfile'))), out, h('div.small.muted', pair('This is exactly what is sent to Ollama.', '呢個就係傳俾 Ollama 嘅內容。'))),
    h('section.card.span-7.stack', h('div.card-head', h('span.ic', icon('content_copy')), h('h2.h3', pair('Copy a model', '複製模型'))),
      h('div.row', copyFrom, copyTo, h('button.btn.outline', { type: 'button', on: { click: async () => {
        const to = copyTo.value.trim();
        if (!NAME.test(to)) { toast(pair('Choose a valid new name.', '揀一個有效嘅新名。'), { kind: 'warn' }); return; }
        if (suite.installed.some((m) => m.name === to || m.name === to + ':latest')) { toast(pair('That name is taken; nothing was replaced.', '個名用咗；冇覆蓋任何嘢。'), { kind: 'warn' }); return; }
        try { await window.mt.ollama.call('copy', { source: copyFrom.value, destination: to }); toast(pair('Copied.', '已複製。'), { kind: 'ok' }); suite.refresh(); } catch (e) { toast(e.message, { kind: 'err' }); }
      } } }, icon('content_copy'), pair('Copy', '複製')))));
}
