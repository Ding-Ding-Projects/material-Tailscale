// Help section: bundled, offline answers for every state the suite can be in, each with the
// in-app action that fixes it, so nothing sends you off to search the web.
import { h, icon } from '../../core/dom.js';
import { pair } from '../../core/i18n.js';
import { RUNTIME_HELP } from './models.js';

const TOPICS = [
  ['missing', 'download', RUNTIME_HELP.missing, 'models', pair('Go to Models and install', '去模型分區安裝')],
  ['stopped', 'play_arrow', RUNTIME_HELP.stopped, 'models', pair('Go to Models and start it', '去模型分區啟動')],
  ['unhealthy', 'warning', RUNTIME_HELP.unhealthy, 'models', pair('Go to Models and check again', '去模型分區再檢查')],
  ['catalog-offline', 'cloud_off', { title: pair('The catalogue cannot be read', '讀唔到目錄'), body: pair('Reading the catalogue needs the internet. Offline, the store shows the last catalogue that was read completely and what is installed here; nothing new is guessed.', '讀目錄要上網。離線時商店會顯示上次完整讀到嘅目錄同呢度已安裝嘅模型，唔會亂估新嘢。') }, 'store', pair('Open the store', '打開商店')],
  ['catalog-stale', 'history', { title: pair('The catalogue is old', '目錄太舊'), body: pair('A catalogue more than a week old is marked. Refresh reads every page again; if any page fails, the last complete one is kept.', '超過一個禮拜嘅目錄會有標記。重新整理會重讀每一頁；有頁讀唔到就保留上次完整嘅。') }, 'store', pair('Refresh in the store', '喺商店重新整理')],
  ['storage', 'hard_drive', { title: pair('Not enough space for a download', '空間唔夠下載'), body: pair('The cart compares each download with the free space where models are kept and will not start a batch that does not fit. Delete a model you no longer use, or set OLLAMA_MODELS to a bigger drive and restart Ollama.', '購物車會將下載大小同放模型嘅空間比較，唔夠就唔會開始。刪除唔用嘅模型，或者將 OLLAMA_MODELS 設去大啲嘅磁碟再重新啟動 Ollama。') }, 'models', pair('Review installed models', '睇已安裝模型')],
  ['gpu', 'memory', { title: pair('The graphics card is not counted', '冇計顯示卡'), body: pair('The fit check uses video memory only when it can be read reliably (NVIDIA cards through nvidia-smi, and Apple silicon). Otherwise it counts system memory only and never says "Runs well". Updating the graphics driver usually makes nvidia-smi available.', '讀得準顯示記憶體先會計（NVIDIA 卡經 nvidia-smi，同 Apple 晶片）。否則只計系統記憶體，唔會講「行得好順」。更新顯示卡驅動通常就有 nvidia-smi。') }, 'models', pair('Read this computer again', '再讀呢部電腦')],
  ['pull', 'sync_problem', { title: pair('A download failed', '下載失敗'), body: pair('Each failed item says why. Retry continues where it stopped, because Ollama keeps the parts it already has. A failed item never removes a model that was already installed.', '每個失敗項目都會講原因。重試會由停低嘅地方繼續，Ollama 會保留已經下載咗嘅部分。失敗唔會刪除已安裝嘅模型。') }, 'store', pair('See the downloads', '睇下載')],
  ['incompatible', 'block', { title: pair('The model will not load', '模型載入唔到'), body: pair('Some models need a newer Ollama. Install or repair Ollama to get the latest release, then load the model again.', '有啲模型要新啲嘅 Ollama。安裝或修復 Ollama 攞最新版，再載入。') }, 'models', pair('Go to Models', '去模型分區')],
  ['harness', 'rocket_launch', { title: pair('A harness did not start', '啟動程式開唔到'), body: pair('The preview lists every check before launch. If the program still stops at once, the app restores the profiles it saved just before, and the message says what the program reported.', '預覽會列出所有檢查。如果程式一開就停，程式會還原啟動前存低嘅設定，訊息會講程式報咗乜。') }, 'harness', pair('Open harnesses', '打開啟動程式')]
];

export function helpTab(ctx, suite) {
  const grid = h('div.grid');
  const draw = (s) => {
    const now = s.rt?.state;
    grid.replaceChildren(...TOPICS.map(([id, ico, t, go, label]) => h(`section.card.span-6.stack${id === now ? '.tonal' : ''}`, { dataset: { el: `ollama-help-${id}` } },
      h('div.card-head', h('span.ic', icon(ico)), h('h3', t.title), id === now ? h('span.badge.warn', pair('This is what is happening now', '而家就係咁')) : null),
      h('div.small', t.body), h('div.row', h('button.btn.small.tonal', { type: 'button', on: { click: () => suite.go(go) } }, icon('arrow_forward'), label)))));
  };
  ctx.onCleanup(suite.on(draw));
  draw(suite);
  return grid;
}
