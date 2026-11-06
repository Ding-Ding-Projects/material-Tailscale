// Two-key super confirmation for destructive actions, built in the app's own
// UI: two independently pressed keys, then a full-range slider, with an
// always-available Emergency exit.
import { h, icon } from '../core/dom.js';
import { t, pair, emoji } from '../core/i18n.js';
import { popover, dialog } from './overlay.js';
import { sound } from '../core/feedback.js';

export function superConfirm({ action, affects, anchor }) {
  return new Promise((resolve) => {
    let k1 = false, k2 = false, done = false;
    const prog = h('i');
    const slider = h('input.slider', { type: 'range', min: 0, max: 100, value: 0, disabled: true, 'aria-label': pair('Slide all the way to confirm', '拉到盡確認') });
    const status = h('div.small.muted', { 'aria-live': 'polite' }, pair('Press both keys to unlock the slider.', '兩條鎖匙都撳咗先解鎖滑桿。'));
    const upd = () => {
      key1.setAttribute('aria-pressed', String(k1)); key2.setAttribute('aria-pressed', String(k2));
      slider.disabled = !(k1 && k2);
      prog.style.width = `${(k1 ? 25 : 0) + (k2 ? 25 : 0) + (Number(slider.value) / 2)}%`;
      status.textContent = k1 && k2 ? pair('Slide all the way to the end to confirm.', '拉到盡就確認。') : pair('Press both keys to unlock the slider.', '兩條鎖匙都撳咗先解鎖滑桿。');
    };
    const key1 = h('button.sc-key', { type: 'button', 'aria-pressed': 'false', on: { click: () => { k1 = !k1; sound('click'); upd(); } } }, icon('key'), pair('Key one', '鎖匙一'));
    const key2 = h('button.sc-key', { type: 'button', 'aria-pressed': 'false', on: { click: () => { k2 = !k2; sound('click'); upd(); } } }, icon('key'), pair('Key two', '鎖匙二'));
    slider.addEventListener('input', () => { slider.style.setProperty('--p', slider.value + '%'); upd(); });
    slider.addEventListener('change', () => {
      if (Number(slider.value) >= 100 && k1 && k2 && !done) { done = true; prog.style.width = '100%'; sound('success'); setTimeout(() => { ui.close(true); }, 350); }
      else { slider.value = 0; slider.style.setProperty('--p', '0%'); upd(); }
    });
    const body = h('div.stack',
      h('p', { style: { margin: 0 } }, t('destructive', { what: action })),
      affects ? h('div.card.tonal', { style: { padding: '12px' } }, h('b', pair('Affected', '受影響')), h('div.small', affects)) : null,
      h('div.sc-keys', key1, key2), h('div.sc-progress', prog), slider, status);
    const ui = dialog({
      title: pair('Confirm a destructive action', '確認危險動作'), emojiChar: '🧨', body,
      onClose: (v) => resolve(!!v),
      actions: [{ label: pair('Emergency exit', '緊急離開'), kind: 'outline', value: false }],
      initialFocus: () => key1
    });
  });
}
