import { h, reducedMotion } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { sound } from '../core/feedback.js';
import { announce } from './overlay.js';

/** Full-window level-up celebration: headline animates in, holds ~3 s, then out. */
export function celebrate(text = t('vocabApplied')) {
  const layer = h('div.celebrate', { 'aria-hidden': 'true' }, h('div.headline', text));
  document.body.append(layer);
  announce(text);
  sound('levelup');
  if (!reducedMotion()) {
    const colors = ['var(--primary)', 'var(--secondary)', 'var(--tertiary)', '#ff8fb1'];
    for (let i = 0; i < 80; i++) {
      const c = h('i.confetti', { style: { left: Math.random() * 100 + 'vw', background: colors[i % 4], animationDuration: 1.8 + Math.random() * 2 + 's', animationDelay: Math.random() * 0.6 + 's' } });
      document.body.append(c);
      setTimeout(() => c.remove(), 4800);
    }
  }
  setTimeout(() => layer.remove(), reducedMotion() ? 3000 : 3700);
}
