// Language modes (English, Hong Kong Cantonese, bilingual), per-language funny
// levels 1-5, the dialog emoji switch, School mode and the personal-vocabulary
// layer. Funny level changes voice, never facts: every message keeps the same
// facts at every level.
import * as store from './store.js';
import { h } from './dom.js';

// Each entry: plain label {en, yue} or tiered message {en: [serious, mild, playful], yue: [...]}
export const S = {
  appName: { en: 'Material Tailscale', yue: 'Material Tailscale' },
  home: { en: 'Home', yue: '主頁' }, peers: { en: 'Peers', yue: '裝置' }, exit: { en: 'Exit nodes', yue: '出口節點' },
  routes: { en: 'Routes', yue: '路由' }, serve: { en: 'Serve & Funnel', yue: '分享服務' }, taildrop: { en: 'Taildrop', yue: '傳檔' },
  dns: { en: 'DNS', yue: 'DNS' }, lock: { en: 'Tailnet Lock', yue: '網絡鎖' }, drive: { en: 'Taildrive', yue: '共享資料夾' },
  certs: { en: 'Certificates', yue: '證書' }, accounts: { en: 'Accounts', yue: '帳戶' }, diagnostics: { en: 'Diagnostics', yue: '診斷' },
  cli: { en: 'Every command', yue: '全部指令' }, admin: { en: 'Admin console', yue: '管理控制台' }, console: { en: 'Raw console', yue: '原始終端' },
  tools: { en: 'Tools', yue: '工具' }, settings: { en: 'Settings', yue: '設定' }, docs: { en: 'Docs', yue: '說明文件' }, features: { en: 'Features', yue: '功能' },
  changelog: { en: 'Changelog', yue: '更新紀錄' }, history: { en: 'History', yue: '歷史' }, status: { en: 'Status', yue: '狀態' },
  about: { en: 'About', yue: '關於' }, authenticator: { en: 'Authenticator', yue: '驗證器' }, base64: { en: 'Base64', yue: 'Base64' },
  converter: { en: 'File converter', yue: '檔案轉換' }, regex: { en: 'Regex builder', yue: '正則表達式' }, draw: { en: 'Drawing board', yue: '畫板' },
  ollama: { en: 'Ollama', yue: 'Ollama' }, minecraft: { en: 'Minecraft servers', yue: 'Minecraft 伺服器' }, notifications: { en: 'Notifications', yue: '通知' },
  extensions: { en: 'Extensions', yue: '擴充功能' },
  connect: { en: 'Connect', yue: '連線' }, disconnect: { en: 'Disconnect', yue: '斷線' }, run: { en: 'Run', yue: '執行' }, copy: { en: 'Copy', yue: '複製' },
  cancel: { en: 'Cancel', yue: '取消' }, apply: { en: 'Apply', yue: '套用' }, reset: { en: 'Reset', yue: '重設' }, refresh: { en: 'Refresh', yue: '重新整理' },
  search: { en: 'Search', yue: '搜尋' }, close: { en: 'Close', yue: '關閉' }, next: { en: 'Next', yue: '下一步' }, back: { en: 'Back', yue: '上一步' },
  skip: { en: 'Skip', yue: '跳過' }, finish: { en: 'Finish', yue: '完成' }, export: { en: 'Export', yue: '匯出' }, import: { en: 'Import', yue: '匯入' },
  connected: { en: 'Connected', yue: '已連線' }, disconnected: { en: 'Disconnected', yue: '未連線' }, needsLogin: { en: 'Needs login', yue: '要登入' },
  notInstalled: { en: 'Tailscale not found', yue: '搵唔到 Tailscale' }, starting: { en: 'Starting', yue: '啟動緊' },
  direct: { en: 'direct', yue: '直連' }, relay: { en: 'relayed', yue: '中繼' }, offline: { en: 'offline', yue: '離線' }, idle: { en: 'idle', yue: '閒置' },
  newTab: { en: 'New tab', yue: '新分頁' }, pendingCommand: { en: 'Command that will run', yue: '將會執行嘅指令' },
  output: { en: 'Output', yue: '輸出' }, filter: { en: 'Filter', yue: '篩選' }, menu: { en: 'Menu', yue: '選單' }, all: { en: 'All', yue: '全部' }, none: { en: 'None', yue: '無' },
  leaveUnchanged: { en: 'Leave as is', yue: '唔改' }, on: { en: 'On', yue: '開' }, off: { en: 'Off', yue: '關' },
  editAppearance: { en: 'Edit appearance…', yue: '編輯外觀…' }, lockElement: { en: 'Lock this element…', yue: '鎖住呢個元素…' },
  version: { en: 'Version', yue: '版本' }, updated: { en: 'Updated', yue: '更新時間' }, codeName: { en: 'Code name', yue: '代號' },
  // tiered messages
  welcome: { en: ['Welcome to Material Tailscale.', 'Welcome aboard. Let us set up your tailnet.', 'Welcome! Your tailnet just got a glow-up.'], yue: ['歡迎使用 Material Tailscale。', '歡迎！一齊設定你嘅 tailnet。', '歡迎歡迎！你個 tailnet 即刻靚仔晒！'] },
  tsMissing: { en: ['Tailscale is not installed or could not be found. Install it, or choose its location in Settings.', 'Tailscale is not on this computer yet. Install it or point to it in Settings.', 'No Tailscale here. Install it, or show us where it is hiding in Settings.'], yue: ['搵唔到 Tailscale。請安裝，或者喺設定揀佢嘅位置。', '呢部電腦未有 Tailscale，裝咗佢或者喺設定指返位置。', 'Tailscale 匿埋咗！裝返佢，或者喺設定話我知佢喺邊。'] },
  cmdOk: { en: ['Command finished.', 'Done.', 'Done and dusted!'], yue: ['指令完成。', '搞掂。', '搞掂晒！'] },
  cmdFail: { en: ['Command failed with exit code {code}.', 'That did not work (exit code {code}).', 'Oops, that went sideways (exit code {code}).'], yue: ['指令失敗，結束碼 {code}。', '唔得喎（結束碼 {code}）。', '哎呀，出事（結束碼 {code}）。'] },
  copied: { en: ['Copied to the clipboard.', 'Copied.', 'Copied! Paste away.'], yue: ['已複製到剪貼簿。', '複製咗。', '複製咗！隨便貼！'] },
  destructive: { en: ['This cannot be undone: {what}.', 'Heads up, no undo: {what}.', 'Big red button time, no undo: {what}.'], yue: ['呢個動作冇得返轉頭：{what}。', '注意，冇得復原：{what}。', '大紅掣嚟㗎，冇得反悔：{what}。'] },
  vocabApplied: { en: ['Personal vocabulary applied.', 'Your vocabulary is live.', 'Level up! Your vocabulary is live!'], yue: ['已套用個人詞彙。', '你嘅詞彙生效咗。', '升級！你嘅詞彙生效啦！'] },
  vocabBad: { en: ['That file was not applied: {why}. Nothing changed.', 'Could not use that file: {why}. Nothing changed.', 'Nope, that file is not it: {why}. Nothing changed.'], yue: ['未有套用：{why}。乜都冇改。', '用唔到呢個檔：{why}。乜都冇改。', '呢個檔唔啱喎：{why}。乜都冇改。'] },
  apiNoCred: { en: ['Add an API access token or OAuth client to use the admin console.', 'Connect an API token to manage the tailnet.', 'Give us an API token and we will run the whole tailnet.'], yue: ['請加入 API 存取權杖或 OAuth 用戶端先可以用管理控制台。', '連接 API 權杖去管理 tailnet。', '畀個 API 權杖我，成個 tailnet 我幫你搞！'] },
  locked: { en: ['This element is locked.', 'Locked. Unlock to use it.', 'Locked tight! Unlock to play.'], yue: ['呢個元素已鎖。', '鎖咗，解鎖先用到。', '鎖到實一實！解鎖先玩得。'] },
  updateReady: { en: ['Version {v} is ready to install. The installer is unsigned and Windows may warn about an unknown publisher.', 'Update {v} is ready. Unsigned installer; Windows may warn.', 'Fresh update {v} is ready! Unsigned, so Windows may raise an eyebrow.'], yue: ['版本 {v} 可以安裝。安裝程式冇簽名，Windows 可能會警告。', '更新 {v} 準備好。冇簽名，Windows 可能會彈警告。', '新鮮熱辣 {v} 到！冇簽名，Windows 可能會皺眉。'] },
  dimSumOff: { en: ['The dim sum surprise cannot be turned off.', 'Nice try. This one cannot be turned off.', 'Nice try! The har gow says no. It stays on.'], yue: ['點心驚喜唔可以熄。', '好嘢，不過呢個熄唔到。', '想熄？蝦餃話唔得！'] }
};

let vocab = null;          // { entries: Map } validated personal vocabulary
let school = { enabled: false, name: null };
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export function setSchool(rec) { school = { enabled: !!rec?.enabled, name: rec?.name || null }; emit(); }
export const schoolOn = () => school.enabled;
export const schoolName = () => school.name || 'School mode';

export function mode() { return schoolOn() ? 'en' : store.get('lang'); }

function tier(lang) {
  if (schoolOn()) return 0;
  const lv = lang === 'yue' ? store.get('funnyYue') : store.get('funnyEn');
  return lv <= 1 ? 0 : lv <= 3 ? 1 : 2;
}

function fill(s, vars) { return s.replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? `{${k}}`)); }

function raw(key, lang, vars) {
  const e = S[key];
  if (!e) return key;
  const v = e[lang] ?? e.en;
  const s = Array.isArray(v) ? v[tier(lang)] ?? v[0] : v;
  return applyVocab(fill(s, vars));
}

/** Text in the primary language (bilingual returns "English · 廣東話"). */
export function t(key, vars) {
  const m = mode();
  if (m === 'both') { const a = raw(key, 'en', vars), b = raw(key, 'yue', vars); return a === b ? a : `${a} · ${b}`; }
  return raw(key, m, vars);
}

/** A span with the primary label prominent and the secondary compact (bilingual). */
export function tl(key, vars) {
  const m = mode();
  if (m !== 'both') return h('span', { 'data-i18n': key }, raw(key, m, vars));
  return h('span.bi', { 'data-i18n': key }, h('span.bi-p', raw(key, 'en', vars)), h('span.bi-s', raw(key, 'yue', vars)));
}

/** Literal pair helper for strings that are not in the table. */
export function pair(en, yue) {
  const m = mode();
  if (m === 'en' || !yue) return applyVocab(en);
  if (m === 'yue') return yue;
  const e = applyVocab(en);
  return e === yue ? e : `${e} · ${yue}`;
}

export function emoji(e) { return store.get('dialogEmoji') && !schoolOn() ? e + ' ' : ''; }

// ---------------- personal vocabulary ----------------
const VOCAB_KEY = 'mt.vocab.cache';
const LIMITS = { bytes: 256 * 1024, depth: 8, key: 160, value: 1000 };

function depthOf(o, d = 0) {
  if (o && typeof o === 'object') return Math.max(d, ...Object.values(o).map((v) => depthOf(v, d + 1)));
  return d;
}

/** Strict parse that rejects duplicate keys, which JSON.parse silently merges. */
function hasDuplicateKeys(text) {
  const stack = [];
  const re = /"((?:[^"\\]|\\.)*)"\s*:|[{}[\]]/g;
  let m;
  while ((m = re.exec(text))) {
    const tok = m[0];
    if (tok === '{') stack.push(new Set());
    else if (tok === '[') stack.push(null);
    else if (tok === '}' || tok === ']') stack.pop();
    else {
      const top = stack[stack.length - 1];
      if (top) { const k = JSON.parse(`"${m[1]}"`); if (top.has(k)) return k; top.add(k); }
    }
  }
  return null;
}

export function validateVocab(bytesOrText) {
  const text = typeof bytesOrText === 'string' ? bytesOrText : new TextDecoder('utf-8', { fatal: true }).decode(bytesOrText);
  if (new TextEncoder().encode(text).length > LIMITS.bytes) throw new Error('the file is larger than 256 KiB');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('the file is not valid JSON'); }
  const dup = hasDuplicateKeys(text);
  if (dup !== null) throw new Error('a key appears twice');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('the top level must be an object');
  const allowed = new Set(['schemaVersion', 'entries', '$schema', 'description']);
  for (const k of Object.keys(data)) if (!allowed.has(k)) throw new Error(`unexpected field "${k}"`);
  if (data.schemaVersion !== 1) throw new Error('unsupported schemaVersion (expected 1)');
  if (depthOf(data) > LIMITS.depth) throw new Error('nesting is deeper than 8 levels');
  const entries = data.entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('"entries" must be an object of term to replacement');
  const map = new Map();
  for (const [k, v] of Object.entries(entries)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('unsafe key');
    if (typeof v !== 'string') throw new Error(`the replacement for "${k}" is not text`);
    if (!k.trim() || [...k].length > LIMITS.key) throw new Error('a term is empty or longer than 160 characters');
    if ([...v].length > LIMITS.value) throw new Error('a replacement is longer than 1,000 characters');
    map.set(k, v);
  }
  return { map, count: map.size };
}

let vocabRe = null;
function compile() {
  if (!vocab || !vocab.map.size) { vocabRe = null; return; }
  const keys = [...vocab.map.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  vocabRe = new RegExp(`(?<![\\w-])(${keys.join('|')})(?![\\w-])`, 'g');
}

export function applyVocab(s) {
  if (!vocabRe || schoolOn() || typeof s !== 'string') return s;
  return s.replace(vocabRe, (m) => vocab.map.get(m) ?? m);
}

export function loadVocabFromText(text) {
  const v = validateVocab(text);
  vocab = v; compile();
  localStorage.setItem(VOCAB_KEY, text);
  emit();
  return v.count;
}

export function clearVocab() { vocab = null; vocabRe = null; localStorage.removeItem(VOCAB_KEY); emit(); }
export function vocabState() { return vocab ? { loaded: true, count: vocab.map.size } : { loaded: false }; }

export function restoreVocab() {
  const text = localStorage.getItem(VOCAB_KEY);
  if (!text) return { loaded: false };
  try { vocab = validateVocab(text); compile(); return { loaded: true }; } catch (e) { return { loaded: false, corrupt: e.message }; }
}

store.on((k) => { if (['lang', 'funnyEn', 'funnyYue', 'dialogEmoji'].includes(k)) emit(); });
