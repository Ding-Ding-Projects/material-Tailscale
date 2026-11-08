// The Markdown articles bundled into the app's offline docs browser and the website.
// Every .md file under docs/ is an article, except folders of records: docs/sweep holds the
// latest every-surface sweep results, and docs/wiki holds wiki pages generated from these
// same articles while the wiki waits to be published.
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE = new Set(['sweep', 'wiki']);

/** Absolute paths of every bundled article, sorted. */
export function docFiles(root) {
  const docsDir = path.join(root, 'docs');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return d === docsDir && EVIDENCE.has(e.name) ? [] : walk(path.join(d, e.name));
    return e.name.endsWith('.md') ? [path.join(d, e.name)] : [];
  });
  return fs.existsSync(docsDir) ? walk(docsDir).sort() : [];
}
