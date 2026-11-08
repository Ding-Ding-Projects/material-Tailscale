// Builds the GitHub wiki from docs/ (Home, sidebar and one page per article)
// into out/wiki. With --push it clones the wiki repository, replaces its
// pages and pushes a normal (never forced) commit. The wiki must already
// have its first page created on GitHub before it can be cloned. With --stage
// it also keeps the prepared pages in the repository under docs/wiki/pending/,
// with an inventory, so they are not lost while the wiki cannot be reached;
// docs/wiki is not bundled as articles.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out', 'wiki');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const pages = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) pages.push(p); } };
walk(path.join(root, 'docs', 'features'));
const slugOf = (name) => name.replace(/ - /g, '-').replace(/ /g, '-');
const nameOf = (file) => path.relative(path.join(root, 'docs', 'features'), file).replace(/\.md$/, '').split(path.sep).map((s) => s.replace(/(^|-)(\w)/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase())).join(' - ');
const groups = new Map();
for (const file of pages.sort()) {
  const name = nameOf(file);
  const slug = slugOf(name);
  let body = fs.readFileSync(file, 'utf8').replace(/\]\((?:\.\.\/)*([\w-]+\/)?([\w-]+)\.md\)/g, (_, dir, base) => `](${nameOf(path.join(root, 'docs', 'features', dir || path.basename(path.dirname(file)), base + '.md')).replace(/ - /g, '-').replace(/ /g, '-')})`);
  fs.writeFileSync(path.join(out, `${slug}.md`), body);
  const g = path.basename(path.dirname(file));
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push([name.split(' - ').pop(), slug]);
}
const index = [...groups].map(([g, xs]) => `### ${g[0].toUpperCase() + g.slice(1)}\n\n${xs.map(([t, s]) => `- [${t}](${s})`).join('\n')}`).join('\n\n');
fs.writeFileSync(path.join(out, 'Home.md'), `# Material Tailscale\n\nOne page per feature, generated from the repository's docs folder. Edit the docs in the repository; this wiki is overwritten on every sync.\n\n${index}\n`);
fs.writeFileSync(path.join(out, '_Sidebar.md'), `[Home](Home)\n\n${index.replace(/### /g, '**').replace(/\n\n-/g, '**\n\n-')}\n`);
console.log(`${pages.length} pages written to ${path.relative(root, out)}`);
if (process.argv.includes('--stage')) {
  const dest = path.join(root, 'docs', 'wiki', 'pending');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const names = fs.readdirSync(out).filter((f) => f.endsWith('.md')).sort();
  for (const f of names) fs.copyFileSync(path.join(out, f), path.join(dest, f));
  let commit = 'unknown';
  try { commit = execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  fs.writeFileSync(path.join(root, 'docs', 'wiki', 'README.md'), [
    '# Wiki pages waiting to be published',
    '',
    'The repository wiki has no first page yet, so it cannot be cloned or pushed to. Until it',
    'can, the pages `npm run wiki` prepares are kept here, so nothing is lost.',
    '',
    '- Destination: `https://github.com/Ding-Ding-Projects/material-Tailscale.wiki.git`',
    `- Prepared from commit \`${commit}\` by \`node scripts/sync-wiki.mjs --stage\`; regenerate them the same way.`,
    '- State: **not published**. Create any first page in the wiki on GitHub, then run',
    '  `npm run wiki -- --push`, and read the pages back on GitHub.',
    '',
    `## Pages (${names.length})`,
    '',
    ...names.map((f) => `- [${f.replace(/\.md$/, '')}](pending/${f})`),
    ''
  ].join('\n'));
  console.log(`${names.length} pages kept in docs/wiki/pending`);
}
if (process.argv.includes('--push')) {
  const remote = process.env.WIKI_REMOTE || 'https://github.com/Ding-Ding-Projects/material-tailscale.wiki.git';
  const clone = path.join(root, 'out', 'wiki-clone');
  fs.rmSync(clone, { recursive: true, force: true });
  execFileSync('git', ['clone', '--depth', '1', remote, clone], { stdio: 'inherit' });
  for (const f of fs.readdirSync(clone)) if (f.endsWith('.md')) fs.rmSync(path.join(clone, f));
  for (const f of fs.readdirSync(out)) fs.copyFileSync(path.join(out, f), path.join(clone, f));
  execFileSync('git', ['-C', clone, 'add', '-A'], { stdio: 'inherit' });
  try { execFileSync('git', ['-C', clone, 'commit', '-m', 'Sync documentation from the repository'], { stdio: 'inherit' }); } catch { console.log('Wiki already up to date.'); process.exit(0); }
  execFileSync('git', ['-C', clone, 'push'], { stdio: 'inherit' });
}
