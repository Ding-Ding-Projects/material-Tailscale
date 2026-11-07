// Keyboard access for scrolling regions. A box whose content scrolls but holds nothing
// focusable cannot be scrolled from the keyboard, so it becomes a focusable, named group.
// Runs after DOM and text changes, when a candidate box changes size (including when it
// first becomes visible), when web fonts finish loading and on resize; it never touches
// boxes that already have focusable content or their own tabindex.
import { pair } from '../core/i18n.js';

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Boxes being watched for size changes; boxes that left the page are let go on each scan.
const watched = new Set();

function scan(root, sizes) {
  for (const el of watched) if (!el.isConnected) { sizes.unobserve(el); watched.delete(el); }
  for (const el of root.querySelectorAll('.out, .md, .tbl-wrap, .cmdline, pre, .scroll-y, [data-scrollable]')) {
    if (el.dataset.scrollFocus === 'own') continue;
    if (!watched.has(el)) { watched.add(el); sizes.observe(el); }
    const scrolls = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    const cs = scrolls ? getComputedStyle(el) : null;
    const canScroll = scrolls && /(auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`);
    const managed = el.dataset.scrollFocus === 'on';
    if (canScroll && !managed && !el.hasAttribute('tabindex') && !el.querySelector(FOCUSABLE)) {
      el.tabIndex = 0;
      el.dataset.scrollFocus = 'on';
      if (!el.getAttribute('role')) { el.setAttribute('role', 'group'); el.dataset.scrollRole = '1'; }
      if (!el.getAttribute('aria-label')) { el.setAttribute('aria-label', el.dataset.label || pair('Scrollable content', '可捲動內容')); el.dataset.scrollName = '1'; }
    } else if (!canScroll && managed) {
      el.removeAttribute('tabindex');
      if (el.dataset.scrollRole) el.removeAttribute('role');
      if (el.dataset.scrollName) el.removeAttribute('aria-label');
      delete el.dataset.scrollFocus; delete el.dataset.scrollRole; delete el.dataset.scrollName;
    }
  }
}

// A change is scanned on the next animation frame, so a box that starts to scroll gets keyboard
// access before it is painted, even when the page is still busy rendering; a second scan 150 ms
// after the last change catches layout that settles later (transitions, images, late fonts).
export function watchScrollRegions(root = document.body) {
  let t = null, frame = 0;
  const now = () => { frame = 0; scan(root, sizes); };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(now);
    clearTimeout(t); t = setTimeout(now, 150);
  };
  const sizes = new ResizeObserver(later);
  new MutationObserver(later).observe(root, { childList: true, subtree: true, characterData: true });
  document.fonts?.addEventListener?.('loadingdone', later);
  addEventListener('resize', later);
  later();
}
