// Design-parity inventory validator. The inventory (docs/design-parity/inventory.json) is
// hand-written: every view of every checked-in design-canvas board appears exactly once with
// its reference and real-app routes, one capture tuple, a Material Design 3 primitive audit,
// raw captures, a labelled side-by-side comparison, visual-diff evidence and any reviewed
// deviation. validate() fails closed and returns every problem it finds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TUPLE_FIELDS = ['theme', 'width', 'height', 'scale', 'motion'];
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Views declared by each board through its data-props "view" options. */
/** The checked-in canvases: the main design and the one for everything added in the final pass. */
export const CANVASES = ['design/canvas', 'design/additions'];

export function boardViews(root) {
  const out = [];
  for (const rel of CANVASES) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.dc.html')).sort()) {
      const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/data-props='([^']*)'/);
      const props = m ? JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&')) : {};
      if (props.report) continue; // report boards record results; they are not screen designs
      for (const v of props.view?.options || ['default']) out.push(`${rel}/${f}#${v}`);
    }
  }
  return out;
}

export function validate(inv, root, { checkFiles = true } = {}) {
  const errors = [];
  const err = (id, msg) => errors.push(`${id}: ${msg}`);
  if (!inv || !Array.isArray(inv.screens)) return ['inventory: screens list is missing'];
  const seen = new Map();
  for (const s of inv.screens) {
    const id = s?.id || '(no id)';
    if (!s?.id) err(id, 'missing id');
    if (!s.reference || !/^design\/(canvas|additions)\/[A-Za-z0-9_-]+\.dc\.html$/.test(s.reference)) err(id, 'missing or invalid reference file');
    else if (checkFiles && !fs.existsSync(path.join(root, s.reference))) err(id, `reference file not found: ${s.reference}`);
    if (!s.view) err(id, 'missing reference view');
    const key = `${s.reference || ''}#${s.view}`;
    if (seen.has(key)) err(id, `reference view ${key} listed twice (also ${seen.get(key)})`); else seen.set(key, id);
    if (!s.referenceRoute || !s.referenceRoute.startsWith('dcref://board/')) err(id, 'missing design-reference route');
    if (!s.appRoute) err(id, 'missing real-app route');
    if (!s.state) err(id, 'missing screen state');
    for (const f of TUPLE_FIELDS) {
      if (s.tuple?.[f] === undefined || s.tuple?.[f] === '') err(id, `capture tuple field missing: ${f}`);
    }
    if (!Array.isArray(s.m3?.primitives) || !s.m3.primitives.length || !s.m3?.verdict) err(id, 'Material Design 3 audit missing');
    for (const k of ['reference', 'app']) {
      const p = s.captures?.[k];
      if (!p) err(id, `${k} capture path missing`); else if (checkFiles && !fs.existsSync(path.join(root, p))) err(id, `${k} capture not found: ${p}`);
    }
    if (!s.comparison) err(id, 'side-by-side comparison path missing'); else if (checkFiles && !fs.existsSync(path.join(root, s.comparison))) err(id, `comparison not found: ${s.comparison}`);
    if (!s.diff) err(id, 'visual-diff evidence path missing');
    else if (checkFiles) {
      const dp = path.join(root, s.diff);
      if (!fs.existsSync(dp)) err(id, `visual-diff evidence not found: ${s.diff}`);
      else {
        const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
        for (const f of TUPLE_FIELDS) if (d.tuple?.[f] !== s.tuple?.[f]) err(id, `diff tuple ${f} differs from the inventory tuple`);
        if (d.referenceTuple && JSON.stringify(d.referenceTuple) !== JSON.stringify(d.appTuple)) err(id, 'reference and app captures used different tuples');
        if (s.reference && fs.existsSync(path.join(root, s.reference)) && d.boardSha256 !== sha(path.join(root, s.reference))) err(id, 'evidence is stale: the board changed after the captures');
        for (const k of ['reference', 'app']) {
          const p = s.captures?.[k];
          if (p && fs.existsSync(path.join(root, p)) && d.captureSha256?.[k] !== sha(path.join(root, p))) err(id, `${k} capture does not match the diff evidence`);
        }
      }
    }
    for (const dv of s.deviations || []) if (!dv?.what || !dv?.reason || !dv?.approved) err(id, 'deviation without what, reason and approval');
  }
  for (const v of boardViews(root)) if (!seen.has(v)) errors.push(`${v}: checked-in reference view missing from the inventory`);
  return errors;
}
