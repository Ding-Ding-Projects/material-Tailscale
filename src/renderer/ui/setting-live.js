// The live value of one setting, for context menus, the command palette and the website
// palette: a switch for on/off settings, a choice for lists, a range for numbers and a
// swatch for colours. School mode locks the settings it sets and says why.
import * as store from '../core/store.js';
import * as i18n from '../core/i18n.js';
import { pair } from '../core/i18n.js';
import { SETTINGS_INDEX } from '../pages/settings-index.js';
import { openDest } from './shell.js';

export const SET_ICONS = { theme: 'contrast', lang: 'translate', textScale: 'format_size', motion: 'animation', sounds: 'volume_up', narrator: 'record_voice_over', seed: 'palette', density: 'density_medium', contrast: 'tonality', focusRing: 'center_focus_strong', largeTargets: 'touch_app', funnyEn: 'sentiment_very_satisfied', funnyYue: 'sentiment_very_satisfied', adhdFocus: 'center_focus_weak', adhdLowStim: 'blur_on', adhdMomentum: 'east', quietHours: 'bedtime', statusInterval: 'timer' };

/** { label, icon, live } for a settings key, or null when the key has no live value. */
export function settingLive(key) {
  const s = SETTINGS_INDEX.find((x) => x.key === key); if (!s) return null;
  const short = (en, yue) => (store.get('lang') === 'yue' ? yue : en);
  const locked = i18n.schoolOn() && ['lang', 'funnyEn', 'funnyYue', 'dialogEmoji'].includes(key) ? pair('Set by School mode', '學校模式設定咗') : null;
  const base = { label: short(s.en, s.yue), icon: SET_ICONS[key] || 'tune' };
  const get = () => store.get(key); const set = (v) => store.set(key, v, { label: s.en });
  if (s.type === 'bool') return { ...base, live: { kind: 'switch', get, set, disabled: locked } };
  if (s.type === 'enum') return { ...base, live: { kind: 'choice', options: s.options.map((o) => ({ value: o[0], label: short(o[1], o[2]) })), get, set, disabled: locked } };
  if (s.type === 'int' || s.type === 'float') return { ...base, live: { kind: 'range', min: s.min, max: s.max, step: s.type === 'float' ? 0.1 : 1, get, set, format: (v) => (key === 'textScale' ? `${v}%` : String(v)), disabled: locked } };
  if (s.type === 'color') return { ...base, live: { kind: 'swatch', get, set, onSwatch: () => openDest('settings', s.section) } };
  return null;
}
