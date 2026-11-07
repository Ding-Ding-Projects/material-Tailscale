// Checks the feature inventory (src/shared/feature-inventory.js) against the repository and a
// hand-written list of features that must be present, and renders docs/completeness.md from it.
import fs from 'node:fs';
import path from 'node:path';

const VALID = new Set(['done', 'built', 'partial', 'todo', 'na']);

/** Returns a list of problems; an empty list means the inventory is complete and its evidence exists. */
export function validate({ FEATURES, STATES, CATEGORIES }, root, required) {
  const errors = [];
  const ids = new Set();
  for (const x of FEATURES) {
    if (ids.has(x.id)) errors.push(`${x.id}: listed twice`);
    ids.add(x.id);
    if (!CATEGORIES[x.category]) errors.push(`${x.id}: unknown category ${x.category}`);
    for (const k of ['title', 'benefit', 'how']) if (!Array.isArray(x[k]) || x[k].length !== 2 || !x[k][0] || !x[k][1]) errors.push(`${x.id}: ${k} needs English and Cantonese`);
    if (x.note && (x.note.length !== 2 || !x.note[0] || !x.note[1])) errors.push(`${x.id}: note needs English and Cantonese`);
    for (const s of ['app', 'site', 'repo']) if (!VALID.has(x.state[s]) || !STATES[x.state[s]]) errors.push(`${x.id}: ${s} state ${x.state[s]} is not a state`);
    const states = Object.values(x.state);
    if (states.every((s) => s === 'na') && !x.note) errors.push(`${x.id}: applies nowhere and does not say why`);
    if (states.some((s) => s === 'partial' || s === 'todo' || s === 'built') && !x.note) errors.push(`${x.id}: unfinished or unproven without a note saying what is left`);
    if (states.some((s) => s === 'done' || s === 'built') && !x.impl.length && !x.article && !x.capture) errors.push(`${x.id}: marked built with no evidence`);
    for (const p of x.impl) if (!fs.existsSync(path.join(root, p))) errors.push(`${x.id}: evidence ${p} does not exist`);
    if (x.article && !fs.existsSync(path.join(root, 'docs', x.article))) errors.push(`${x.id}: article docs/${x.article} does not exist`);
    if (x.capture && !fs.existsSync(path.join(root, 'docs/screenshots', x.capture))) errors.push(`${x.id}: screenshot docs/screenshots/${x.capture} does not exist`);
  }
  for (const id of required) if (!ids.has(id)) errors.push(`${id}: required feature missing from the inventory`);
  return errors;
}

const mark = { done: 'finished', built: 'built, proof pending', partial: 'partly built', todo: 'not started', na: 'n/a' };

/** docs/completeness.md, generated: one table per category, every surface, evidence and notes. */
export function render({ FEATURES, CATEGORIES }) {
  const out = ['# Completeness inventory', '', 'Generated from `src/shared/feature-inventory.js` by `npm run gen:completeness`; edit the inventory, not this file. The Features page in the app and on the website shows the same rows with search and filters. A state of "built, proof pending" means the check it needs cannot run on the build machine; the note says which.', ''];
  for (const [k, c] of Object.entries(CATEGORIES)) {
    const rows = FEATURES.filter((x) => x.category === k);
    if (!rows.length) continue;
    out.push(`## ${c.en}`, '', '| Feature | App | Website | Repository | Evidence | Note |', '| --- | --- | --- | --- | --- | --- |');
    for (const x of rows) {
      const ev = [...x.impl.map((p) => `\`${p}\``), x.article ? `[article](${x.article})` : null, x.capture ? `[screenshot](screenshots/${x.capture})` : null].filter(Boolean).join(', ') || '—';
      out.push(`| ${x.title[0]} | ${mark[x.state.app]} | ${mark[x.state.site]} | ${mark[x.state.repo]} | ${ev} | ${x.note ? x.note[0] : ''} |`);
    }
    out.push('');
  }
  out.push('Unfinished items are also unchecked items in `ROADMAP.md`.', '');
  return out.join('\n');
}
