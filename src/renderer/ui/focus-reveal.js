// Keeps the keyboard-focused control on screen. Chromium scrolls most controls into view
// when they take focus, but not a read-only text box, so Tab could land on an output box
// below the fold and leave it there. After each keyboard focus this checks the control
// against the window and every clipping or scrolling box around it, and scrolls only as far
// as needed when any part of it is out of sight.
const OVERFLOW = /(auto|scroll|hidden|clip)/;

function outOfSight(el) {
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return false;
  if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return true;
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (!OVERFLOW.test(cs.overflowX + ' ' + cs.overflowY)) continue;
    const p = n.getBoundingClientRect();
    if (r.top < p.top - 1 || r.bottom > p.bottom + 1 || r.left < p.left - 1 || r.right > p.right + 1) return true;
  }
  return false;
}

export function revealFocus(root = document) {
  root.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.matches(':focus-visible')) return;
    if (outOfSight(el)) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
