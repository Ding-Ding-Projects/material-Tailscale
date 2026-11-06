// Action sounds (synthesised with WebAudio, so nothing extra ships) and the
// spoken narrator with per-language voice pickers, serialized queue and
// per-category cooldowns.
import * as store from './store.js';

let ctx;
function inQuietHours() {
  if (!store.get('quietHours')) return false;
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  const p = (s) => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
  const a = p(store.get('quietFrom')), b = p(store.get('quietTo'));
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

const CUES = {
  success: [[660, 0, .08], [880, .08, .12]],
  error: [[300, 0, .12], [220, .12, .18]],
  click: [[1200, 0, .03]],
  connect: [[440, 0, .08], [660, .07, .08], [990, .14, .16]],
  disconnect: [[660, 0, .08], [440, .08, .14]],
  levelup: [[523, 0, .1], [659, .1, .1], [784, .2, .1], [1047, .3, .25]],
  denied: [[180, 0, .2]]
};

export function sound(name) {
  if (!store.get('sounds') || inQuietHours() || store.get('adhdLowStim')) return;
  try {
    ctx ||= new AudioContext();
    const t0 = ctx.currentTime;
    for (const [freq, at, dur] of CUES[name] || []) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
    }
  } catch { /* audio unavailable: visual feedback still carries everything */ }
}

// ---------------- narrator ----------------
let voices = [];
const voiceListeners = new Set();
function refreshVoices() {
  voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  voiceListeners.forEach((fn) => fn(voices));
}
if (typeof speechSynthesis !== 'undefined') {
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}
export function onVoices(fn) { voiceListeners.add(fn); fn(voices); return () => voiceListeners.delete(fn); }
export const voicesFor = (lang) => voices.filter((v) => (lang === 'yue' ? /^(yue|zh-HK)/i.test(v.lang) : /^en/i.test(v.lang)));

/** Which voice will really speak, and why. */
export function voiceInEffect(lang) {
  const id = store.get(lang === 'yue' ? 'voiceYue' : 'voiceEn');
  const list = voicesFor(lang);
  if (typeof speechSynthesis === 'undefined') return { voice: null, note: 'Speech synthesis is not available here.' };
  if (!list.length) return { voice: null, note: lang === 'yue' ? 'No Cantonese (zh-HK) voice is installed on this computer.' : 'No English voice is installed on this computer.' };
  if (id) {
    const v = list.find((x) => x.voiceURI === id);
    if (v) return { voice: v, note: `${v.name} (${v.lang})${v.localService ? '' : ' · network voice, quiet when offline'}` };
    const auto = list.find((x) => x.default) || list[0];
    return { voice: auto, note: `The chosen voice is not installed on this computer; using ${auto.name} for now. Your choice is kept.` };
  }
  const auto = list.find((x) => x.default) || list[0];
  return { voice: auto, note: `Automatically: ${auto.name} (${auto.lang})` };
}

const queue = [];
let speaking = false;
const lastByCat = new Map();

export function narrate(category, en, yue) {
  if (!store.get('narrator') || typeof speechSynthesis === 'undefined' || inQuietHours()) return;
  const now = Date.now();
  const cool = category === 'error' ? 1500 : 4000;
  if (now - (lastByCat.get(category) || 0) < cool) {
    const i = queue.findIndex((q) => q.category === category);
    if (i >= 0) queue.splice(i, 1);
  }
  lastByCat.set(category, now);
  const which = store.get('narratorLang');
  const parts = which === 'both' ? [['en', en], ['yue', yue || en]] : which === 'yue' ? [['yue', yue || en]] : [['en', en]];
  queue.push({ category, parts });
  pump();
}

function pump() {
  if (speaking || !queue.length) return;
  const item = queue.shift();
  speaking = true;
  const sayNext = (i) => {
    if (i >= item.parts.length) { speaking = false; pump(); return; }
    const [lang, text] = item.parts[i];
    const u = new SpeechSynthesisUtterance(text);
    const { voice } = voiceInEffect(lang);
    if (voice) u.voice = voice;
    u.lang = lang === 'yue' ? 'zh-HK' : 'en-US';
    u.rate = store.get('narratorRate'); u.pitch = store.get('narratorPitch');
    u.onend = u.onerror = () => sayNext(i + 1);
    speechSynthesis.speak(u);
  };
  sayNext(0);
}

export function readAloud(text) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const { voice } = voiceInEffect('en');
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
