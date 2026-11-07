// In-page probes for the every-surface sweep (scripts/sweep.mjs). Each export is the source
// of a self-contained expression that runs inside the app's renderer or a website page and
// returns plain data. The app sweep evaluates them with executeJavaScript; the website sweep
// with Playwright's page.evaluate. Keep them free of imports and side effects beyond the
// data-sweep-* attributes they set for bookkeeping.

// Shared helpers, prepended to every probe.
const HELPERS = String.raw`
const __vis = (el) => {
  if (!el || !el.isConnected) return false;
  // checkVisibility also sees content-visibility (closed <details>) and opacity.
  if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) === 0) return false;
    if (n.hidden) return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const __sel = (el) => {
  const parts = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && n !== document.body && i < 5; n = n.parentElement, i++) {
    let p = n.localName;
    if (n.id) { parts.unshift(p + '#' + n.id); break; }
    if (n.dataset && n.dataset.el) { parts.unshift(p + '[data-el="' + n.dataset.el + '"]'); break; }
    const cls = [...n.classList].filter((c) => !c.startsWith('sweep')).slice(0, 2);
    if (cls.length) p += '.' + cls.join('.');
    parts.unshift(p);
  }
  return parts.join(' > ');
};
const __overlayRoot = (el) => el && el.closest('.popover, .dialog, .scrim, .panel-float, .toast, .toast-host, .update-banner, .dimsum, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], .tooltip');
const __textOf = (el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll('[aria-hidden="true"], .msr, svg, style, script').forEach((x) => x.remove());
  return (c.textContent || '').replace(/\s+/g, ' ').trim();
};
const __name = (el) => {
  const lb = el.getAttribute('aria-labelledby');
  if (lb) { const t = lb.split(/\s+/).map((id) => { const x = document.getElementById(id); return x ? __textOf(x) : ''; }).join(' ').trim(); if (t) return t; }
  const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
  if (el.labels && el.labels.length) { const t = [...el.labels].map((l) => __textOf(l)).join(' ').trim(); if (t) return t; }
  if (el.localName === 'input' && /^(button|submit|reset)$/.test(el.type) && el.value) return el.value;
  if (el.localName === 'img') return el.alt || '';
  if (!/^(input|select|textarea)$/.test(el.localName)) { const t = __textOf(el); if (t) return t; }
  if (el.title && el.title.trim()) return el.title.trim();
  if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();
  const wrap = el.closest('label'); if (wrap) { const t = __textOf(wrap); if (t) return t; }
  return '';
};
// Settle every running transition and animation so computed styles show end states. Reduced
// motion keeps 1 ms transitions, which a throttled background window may not tick.
const __settle = () => { for (const a of document.getAnimations()) { try { a.finish(); } catch { /* infinite */ } } };
const __snap = (el) => {
  const out = [];
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    const cs = getComputedStyle(n);
    out.push([cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderTopColor, cs.borderTopWidth, cs.borderBottomColor, cs.borderBottomWidth].join('|'));
  }
  return out;
};
`;

/** Text that is cut off, outside the window, or covered by something that is not an overlay. */
const LAYOUT_PROBE = `(() => {${HELPERS}
  __settle();
  const W = innerWidth, H = innerHeight, out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const seen = new Set();
  for (let t; (t = walker.nextNode());) {
    const el = t.parentElement;
    if (!el || seen.has(el) || el.closest('script, style, svg, canvas, noscript, template, .msr, .sr-only, .visually-hidden, [aria-hidden="true"], [data-sweep-skip]')) continue;
    if (!__vis(el)) continue;
    const range = document.createRange(); range.selectNodeContents(t);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    const text = t.nodeValue.trim().replace(/\\s+/g, ' ').slice(0, 60);
    // Walk up to the nearest box that hides or scrolls overflow.
    let box = null, scrolls = false;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { box = n; scrolls = /(auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY); break; }
    }
    for (const r of rects) {
      if (r.right > W + 1 || r.left < -1) {
        if (!scrolls) { out.push({ kind: 'offscreen', target: __sel(el), text, rect: [r.left, r.top, r.width, r.height].map(Math.round) }); seen.add(el); }
        break;
      }
      if (box && !scrolls) {
        const pr = box.getBoundingClientRect();
        if (r.right > pr.right + 1.5 || r.bottom > pr.bottom + 1.5 || r.left < pr.left - 1.5 || r.top < pr.top - 1.5) {
          const disclosed = getComputedStyle(el).textOverflow === 'ellipsis' && !!(el.closest('[title]') || el.getAttribute('aria-label'));
          if (!disclosed) { out.push({ kind: 'clipped', target: __sel(el), text, by: __sel(box) }); seen.add(el); }
          break;
        }
      }
      // Only text that is actually inside every scrolling ancestor's visible area can be covered.
      let inView = r.top >= 0 && r.left >= 0 && r.bottom <= H && r.right <= W;
      for (let n = el.parentElement; inView && n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + ' ' + cs.overflowY)) { const pr = n.getBoundingClientRect(); if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.right > pr.right + 1) inView = false; }
      }
      if (!inView) continue;
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + r.height / 2], [r.right - 3, r.top + r.height / 2]];
      for (const [x, y] of pts) {
        const top = document.elementFromPoint(x, y);
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        const ov = __overlayRoot(top);
        if (ov && !ov.contains(el)) continue; // an open menu, dialog or toast may cover the page
        out.push({ kind: 'overlap', target: __sel(el), text, by: __sel(top) }); seen.add(el); break;
      }
      if (seen.has(el)) break;
    }
    if (out.length > 60) break;
  }
  return out;
})()`;

/** Records the unfocused look of every focusable control, so the keyboard walk can tell whether focus changes it. */
const FOCUS_BASELINE = `(() => {${HELPERS}
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  __settle();
  let n = 0;
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]')) {
    el.dataset.sweepBase = JSON.stringify(__snap(el)); n++;
  }
  // Only modal dialogs keep focus inside; a non-modal popover may let it go.
  const modal = [...document.querySelectorAll('[aria-modal="true"], .scrim [role="dialog"], .scrim [role="alertdialog"]')].filter(__vis).pop();
  document.querySelectorAll('[data-sweep-modal]').forEach((x) => x.removeAttribute('data-sweep-modal'));
  if (modal) modal.setAttribute('data-sweep-modal', '1');
  return { controls: n, modal: modal ? __sel(modal) : null };
})()`;

/** Describes the element that has keyboard focus now. */
const FOCUS_STATE = `(() => {${HELPERS}
  __settle();
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { none: true };
  if (!el.dataset.sweepId) el.dataset.sweepId = String(Math.random()).slice(2, 10);
  const r = el.getBoundingClientRect();
  const visible = __vis(el) && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const name = __name(el);
  const ligature = [...el.querySelectorAll('.msr')].some((g) => g.getAttribute('aria-hidden') !== 'true' && !g.closest('[aria-hidden="true"]'));
  const base = el.dataset.sweepBase ? JSON.parse(el.dataset.sweepBase) : null;
  const now = __snap(el);
  let ring = null;
  if (base) {
    ring = false;
    for (let i = 0; i < now.length; i++) {
      const [os, ow, oc, bs, btc, btw, bbc, bbw] = now[i].split('|');
      const [os0, ow0, oc0, bs0, btc0, btw0, bbc0, bbw0] = (base[i] || '').split('|');
      const outline = os !== 'none' && parseFloat(ow) >= 1 && (os0 === 'none' || parseFloat(ow0) < 1 || oc !== oc0 || ow !== ow0);
      const shadow = bs !== 'none' && bs !== bs0;
      const border = (btc !== btc0 || bbc !== bbc0 || btw !== btw0 || bbw !== bbw0) && (parseFloat(btw) >= 1 || parseFloat(bbw) >= 1);
      if (outline || shadow || border) { ring = true; break; }
    }
  }
  const modal = document.querySelector('[data-sweep-modal]');
  return { id: el.dataset.sweepId, target: __sel(el), role: el.getAttribute('role') || el.localName, name: name.slice(0, 80), visible, ligature, ring, escaped: !!(modal && !modal.contains(el)), style: ring === false ? { focused: now[0], unfocused: base[0], fv: el.matches(':focus-visible') } : undefined };
})()`;

/** axe-core options: WCAG 2.2 A and AA plus best practices; violations only. */
const AXE_RUN = `(async () => {
  const r = await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
  return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 8).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\\n').slice(1, 3).join(' ').slice(0, 220) })), count: v.nodes.length }));
})()`;

module.exports = { LAYOUT_PROBE, FOCUS_BASELINE, FOCUS_STATE, AXE_RUN };
