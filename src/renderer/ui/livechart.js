// Liveline-style live chart: eased line with a pulsing live dot, gradient fill,
// quiet grid, animated range and value badge, scrub crosshair with tooltips,
// keyboard scrubbing, a screen-reader summary, and honest empty/stale states.
import { h, reducedMotion, fmtBytes } from '../core/dom.js';
import { pair } from '../core/i18n.js';

export function liveChart({ series, label, format = (v) => `${fmtBytes(v)}/s` }) {
  const canvas = h('canvas', { role: 'img', 'aria-label': label });
  const badge = h('div.badge-val');
  const tip = h('div.tip', { hidden: true });
  const summary = h('div.sr-only', { 'aria-live': 'polite' });
  const state = h('div.small.muted');
  const wrap = h('div.livechart', { tabindex: '0', 'aria-label': label + '. ' + pair('Use left and right arrows to scrub.', '用左右箭咀睇數值。') }, canvas, badge, tip, summary);
  let data = [], shownMax = 1, scrub = null, raf = 0, phase = 0, alive = true;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function draw() {
    if (!alive) return;
    const dpr = devicePixelRatio || 1;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W) { raf = requestAnimationFrame(draw); return; }
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const pts = data;
    const target = Math.max(1, ...pts.flatMap((p) => series.map((s) => p[s.key] || 0))) * 1.2;
    shownMax += reducedMotion() ? target - shownMax : (target - shownMax) * 0.12;
    g.strokeStyle = css('--outline-soft'); g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = (H / 4) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    if (pts.length < 2) {
      g.fillStyle = css('--on-3'); g.font = '13px Roboto Flex'; g.fillText(pair('Waiting for live data…', '等緊即時數據…'), 12, H / 2);
    } else {
      const xs = (i) => (i / (pts.length - 1)) * (W - 50);
      const ys = (v) => H - 8 - (v / shownMax) * (H - 20);
      series.forEach((s, si) => {
        const col = css(s.color);
        g.beginPath();
        pts.forEach((p, i) => { const x = xs(i), y = ys(p[s.key] || 0); if (!i) g.moveTo(x, y); else { const px = xs(i - 1), py = ys(pts[i - 1][s.key] || 0); g.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y); } });
        g.strokeStyle = col; g.lineWidth = si ? 1.6 : 2.4; if (si) g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
        if (!si) {
          g.lineTo(xs(pts.length - 1), H); g.lineTo(0, H); g.closePath();
          const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col + '66'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fill();
          const lx = xs(pts.length - 1), ly = ys(pts[pts.length - 1][s.key] || 0);
          phase = (phase + 0.04) % 1;
          const pr = reducedMotion() ? 0 : phase * 12;
          g.beginPath(); g.arc(lx, ly, 4 + pr, 0, 7); g.fillStyle = col + Math.round((1 - phase) * 80).toString(16).padStart(2, '0'); g.fill();
          g.beginPath(); g.arc(lx, ly, 4.5, 0, 7); g.fillStyle = col; g.fill();
          badge.style.top = ly + 'px'; badge.textContent = format(pts[pts.length - 1][s.key] || 0);
        }
      });
      if (scrub !== null && pts[scrub]) {
        const x = xs(scrub);
        g.strokeStyle = css('--on-3'); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
        const p = pts[scrub];
        tip.hidden = false; tip.style.left = Math.min(W - 180, x + 8) + 'px'; tip.style.top = '6px';
        tip.textContent = `${new Date(p.t).toLocaleTimeString()} · ${series.map((s) => `${s.label} ${format(p[s.key] || 0)}`).join(' · ')}`;
      } else tip.hidden = true;
    }
    raf = requestAnimationFrame(draw);
  }
  const at = (clientX) => { const r = wrap.getBoundingClientRect(); return Math.round(((clientX - r.left) / (r.width - 50)) * (data.length - 1)); };
  wrap.addEventListener('pointermove', (e) => { scrub = Math.max(0, Math.min(data.length - 1, at(e.clientX))); });
  wrap.addEventListener('pointerleave', () => { scrub = null; });
  wrap.addEventListener('keydown', (e) => {
    if (!data.length) return;
    if (e.key === 'ArrowLeft') scrub = Math.max(0, (scrub ?? data.length) - 1);
    else if (e.key === 'ArrowRight') scrub = Math.min(data.length - 1, (scrub ?? data.length - 2) + 1);
    else if (e.key === 'Escape') scrub = null; else return;
    e.preventDefault();
    const p = data[scrub];
    if (p) summary.textContent = `${new Date(p.t).toLocaleTimeString()}: ${series.map((s) => `${s.label} ${format(p[s.key] || 0)}`).join(', ')}`;
  });
  draw();
  return {
    el: h('div.stack', wrap, state),
    update(d, { stale } = {}) {
      data = d.slice(-60);
      state.textContent = stale ? pair('Stale: no update in the last poll.', '數據過時：上次輪詢冇更新。') : '';
      if (data.length) { const l = data[data.length - 1]; canvas.setAttribute('aria-label', `${label}: ${series.map((s) => `${s.label} ${format(l[s.key] || 0)}`).join(', ')}`); }
    },
    destroy() { alive = false; cancelAnimationFrame(raf); }
  };
}
