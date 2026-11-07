// Minimal offline renderer for the checked-in design-canvas boards (*.dc.html).
// Served to each board as its ./support.js. It renders the board's own markup and
// logic class as written: {{holes}}, <sc-for>, <sc-if>, event attributes and
// setState. Nothing is copied or rebuilt from the board; this only interprets it.
(function () {
  'use strict';
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state) : patch) }; schedule(); }
    forceUpdate() { schedule(); }
  }
  window.DCLogic = DCLogic;

  let comp = null; let host = null; let template = null; let pending = false;
  const schedule = () => { if (!pending) { pending = true; queueMicrotask(() => { pending = false; render(); }); } };

  const literal = (p) => {
    if (p === 'true') return true; if (p === 'false') return false; if (p === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
    const m = p.match(/^'(.*)'$|^"(.*)"$/); if (m) return m[1] ?? m[2];
    return undefined;
  };
  function lookup(path, scope) {
    const p = path.trim(); const lit = literal(p); if (lit !== undefined || p === 'null') return lit;
    let v = scope; for (const k of p.split('.')) { if (v == null) return undefined; v = v[k]; }
    return v;
  }
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const whole = (s) => { const m = s.match(/^\{\{\s*([^}]+?)\s*\}\}$/); return m ? m[1] : null; };
  const interp = (s, scope) => s.replace(HOLE, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); });

  function renderNodes(nodes, scope, into) {
    for (const n of nodes) {
      if (n.nodeType === 3) { into.append(document.createTextNode(interp(n.nodeValue, scope))); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const list = lookup(whole(n.getAttribute('list') || '') || '', scope) || [];
        const as = n.getAttribute('as') || 'item';
        Array.from(list).forEach((item, i) => renderNodes(n.childNodes, Object.assign(Object.create(scope), { [as]: item, $index: i }), into));
        continue;
      }
      if (tag === 'sc-if') { if (lookup(whole(n.getAttribute('value') || '') || 'false', scope)) renderNodes(n.childNodes, scope, into); continue; }
      const el = document.createElementNS(n.namespaceURI, n.localName);
      for (const a of n.attributes) {
        if (a.name.startsWith('hint-')) continue;
        const w = whole(a.value);
        if (/^on[a-z]/i.test(a.name) && w) { const fn = lookup(w, scope); if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn); continue; }
        if (w) { const v = lookup(w, scope); if (v === undefined || v === null || v === false && !a.name.startsWith('aria-')) continue; el.setAttribute(a.name, String(v)); continue; }
        el.setAttribute(a.name, a.value.includes('{{') ? interp(a.value, scope) : a.value);
      }
      renderNodes((tag === 'template' ? n.content : n).childNodes, scope, el);
      into.append(el);
    }
  }

  function render() {
    const vals = comp.renderVals() || {};
    const frag = document.createDocumentFragment();
    renderNodes(template, vals, frag);
    host.replaceChildren(frag);
    document.documentElement.dataset.dcRendered = String(Number(document.documentElement.dataset.dcRendered || 0) + 1);
  }

  function boot() {
    host = document.querySelector('x-dc');
    const script = document.querySelector('script[data-dc-script]');
    if (!host || !script) { document.documentElement.dataset.dcError = 'missing x-dc or logic script'; return; }
    host.style.display = 'contents';
    const helmet = host.querySelector('helmet');
    if (helmet) { for (const c of Array.from(helmet.children)) document.head.append(c); helmet.remove(); }
    template = Array.from(host.childNodes).map((n) => n.cloneNode(true));
    host.replaceChildren();
    let declared = {};
    try { declared = JSON.parse(script.getAttribute('data-props') || '{}'); } catch { document.documentElement.dataset.dcError = 'invalid data-props'; }
    const props = {};
    const q = new URLSearchParams(location.search);
    for (const [k, d] of Object.entries(declared)) if (!k.startsWith('$')) props[k] = q.has(k) ? q.get(k) : d && d.default;
    let Component;
    try { Component = new Function('DCLogic', `${script.textContent}\n;return Component;`)(DCLogic); } catch (e) { document.documentElement.dataset.dcError = String(e.message); return; }
    comp = new Component(props);
    render();
    document.fonts.ready.then(() => { document.documentElement.dataset.dcReady = '1'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
