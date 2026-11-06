// Persisted settings with defaults, change events, provenance and history.
const KEY = 'mt.settings.v1';
const listeners = new Set();

export const DEFAULTS = Object.freeze({
  lang: 'en',                  // en | yue | both
  funnyEn: 5, funnyYue: 5,
  dialogEmoji: true,
  theme: 'dark',               // dark | light | system
  seed: '#a9b8ff',
  rainbow: false,
  density: 'comfortable',      // compact | comfortable | spacious
  textScale: 100,
  contrast: 'standard',        // standard | high
  motion: 'full',              // full | reduced
  focusRing: true, largeTargets: false,
  displayName: '',
  logo: 'mesh',                // mesh | orbit | knot | custom
  logoCustom: null,
  narrator: false, narratorLang: 'en', voiceEn: '', voiceYue: '', narratorRate: 1, narratorPitch: 1,
  sounds: true, quietHours: false, quietFrom: '22:00', quietTo: '07:00',
  adhdFocus: false, adhdLowStim: false, adhdTime: false, adhdOneThing: false, adhdMomentum: false,
  a11yMenu: true,
  paletteSize: 'card',
  statusInterval: 3,
  tsBinary: '',
  socket: '',
  autoUpdate: true,
  schedules: [],
  appearance: {},              // per-element overrides keyed by data-el id
  locks: {},                   // lock metadata (credentials live in the vault)
  collapsed: {},
  panelSizes: {},
  editor: '',
  onboarded: false,
  onboardStep: 0,
  tabs: null,
  favoritesCli: [],
  notifyHistory: []
});

let state = load();

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export function get(k) { return k ? state[k] : state; }

/** Where a value came from: the saved settings file, or the compiled-in default. */
export function provenance(k) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return k in saved ? { from: 'saved', value: saved[k], def: DEFAULTS[k] } : { from: 'default', value: DEFAULTS[k], def: DEFAULTS[k] };
  } catch { return { from: 'default', value: DEFAULTS[k], def: DEFAULTS[k] }; }
}

let historyTimer = null;
const pendingLabels = new Set();

export function set(k, v, { record = true, label } = {}) {
  if (JSON.stringify(state[k]) === JSON.stringify(v)) return;
  const prev = state[k];
  state = { ...state, [k]: v };
  persist();
  for (const fn of listeners) fn(k, v, prev);
  if (record && k !== 'notifyHistory' && k !== 'onboardStep') {
    pendingLabels.add(label || k);
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      const msg = `Settings: ${[...pendingLabels].join(', ')}`;
      pendingLabels.clear();
      window.mt?.history.record(msg, { 'settings.json': exportable() }).catch(() => {});
    }, 800);
  }
}

export function reset(k) { set(k, DEFAULTS[k], { label: `reset ${k}` }); }

export function replaceAll(obj, label = 'Restore settings') {
  state = { ...DEFAULTS, ...obj };
  persist();
  for (const k of Object.keys(DEFAULTS)) for (const fn of listeners) fn(k, state[k]);
  window.mt?.history.record(label, { 'settings.json': exportable() }).catch(() => {});
}

function persist() {
  const diff = {};
  for (const [k, v] of Object.entries(state)) if (JSON.stringify(v) !== JSON.stringify(DEFAULTS[k])) diff[k] = v;
  localStorage.setItem(KEY, JSON.stringify(diff));
}

/** Settings without anything sensitive, for history and export. */
export function exportable() {
  const { logoCustom, notifyHistory, ...rest } = state;
  return { schema: 'material-tailscale.settings', version: 1, settings: { ...rest, logoCustom: logoCustom ? '(custom image omitted)' : null } };
}

export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
