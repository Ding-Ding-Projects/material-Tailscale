// Ollama suite page: a hero with the runtime's live state, then six sections (Models, Store,
// Chat, Create, Harnesses, Help). All requests to Ollama go through the main process, which
// allows only Ollama's documented local endpoints (src/main/ollama.js).
import { h, icon, clear } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import * as store from '../../core/store.js';
import { registerPage } from '../../ui/shell.js';
import { pageHero, heroStats } from '../../ui/hero.js';
import { mtabs } from '../../ui/mtabs.js';
import { modelsTab } from './models.js';
import { storeTab } from './store.js';
import { chatTab } from './chat.js';
import { createTab } from './create.js';
import { harnessTab } from './harness.js';
import { helpTab } from './help.js';

const TABS = [
  { value: 'models', icon: 'inventory_2', label: pair('Models', '模型') },
  { value: 'store', icon: 'storefront', label: pair('Store', '模型商店') },
  { value: 'chat', icon: 'forum', label: pair('Chat', '對話') },
  { value: 'create', icon: 'build', label: pair('Create', '製作') },
  { value: 'harness', icon: 'rocket_launch', label: pair('Harnesses', '啟動程式') },
  { value: 'help', icon: 'help', label: pair('Help', '幫助') }
];

/** Shared state for the sections: runtime, hardware and installed models, with change listeners. */
function createSuite() {
  const listeners = new Set();
  const s = {
    rt: null, hw: null, installed: [], running: [], caps: {},
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    fire() { for (const fn of listeners) fn(s); },
    async refresh() {
      s.rt = await window.mt.ollama.runtime().catch((e) => ({ state: 'unhealthy', error: e.message }));
      if (s.rt.state === 'healthy') {
        const [tags, ps] = await Promise.all([window.mt.ollama.call('tags').catch(() => ({ models: [] })), window.mt.ollama.call('ps').catch(() => ({ models: [] }))]);
        s.installed = tags?.models || []; s.running = ps?.models || [];
        await Promise.all(s.installed.filter((m) => !s.caps[m.name]).map(async (m) => {
          try { const d = await window.mt.ollama.call('show', { model: m.name }); s.caps[m.name] = { capabilities: d.capabilities || [], details: d.details || {}, contextLength: Object.entries(d.model_info || {}).find(([k]) => k.endsWith('.context_length'))?.[1] || null }; } catch { s.caps[m.name] = { capabilities: [], details: {} }; }
        }));
      } else { s.installed = []; s.running = []; }
      s.fire();
      return s;
    },
    async hardware() { s.hw = await window.mt.ollama.hardware().catch(() => null); s.fire(); return s.hw; },
    go: null
  };
  return s;
}

registerPage('ollama', (pageCtx) => {
  const arg = pageCtx.arg;
  // Sections register their own cleanups; the shell keeps only one, so collect them here.
  const cleanups = [];
  pageCtx.onCleanup(() => cleanups.forEach((f) => f()));
  const ctx = { ...pageCtx, onCleanup: (f) => cleanups.push(f) };
  const suite = createSuite();
  const stats = h('div.hero-stats');
  const stateWord = { healthy: pair('Running', '運行緊'), stopped: pair('Stopped', '停咗'), missing: pair('Not installed', '未安裝'), unhealthy: pair('Not answering', '冇回應') };
  suite.on((s) => stats.replaceChildren(...heroStats([
    { value: s.rt ? stateWord[s.rt.state] : '…', label: s.rt?.version ? `Ollama ${s.rt.version}` : pair('Ollama', 'Ollama'), tone: s.rt?.state === 'healthy' ? 'ok' : s.rt ? 'warn' : null },
    { value: String(s.installed.length), label: pair('installed', '已安裝') },
    { value: String(s.running.length), label: pair('loaded', '已載入') }
  ]).children));
  const body = h('div.stack');
  const built = {};
  const tabs = mtabs(TABS, TABS.some((x) => x.value === arg) ? arg : store.get('ollamaTab') || 'models', { label: pair('Ollama sections', 'Ollama 分區') });
  const show = (v) => {
    store.set('ollamaTab', v, { record: false });
    const make = { models: modelsTab, store: storeTab, chat: chatTab, create: createTab, harness: harnessTab, help: helpTab }[v];
    built[v] ||= make(ctx, suite);
    clear(body).append(built[v]);
  };
  suite.go = (v) => { tabs.set(v); show(v); };
  tabs.onChange(show);
  show(tabs.get());
  suite.refresh(); suite.hardware();
  const timer = setInterval(() => suite.refresh(), 10000);
  ctx.onCleanup(() => clearInterval(timer));
  return h('div.page',
    pageHero(pair('Local AI', '本機 AI'), pair('Ollama', 'Ollama 本地模型'), pair('Install, run and manage local models with a fit check against this computer before you download anything.', '安裝、運行同管理本機模型；下載之前會先睇吓呢部電腦行唔行到。'), stats),
    tabs.el, body);
});
