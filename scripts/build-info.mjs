// Writes dist/build-info.json: version, commit, commit time and dim sum code
// name, bound to the source being built. Never uses the launch time.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; } };
const info = {
  version: process.env.MT_VERSION || pkg.version,
  commit: process.env.GITHUB_SHA || git('rev-parse', 'HEAD'),
  commitTime: git('log', '-1', '--format=%cI'),
  codeName: process.env.MT_CODENAME || null,
  photoUrl: process.env.MT_PHOTO_URL || null,
  builtBy: process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'local build',
  // Uncommitted source changes at build time (a local build of a dirty tree is not a release build).
  dirtyTree: process.env.GITHUB_ACTIONS ? false : Boolean(git('status', '--porcelain'))
};
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'build-info.json'), JSON.stringify(info, null, 2));
console.log('build-info', info);
