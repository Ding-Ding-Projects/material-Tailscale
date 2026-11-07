// Chat section: local conversations with streamed replies, an editable system prompt and the
// documented model settings with recommended defaults, stop, regenerate, many saved
// conversations with search, rename, delete and export, and image attachments only for models
// whose reported capabilities include vision.
import { h, icon, clear, uid, append } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import { toast, dialog } from '../../ui/overlay.js';
import { superConfirm } from '../../ui/safety.js';
import { regexField } from '../../ui/regex.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const REC = { temperature: 0.8, num_ctx: 8192, top_p: 0.9 };
const newSession = (model) => ({ id: `${uid('chat')}-${Date.now().toString(36)}`, title: pair('New conversation', '新對話'), model, system: '', options: { ...REC }, messages: [], createdAt: new Date().toISOString() });

export function chatTab(ctx, suite) {
  let sessions = [];
  let cur = null;
  let streaming = null; // stream id while a reply is being written
  let images = [];      // Base64 images attached to the next message (kept in memory only)
  const listBox = h('div.chat-sessions');
  const log = h('div.chat-log', { 'aria-live': 'polite' });
  const search = regexField({ id: 'ollama-chats', placeholder: pair('Search chats', '搜尋對話'), onChange: () => drawList() });
  const modelSel = h('select.input', { 'aria-label': pair('Model', '模型'), style: { width: 'auto', minWidth: '200px' }, on: { change: () => { cur.model = modelSel.value; drawCaps(); save(); } } });
  const system = h('textarea.input', { 'aria-label': pair('System prompt', '系統提示'), placeholder: pair('Optional: how the model should behave in this conversation.', '可選：呢段對話入面模型應該點表現。'), style: { minHeight: '60px', fontFamily: 'var(--font-body)' }, on: { change: () => { cur.system = system.value; save(); } } });
  const num = (key, min, max, step, label) => h('input.input', { type: 'number', min, max, step, 'aria-label': label, style: { width: '96px' }, on: { change: (e) => { const v = Number(e.target.value); if (e.target.value === '') delete cur.options[key]; else if (Number.isFinite(v) && v >= min && v <= max) cur.options[key] = v; else { e.target.value = cur.options[key] ?? ''; toast(pair(`${label} must be between ${min} and ${max}.`, `${label} 要喺 ${min} 至 ${max} 之間。`), { kind: 'warn' }); } save(); } } });
  const temp = h('input.slider', { type: 'range', min: 0, max: 2, step: 0.1, 'aria-label': pair('Temperature', '隨機程度'), style: { width: '140px' }, on: { input: (e) => { cur.options.temperature = Number(e.target.value); tempOut.textContent = e.target.value; e.target.style.setProperty('--p', `${(Number(e.target.value) / 2) * 100}%`); save(); } } });
  const tempOut = h('b.mono');
  const ctxIn = num('num_ctx', 256, 1048576, 256, pair('Context length', '上下文長度'));
  const seedIn = num('seed', 0, 2147483647, 1, pair('Seed', '種子'));
  const topP = num('top_p', 0, 1, 0.05, 'top_p');
  const capNote = h('div.small.muted');
  const prompt = h('textarea.input', { 'aria-label': pair('Message', '訊息'), placeholder: pair('Ask something… (Ctrl+Enter sends)', '問啲嘢…（Ctrl+Enter 傳送）'), on: { keydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } } } });
  const attachBtn = h('button.icon-btn', { type: 'button', on: { click: () => attach() } }, icon('image'));
  const attachInfo = h('span.small');
  const sendBtn = h('button.btn', { type: 'button', on: { click: () => send() } }, icon('send'), pair('Send', '傳送'));
  const stopBtn = h('button.btn.outline', { type: 'button', hidden: true, on: { click: () => { if (streaming) window.mt.ollama.cancel(streaming); } } }, icon('stop'), pair('Stop', '停'));
  const regenBtn = h('button.btn.text', { type: 'button', on: { click: () => regenerate() } }, icon('refresh'), pair('Regenerate', '重新作答'));

  const caps = () => suite.caps[cur?.model]?.capabilities || [];
  const save = () => { if (cur && (cur.messages.length || cur.system)) window.mt.ollama.saveChat(cur).then((s) => { cur.updatedAt = s.updatedAt; sessions = [s, ...sessions.filter((x) => x.id !== s.id)]; drawList(); }).catch((e) => toast(e.message, { kind: 'err' })); };
  const drawCaps = () => {
    const vision = caps().includes('vision');
    attachBtn.disabled = !vision;
    const reason = vision ? pair('Attach up to four images', '最多夾四張圖') : pair(`${cur?.model || 'This model'} cannot read images. Pick a model with "vision" in the store.`, `${cur?.model || '呢個模型'} 睇唔到圖。喺商店揀有 "vision" 嘅模型。`);
    attachBtn.setAttribute('aria-label', reason); attachBtn.title = reason;
    put(clear(capNote), vision ? '' : [icon('info'), ' ', reason, ' ', h('button.btn.small.text', { type: 'button', on: { click: () => suite.go('store') } }, icon('visibility'), pair('Open the store', '打開商店'))]);
    const max = suite.caps[cur?.model]?.contextLength;
    ctxIn.max = max || 1048576;
  };
  const drawModels = () => {
    const usable = suite.installed.filter((m) => !(suite.caps[m.name]?.capabilities || []).includes('embedding'));
    put(clear(modelSel), ...usable.map((m) => h('option', { value: m.name }, m.name)));
    if (cur && !cur.model && usable.length) cur.model = suite.chatModel || usable[0].name;
    if (cur) modelSel.value = cur.model || '';
    if (suite.chatModel && cur && !cur.messages.length) { cur.model = suite.chatModel; modelSel.value = cur.model; suite.chatModel = null; }
    drawCaps();
  };
  const drawSettings = () => {
    system.value = cur.system || '';
    temp.value = cur.options.temperature ?? REC.temperature; tempOut.textContent = temp.value; temp.style.setProperty('--p', `${(Number(temp.value) / 2) * 100}%`);
    ctxIn.value = cur.options.num_ctx ?? ''; seedIn.value = cur.options.seed ?? ''; topP.value = cur.options.top_p ?? '';
  };
  const bubble = (m) => h(`div.msg${m.role === 'user' ? '.user' : ''}`, h('span.who', m.role === 'user' ? pair('You', '你') : (m.model || cur.model || pair('Model', '模型')), m.images ? pair(` · ${m.images} image${m.images > 1 ? 's' : ''}`, ` · ${m.images} 張圖`) : ''), m.content);
  const drawLog = () => {
    clear(log);
    if (!cur.messages.length) put(log, h('div.empty.small', icon('forum'), pair('Start the conversation below. Everything stays on this computer.', '喺下面開始對話。所有嘢都留喺呢部電腦。')));
    for (const m of cur.messages) put(log, bubble(m));
  };
  const drawList = () => {
    const { q, re } = search.value();
    let test = (x) => !q || `${x.title}\n${x.messages.map((m) => m.content).join('\n')}`.toLowerCase().includes(q.toLowerCase());
    if (re && q) { try { const r = new RegExp(q, 'i'); test = (x) => r.test(`${x.title}\n${x.messages.map((m) => m.content).join('\n')}`); } catch { test = () => false; } }
    const shown = sessions.filter(test);
    put(clear(listBox), ...shown.map((s) => h('button.pick-row', { type: 'button', 'aria-current': String(s.id === cur?.id), on: { click: () => open(s) } }, h('span.ava', icon('chat')), h('span.meta', h('b', s.title), h('span', `${s.model || ''} · ${new Date(s.updatedAt || s.createdAt).toLocaleDateString()}`)))));
    if (!shown.length) put(listBox, h('div.small.muted', sessions.length ? pair('No conversation matches.', '冇對話符合。') : pair('No saved conversations yet.', '未有儲存嘅對話。')));
  };
  const open = (s) => { cur = { ...s, options: { ...s.options }, messages: s.messages.map((m) => ({ ...m })) }; images = []; attachInfo.textContent = ''; drawModels(); drawSettings(); drawLog(); drawList(); };
  const fresh = () => open(newSession(suite.chatModel || suite.installed[0]?.name || null));

  const attach = async () => {
    const files = await window.mt.dialog.open({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], title: pair('Attach images', '夾圖') });
    if (!files) return;
    images = [];
    for (const f of files.slice(0, 4)) {
      try { const b64 = await window.mt.fs.readBytes(f); if (b64.length > 14 * 1024 * 1024) { toast(pair('An image is larger than 10 MB and was left out.', '有張圖大過 10 MB，冇夾到。'), { kind: 'warn' }); continue; } images.push(b64); } catch (e) { toast(e.message, { kind: 'err' }); }
    }
    attachInfo.textContent = images.length ? pair(`${images.length} image${images.length > 1 ? 's' : ''} attached`, `夾咗 ${images.length} 張圖`) : '';
  };

  const reply = async () => {
    const id = uid('olchat');
    const live = { role: 'assistant', content: '', model: cur.model };
    const el = bubble(live); put(log, el);
    const textNode = el.lastChild;
    streaming = id; sendBtn.hidden = true; stopBtn.hidden = false; regenBtn.disabled = true;
    const off = window.mt.ollama.onStream((msg) => { if (msg.id !== id) return; live.content += msg.line?.message?.content || ''; textNode.textContent = live.content; el.scrollIntoView({ block: 'nearest' }); });
    const msgs = [...(cur.system ? [{ role: 'system', content: cur.system }] : []), ...cur.messages.map((m, i) => ({ role: m.role, content: m.content, ...(i === cur.messages.length - 1 && images.length ? { images } : {}) }))];
    try {
      await window.mt.ollama.stream('chat', { model: cur.model, messages: msgs, options: cur.options }, id);
      cur.messages.push({ role: 'assistant', content: live.content, at: new Date().toISOString() });
    } catch (e) {
      if (e.code === 'CANCELLED' || /Stopped/.test(e.message)) { cur.messages.push({ role: 'assistant', content: live.content + pair(' [stopped]', '［已停］'), at: new Date().toISOString() }); }
      else { el.remove(); toast(e.message, { kind: 'err', title: pair('The model did not answer', '模型冇回應') }); }
    } finally {
      off(); streaming = null; sendBtn.hidden = false; stopBtn.hidden = true; regenBtn.disabled = false;
      images = []; attachInfo.textContent = '';
      if (cur.messages.length === 2 && cur.title === pair('New conversation', '新對話')) cur.title = cur.messages[0].content.slice(0, 60);
      drawLog(); save();
    }
  };
  const send = async () => {
    const text = prompt.value.trim();
    if (!text || streaming) return;
    if (suite.rt?.state !== 'healthy') { toast(pair('Ollama is not running. Start it on the Models section.', 'Ollama 未運行，喺模型分區啟動佢。'), { kind: 'warn' }); return; }
    if (!cur.model) { toast(pair('Install a chat model first; the store lists them.', '先安裝一個對話模型；商店有晒。'), { kind: 'warn' }); return; }
    if (text.length > 64 * 1024) { toast(pair('A message can be at most 64 KB.', '一段訊息最多 64 KB。'), { kind: 'warn' }); return; }
    cur.messages.push({ role: 'user', content: text, images: images.length, at: new Date().toISOString() });
    prompt.value = '';
    drawLog();
    await reply();
  };
  const regenerate = async () => {
    if (streaming || !cur.messages.length) return;
    if (cur.messages[cur.messages.length - 1].role === 'assistant') cur.messages.pop();
    drawLog();
    await reply();
  };
  const exportDialog = () => {
    let format = 'md', which = 'this';
    const pick = (opts, v, set) => { const el = h('div.seg', { role: 'radiogroup' }, opts.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === v), on: { click: (e) => { set(k); for (const b of el.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); } } }, l))); return el; };
    dialog({ title: pair('Export conversations', '匯出對話'), body: h('div.stack', pick([['this', pair('This conversation', '呢段對話')], ['all', pair('Every conversation', '所有對話')]], which, (k) => { which = k; }), pick([['md', 'Markdown'], ['json', 'JSON']], format, (k) => { format = k; }),
      h('div.small.muted', pair('Only the words, the model names and the settings are exported. Images and file paths never are.', '只會匯出文字、模型名同設定，圖片同檔案路徑唔會匯出。'))),
    actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Save', '儲存'), run: async () => {
      const text = await window.mt.ollama.exportChats(which === 'this' ? [cur.id] : [], format);
      const p = await window.mt.dialog.save({ defaultPath: `ollama-chats.${format}` });
      if (!p) return false;
      await window.mt.fs.writeText(p, text); toast(pair('Exported.', '已匯出。'), { kind: 'ok' });
    } }] });
  };
  const rename = () => {
    const input = h('input.input', { value: cur.title, 'aria-label': pair('Name', '名稱') });
    dialog({ title: pair('Rename the conversation', '改對話名'), body: input, actions: [{ label: pair('Cancel', '取消'), kind: 'text', value: null }, { label: pair('Rename', '改名'), run: () => { cur.title = input.value.trim().slice(0, 120) || cur.title; save(); drawList(); } }] });
  };
  const remove = async () => {
    if (!cur || !sessions.some((s) => s.id === cur.id)) { fresh(); return; }
    if (!(await superConfirm({ action: pair(`Delete the conversation "${cur.title}"`, `刪除對話「${cur.title}」`), affects: pair(`${cur.messages.length} messages`, `${cur.messages.length} 段訊息`) }))) return;
    await window.mt.ollama.deleteChat(cur.id);
    sessions = sessions.filter((s) => s.id !== cur.id); fresh();
  };

  ctx.onCleanup(suite.on(() => drawModels()));
  ctx.onCleanup(() => { if (streaming) window.mt.ollama.cancel(streaming); });
  window.mt.ollama.chats().then((c) => { sessions = c.sessions || []; drawList(); });
  fresh();
  return h('div.chat-layout',
    h('section.card.stack', { dataset: { el: 'ollama-sessions' } }, h('div.card-head', h('span.ic', icon('history')), h('h2.h3', pair('Conversations', '對話')), h('button.icon-btn', { type: 'button', 'aria-label': pair('New conversation', '新對話'), title: pair('New conversation', '新對話'), on: { click: fresh } }, icon('add'))),
      search.el, listBox,
      h('div.row', h('button.btn.small.text', { type: 'button', on: { click: rename } }, icon('edit'), pair('Rename', '改名')), h('button.btn.small.text', { type: 'button', on: { click: remove } }, icon('delete'), pair('Delete', '刪除')), h('button.btn.small.text', { type: 'button', on: { click: exportDialog } }, icon('ios_share'), pair('Export', '匯出')))),
    h('section.card.stack', { dataset: { el: 'ollama-chat' } },
      h('div.row', modelSel, h('span.small.muted', pair('Replies are written on this computer by the model you pick.', '回覆由你揀嘅模型喺呢部電腦寫出嚟。'))),
      h('details.feature-more', h('summary', pair('System prompt and settings', '系統提示同設定')),
        h('div.stack.small', { style: { marginTop: '8px' } }, system,
          h('div.row', pair('Temperature', '隨機程度'), temp, tempOut, pair('Context', '上下文'), ctxIn, 'top_p', topP, pair('Seed', '種子'), seedIn),
          h('div.row', h('span.muted', pair('Recommended for chat: temperature 0.8, context 8,192, top_p 0.9. Empty seed means a different reply each time.', '對話建議：隨機程度 0.8、上下文 8,192、top_p 0.9。種子留空每次答案都唔同。')),
            h('button.btn.small.text', { type: 'button', on: { click: () => { cur.options = { ...REC }; drawSettings(); save(); } } }, icon('restart_alt'), pair('Use recommended', '用建議值'))))),
      log,
      h('div.composer', prompt, h('div.row', attachBtn, stopBtn, sendBtn, regenBtn)), attachInfo, capNote));
}
