// Opens one capture route in the built renderer. A route is "dest" or "dest:arg", optionally
// followed by ">press", where press is a visible button label, overlay@kind#arg,
// menu@<data-el>, appearance@<data-el>#tab or click@<data-el>. Shared by screenshot
// capture and the every-surface sweep so both open exactly the same states.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openRoute(wc, d, { settle = 900 } = {}) {
  const [route, press] = d.split('>');
  const [dest, arg] = route.split(':');
  await wc.executeJavaScript("(window.__mtCloseOverlays ? window.__mtCloseOverlays() : document.querySelectorAll('.popover, .panel-float, .scrim, .palette').forEach((x) => x.remove())), true");
  await wc.executeJavaScript(`window.__mtOpen(${JSON.stringify(dest)}, ${JSON.stringify(arg || undefined)}); true`);
  await wait(settle);
  if (!press) return;
  if (press.startsWith('overlay@')) {
    const [kind, oarg] = press.slice(8).split('#');
    await wc.executeJavaScript(`window.__mtOverlay(${JSON.stringify(kind)}, ${JSON.stringify(oarg || '')})`);
    await wait(1200);
  } else if (press.startsWith('menu@')) {
    await wc.executeJavaScript(`window.__mtContext(${JSON.stringify(press.slice(5))})`);
    await wait(900);
  } else if (press.startsWith('appearance@')) {
    const [elId, tab] = press.slice(11).split('#');
    await wc.executeJavaScript(`window.__mtAppearance(${JSON.stringify(elId)}, ${JSON.stringify(tab || '')})`);
    await wait(1200);
  } else if (press.startsWith('click@')) {
    await wc.executeJavaScript(`document.querySelector(${JSON.stringify(`[data-el="${press.slice(6)}"]`)})?.click(); true`);
    await wait(900);
  } else {
    await wc.executeJavaScript(`[...document.querySelectorAll('button')].find((b) => { const x = b.textContent.trim(); return b.offsetParent && (x.endsWith(${JSON.stringify(press)}) || x.includes(${JSON.stringify(press + ' · ')})); })?.click(); true`);
    await wait(1200);
  }
}

module.exports = { openRoute, wait };
