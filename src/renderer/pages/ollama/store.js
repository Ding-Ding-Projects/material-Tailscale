// Store section: every model and every tag in Ollama's official library, read in full at each
// refresh, combined with what is installed here, searchable with plain text or a regular
// expression, filtered by capability, fit and installed state, with an evidence-backed fit
// verdict for every tag and a download cart that only lines up local downloads.
import { h, icon, clear, fmtBytes, fmtAgo, append } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import * as store from '../../core/store.js';
import { toast } from '../../ui/overlay.js';
import { withProgress } from '../../ui/jobs.js';
import { regexField } from '../../ui/regex.js';
import FIT from '../../../shared/ollama-fit.js';

/** Appends children, skipping null, false and undefined. */
const put = (el, ...kids) => append(el, kids);

const TONE = { 'Runs well': 'ok', 'Runs with limits': 'warn', Unlikely: 'err', Unknown: '' };
const VERDICT_YUE = { 'Runs well': '行得好順', 'Runs with limits': '行到但有限制', Unlikely: '應該行唔到', Unknown: '未知' };
const verdictLabel = (v) => pair(v, VERDICT_YUE[v]);
const SORTS = [['pulls', pair('Most downloaded', '最多人下載')], ['name', pair('Name', '名稱')], ['small', pair('Smallest download', '最細下載')]];
const pullsNum = (p) => { const m = /^([\d.]+)([KMB]?)$/.exec(p || ''); return m ? Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1) : 0; };

export function storeTab(ctx, suite) {
  let catalogue = null;
  const f = { caps: new Set(), fit: 'any', installedOnly: false, sort: 'pulls', shown: 30 };
  const opened = new Set();
  const status = h('div.small.muted', { role: 'status', 'aria-live': 'polite' });
  const list = h('div.stack');
  const cartBox = h('div.stack');
  const queueBox = h('div.stack');
  const capRow = h('div.suggest', { role: 'group', 'aria-label': pair('Capabilities', '能力') });
  const search = regexField({ id: 'ollama-store', placeholder: pair('Search every model and tag', '搜尋所有模型同標籤'), onChange: () => { f.shown = 30; draw(); } });
  const fitOpts = () => store.get('ollamaFit') || { numCtx: 4096, perK: 0.125 };
  const fitFor = (t) => FIT.fit(t, suite.hw, { numCtx: fitOpts().numCtx, perK: fitOpts().perK * 1e9 });
  const cart = () => store.get('ollamaCart') || [];
  const setCart = (c) => { store.set('ollamaCart', c, { record: false }); drawCart(); draw(); };
  const installedNames = () => new Set(suite.installed.map((m) => m.name));
  const isInstalled = (tag, inst) => inst.has(tag) || (tag.endsWith(':latest') && inst.has(tag)) || inst.has(tag.replace(/:latest$/, ''));

  const fitSeg = h('div.seg', { role: 'radiogroup', 'aria-label': pair('Fit', '適合程度') }, [['any', pair('Any fit', '全部')], ['well', pair('Runs well', '行得好順')], ['limits', pair('Runs at all', '行得到')]].map(([k, l]) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(f.fit === k), on: { click: (e) => { f.fit = k; for (const b of fitSeg.children) b.setAttribute('aria-checked', String(b === e.currentTarget)); f.shown = 30; draw(); } } }, l)));
  const instChip = h('button.chip.choice', { type: 'button', 'aria-pressed': 'false', on: { click: () => { f.installedOnly = !f.installedOnly; instChip.setAttribute('aria-pressed', String(f.installedOnly)); draw(); } } }, icon('download_done'), pair('Installed only', '只睇已安裝'));
  const sortSel = h('select.input', { 'aria-label': pair('Sort', '排序'), style: { width: 'auto' }, on: { change: (e) => { f.sort = e.target.value; draw(); } } }, SORTS.map(([v, l]) => h('option', { value: v }, l)));

  const ctxStep = h('input.input', { type: 'number', min: 256, max: 1048576, step: 256, value: fitOpts().numCtx, style: { width: '110px' }, 'aria-label': pair('Context you will use, in tokens', '你會用嘅上下文長度（token）'), on: { change: (e) => { const v = Math.max(256, Math.min(1048576, Number(e.target.value) || 4096)); e.target.value = v; store.set('ollamaFit', { ...fitOpts(), numCtx: v }, { record: false }); draw(); } } });
  const perKStep = h('input.input', { type: 'number', min: 0.01, max: 2, step: 0.005, value: fitOpts().perK, style: { width: '90px' }, 'aria-label': pair('Memory per 1,024 tokens of context, in GB', '每 1,024 token 上下文用幾多 GB'), on: { change: (e) => { const v = Math.max(0.01, Math.min(2, Number(e.target.value) || 0.125)); e.target.value = v; store.set('ollamaFit', { ...fitOpts(), perK: v }, { record: false }); draw(); } } });

  const fitBadge = (t) => {
    const r = fitFor(t);
    const det = h('details.fit-detail', h('summary', h(`span.badge${TONE[r.verdict] ? '.' + TONE[r.verdict] : ''}`, verdictLabel(r.verdict))),
      h('ul.fit-why', ...r.evidence.map((x) => h('li', x)), ...r.assumptions.map((x) => h('li.muted', x))));
    return { el: det, verdict: r.verdict };
  };
  const tagMatches = (m, t) => {
    const { q, re } = search.value();
    if (!q) return true;
    const hay = `${m.name}\n${m.description}\n${t.tag}\n${t.inputs.join(' ')}\n${m.capabilities.join(' ')}`;
    if (re) { try { return new RegExp(q, 'i').test(hay); } catch { return false; } }
    return hay.toLowerCase().includes(q.toLowerCase());
  };

  const tagRow = (m, t, inst) => {
    const fb = fitBadge(t);
    const have = isInstalled(t.tag, inst);
    const inCart = cart().includes(t.tag);
    return h('tr', h('td', h('b.mono', t.tag), t.digest ? h('div.small.muted.mono', t.digest) : null), h('td.mono', t.sizeText || '—'), h('td.mono', t.contextText || '—'), h('td.small', t.inputs.join(', ') || '—'), h('td', fb.el),
      h('td', have ? h('span.badge.ok', icon('download_done'), pair('Installed', '已安裝'))
        : h(`button.btn.small${inCart ? '.text' : fb.verdict === 'Unlikely' ? '.outline' : '.tonal'}`, { type: 'button', on: { click: () => setCart(inCart ? cart().filter((x) => x !== t.tag) : [...cart(), t.tag]) } }, icon(inCart ? 'remove_shopping_cart' : 'add_shopping_cart'), inCart ? pair('In cart', '已加入') : fb.verdict === 'Unlikely' ? pair('Add anyway', '照樣加入') : pair('Add to cart', '加入購物車'))));
  };

  const draw = () => {
    clear(list);
    if (!catalogue) { put(list, h('div.empty', icon('cloud_download'), h('p', pair('The catalogue has not been read on this computer yet. Reading it needs the internet once; after that it works offline.', '呢部電腦未讀過目錄。第一次要上網，之後離線都用到。')), h('button.btn', { type: 'button', on: { click: refresh } }, icon('refresh'), pair('Read the catalogue', '讀取目錄')))); return; }
    const inst = installedNames();
    const fitOk = (v) => f.fit === 'any' || (f.fit === 'well' ? v === 'Runs well' : v === 'Runs well' || v === 'Runs with limits');
    let models = catalogue.models.map((m) => ({ m, tags: (m.tags || []).filter((t) => tagMatches(m, t) && (!f.installedOnly || isInstalled(t.tag, inst)) && (f.fit === 'any' || fitOk(fitFor(t).verdict))) }))
      .filter(({ m, tags }) => tags.length && [...f.caps].every((c) => m.capabilities.includes(c)));
    // Installed models that the catalogue does not list (made here, or from elsewhere) still show.
    const known = new Set(catalogue.models.flatMap((m) => (m.tags || []).map((t) => t.tag)));
    const extra = suite.installed.filter((x) => !known.has(x.name) && !known.has(x.name.replace(/:latest$/, ''))).map((x) => ({ m: { name: x.name, description: pair('Installed here; not in the official catalogue (made or copied on this computer, or from another registry).', '喺呢度安裝；唔喺官方目錄（喺呢部電腦製作或者複製，或者來自其他地方）。'), capabilities: [], sizes: [], pulls: null }, tags: [{ tag: x.name, digest: (x.digest || '').slice(0, 12), size: x.size, sizeText: fmtBytes(x.size), context: null, contextText: null, inputs: [] }] }))
      .filter(({ m, tags }) => !f.caps.size && tagMatches(m, tags[0]));
    models = [...extra, ...models];
    if (f.sort === 'name') models.sort((a, b) => a.m.name.localeCompare(b.m.name));
    else if (f.sort === 'small') models.sort((a, b) => Math.min(...a.tags.map((t) => t.size || Infinity)) - Math.min(...b.tags.map((t) => t.size || Infinity)));
    else models.sort((a, b) => pullsNum(b.m.pulls) - pullsNum(a.m.pulls));
    const tagTotal = models.reduce((n, x) => n + x.tags.length, 0);
    put(list, h('div.small', pair(`${models.length} models and ${tagTotal.toLocaleString('en-US')} tags match.`, `${models.length} 個模型、${tagTotal} 個標籤符合。`)));
    if (!models.length) { put(list, h('div.empty', icon('search_off'), h('p', pair('Nothing matches the search and filters.', '冇嘢符合搜尋同篩選。')), h('button.btn.small.tonal', { type: 'button', on: { click: () => { search.set(''); f.caps.clear(); f.fit = 'any'; f.installedOnly = false; drawCaps(); draw(); } } }, pair('Show everything', '顯示全部')))); return; }
    for (const { m, tags } of models.slice(0, f.shown)) {
      const open = opened.has(m.name);
      const shownTags = open ? tags : tags.slice(0, 4);
      put(list, h('section.stack', { dataset: { el: `store-model-${m.name}` }, style: { paddingTop: '8px', borderTop: '1px solid var(--outline-soft)' } },
        h('div.model-head', h('span.ava', icon('smart_toy')), h('div.meta', h('b', m.name), h('span.small', m.description),
          h('div.suggest', ...m.capabilities.map((c) => h('span.chip', c)), ...m.sizes.map((x) => h('span.chip', x)), m.pulls ? h('span.chip', icon('download'), pair(`${m.pulls} pulls`, `${m.pulls} 次下載`)) : null))),
        h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', [pair('Tag', '標籤'), pair('Download', '下載'), pair('Context', '上下文'), pair('Input', '輸入'), pair('Fit', '適合'), ''].map((x) => h('th', x)))), h('tbody', shownTags.map((t) => tagRow(m, t, inst))))),
        tags.length > 4 ? h('div.row', h('button.btn.small.text', { type: 'button', on: { click: () => { if (open) opened.delete(m.name); else opened.add(m.name); draw(); } } }, icon(open ? 'expand_less' : 'expand_more'), open ? pair('Show fewer tags', '顯示少啲') : pair(`Show all ${tags.length} tags`, `顯示全部 ${tags.length} 個標籤`))) : null));
    }
    if (models.length > f.shown) put(list, h('div.row', h('button.btn.outline', { type: 'button', on: { click: () => { f.shown += 30; draw(); } } }, icon('expand_more'), pair(`Show 30 more of ${models.length - f.shown}`, `再顯示 30 個（仲有 ${models.length - f.shown} 個）`))));
  };

  const drawCaps = () => {
    const all = catalogue ? [...new Set(catalogue.models.flatMap((m) => m.capabilities))].sort() : [];
    put(clear(capRow), ...all.map((c) => h('button.chip.choice', { type: 'button', 'aria-pressed': String(f.caps.has(c)), on: { click: () => { if (f.caps.has(c)) f.caps.delete(c); else f.caps.add(c); drawCaps(); f.shown = 30; draw(); } } }, c)));
  };
  const drawStatus = () => {
    if (!catalogue) { status.textContent = pair('No catalogue yet.', '未有目錄。'); return; }
    const age = (Date.now() - new Date(catalogue.fetchedAt)) / 86400000;
    status.replaceChildren(icon(catalogue.complete ? 'cloud_done' : 'cloud_off'), ' ',
      pair(`${catalogue.modelCount} models and ${catalogue.tagCount.toLocaleString('en-US')} tags from ollama.com, read ${fmtAgo(catalogue.fetchedAt)}. ${catalogue.complete ? `Every one of the ${catalogue.pages} pages was read.` : `${catalogue.failures.length} of ${catalogue.pages} pages could not be read (${catalogue.failures.slice(0, 5).join(', ')}${catalogue.failures.length > 5 ? '…' : ''}).`} Revision ${catalogue.revision}.`,
        `${catalogue.modelCount} 個模型、${catalogue.tagCount} 個標籤，${fmtAgo(catalogue.fetchedAt)}讀取。${catalogue.complete ? `${catalogue.pages} 頁全部讀晒。` : `${catalogue.pages} 頁入面有 ${catalogue.failures.length} 頁讀唔到。`}`),
      age > 7 ? h('span.badge.warn', { style: { marginLeft: '6px' } }, pair('More than a week old', '超過一個禮拜')) : '');
  };
  const refresh = () => withProgress(pair('Read the whole Ollama catalogue', '讀取成個 Ollama 目錄'), (job) => window.mt.ollama.refreshCatalog(job), {
    onDone: (r, b) => { if (r) { catalogue = r; put(b, h('p', r.complete ? pair(`Every page read: ${r.modelCount} models and ${r.tagCount} tags.`, `全部讀晒：${r.modelCount} 個模型、${r.tagCount} 個標籤。`) : pair(`${r.failures.length} pages could not be read, so the last complete catalogue stays saved; what was read is shown.`, `有 ${r.failures.length} 頁讀唔到，所以保留上次完整嘅目錄。`))); drawCaps(); drawStatus(); draw(); } }
  });

  const drawCart = () => {
    const c = cart();
    clear(cartBox);
    if (!c.length) { put(cartBox, h('div.small.muted', pair('Add tags from the list. Nothing downloads until you start it here.', '喺清單加標籤；喺度開始先會下載。'))); return; }
    const sizes = c.map((tag) => catalogue?.models.flatMap((m) => m.tags || []).find((t) => t.tag === tag) || { tag, size: null });
    const total = sizes.reduce((n, t) => n + (t.size || 0), 0);
    const unknown = sizes.filter((t) => !t.size).length;
    const free = suite.hw?.disk?.free;
    put(cartBox, ...sizes.map((t) => { const r = fitFor(t); return h('div.cart-line', h('div', h('b.mono.small', t.tag), h('div', h(`span.badge${TONE[r.verdict] ? '.' + TONE[r.verdict] : ''}`, verdictLabel(r.verdict)))), h('span.small', t.sizeText || '—'), h('button.icon-btn.sm', { type: 'button', 'aria-label': pair(`Remove ${t.tag}`, `移除 ${t.tag}`), on: { click: () => setCart(c.filter((x) => x !== t.tag)) } }, icon('close'))); }),
      h('div.stack.small', { style: { marginTop: '10px' } },
        h('div', pair(`Download: ${fmtBytes(total)}${unknown ? ` plus ${unknown} of unknown size` : ''}, from registry.ollama.ai over the internet.`, `下載：${fmtBytes(total)}，經互聯網由 registry.ollama.ai 下載。`)),
        h('div', pair(`Space needed: ${fmtBytes(total)} · free now: ${free === null || free === undefined ? 'unknown' : fmtBytes(free)}`, `需要空間：${fmtBytes(total)} · 而家有：${free == null ? '未知' : fmtBytes(free)}`)),
        free !== null && free !== undefined && total > free ? h('div.err-text', pair('That is more than the free space where models are kept. Remove something first.', '超過放模型嘅可用空間，請先移除啲嘢。')) : null),
      h('div.row', h('button.btn', { type: 'button', disabled: suite.rt?.state !== 'healthy' || (free != null && total > free), title: suite.rt?.state !== 'healthy' ? pair('Start Ollama on the Models section first.', '先喺模型分區啟動 Ollama。') : '', on: { click: async () => { try { await window.mt.ollama.enqueue(c); setCart([]); toast(pair('Downloads started.', '開始下載。'), { kind: 'ok' }); } catch (e) { toast(e.message, { kind: 'err' }); } } } }, icon('download'), pair(`Download ${c.length} model${c.length > 1 ? 's' : ''}`, `下載 ${c.length} 個模型`)),
        suite.rt?.state !== 'healthy' ? h('span.small.muted', pair('Start Ollama on the Models section first.', '先喺模型分區啟動 Ollama。')) : null));
  };
  const drawQueue = (q) => {
    clear(queueBox);
    if (!q?.items.length) return;
    const parallel = h('input.input', { type: 'number', min: 1, max: 3, value: q.parallel, style: { width: '64px' }, 'aria-label': pair('Downloads at once', '同時下載數'), on: { change: (e) => window.mt.ollama.setParallel(Number(e.target.value)) } });
    put(queueBox, h('div.row', h('b', pair('Downloads', '下載')), h('span.small', pair('At once', '同時')), parallel, h('button.btn.small.text', { type: 'button', on: { click: () => window.mt.ollama.clearPulls() } }, pair('Clear finished', '清除已完成'))),
      ...q.items.slice().reverse().slice(0, 20).map((it) => {
        const pct = it.total ? Math.round((it.completed / it.total) * 100) : null;
        const tone = { done: 'ok', failed: 'err', cancelled: '', interrupted: 'warn', running: 'info', queued: '' }[it.state];
        return h('div.stack', { style: { padding: '6px 0', borderBottom: '1px solid var(--outline-soft)' } },
          h('div.row.nowrap', h('b.mono.small', { style: { flex: 1, overflowWrap: 'anywhere' } }, it.tag), h(`span.badge${tone ? '.' + tone : ''}`, it.state),
            it.state === 'running' || it.state === 'queued' ? h('button.icon-btn.sm', { type: 'button', 'aria-label': pair(`Cancel ${it.tag}`, `取消 ${it.tag}`), on: { click: () => window.mt.ollama.cancelPull(it.id) } }, icon('close')) : null,
            ['failed', 'cancelled', 'interrupted'].includes(it.state) ? h('button.icon-btn.sm', { type: 'button', 'aria-label': pair(`Retry ${it.tag}`, `重試 ${it.tag}`), on: { click: () => window.mt.ollama.retryPull(it.id) } }, icon('refresh')) : null),
          it.state === 'running' ? h('div.sc-progress', { role: 'progressbar', 'aria-valuenow': pct ?? 0, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': pair('Download progress', '下載進度') }, h('i', { style: { width: `${Math.max(2, pct ?? 2)}%` } })) : null,
          h('div.small.muted', `${it.status}${it.total ? ` · ${fmtBytes(it.completed)} / ${fmtBytes(it.total)}` : ''}`), it.error ? h('div.small.err-text', it.error) : null);
      }));
    const done = q.items.filter((x) => x.state === 'done').length;
    if (doneSeen !== null && done > doneSeen) suite.refresh();
    doneSeen = done;
  };
  let doneSeen = null;

  window.mt.ollama.catalog().then((c) => { catalogue = c; drawCaps(); drawStatus(); draw(); drawCart(); });
  window.mt.ollama.pulls().then(drawQueue);
  ctx.onCleanup(window.mt.ollama.onPulls(drawQueue));
  ctx.onCleanup(suite.on(() => { draw(); drawCart(); }));
  draw(); drawCart();
  return h('div.grid',
    h('section.card.span-8.stack', { dataset: { el: 'ollama-store' } },
      h('div.row', search.el, fitSeg, sortSel), h('div.row', capRow, instChip), h('div.row', status, h('button.btn.small.text', { type: 'button', on: { click: refresh } }, icon('refresh'), pair('Refresh', '重新整理'))),
      h('details.feature-more', h('summary', pair('Fit check settings', '適合程度設定')), h('div.row.small', { style: { marginTop: '8px' } }, pair('Context you will use', '會用嘅上下文'), ctxStep, pair('tokens · memory per 1,024 tokens', 'token · 每 1,024 token 記憶體'), perKStep, 'GB'),
        h('div.small.muted', pair('Each verdict counts the download size, this context and 0.5 GB for the runtime against this computer\'s video memory, memory and free disk. Open a verdict to see the numbers.', '每個判斷都會用下載大小、呢個上下文同 0.5 GB 執行空間，對比顯示記憶體、記憶體同磁碟空間。撳個判斷睇數字。'))),
      list),
    h('aside.card.span-4.cart.stack', { dataset: { el: 'ollama-cart' } }, h('div.card-head', h('span.ic', icon('shopping_cart')), h('h3', pair('Download cart', '下載購物車'))),
      h('div.small.muted', pair('No price, no account: the cart only lines up downloads to this computer.', '冇價錢、唔使帳戶：購物車只係排隊下載去呢部電腦。')), cartBox, queueBox));
}
