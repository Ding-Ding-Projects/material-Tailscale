// Writes the release notes and publishes the GitHub release with gh.
// Any failure is reported as a workflow error annotation with its detail.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const fail = (msg) => { console.log(`::error title=publish-release::${String(msg).replace(/\r?\n/g, '%0A').slice(0, 3000)}`); process.exit(1); };
const run = (cmd, args, opts = {}) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }); }
  catch (e) { fail(`${cmd} ${args.join(' ')} failed: ${e.stderr || e.message}`); }
};
const env = process.env;
const version = env.MT_VERSION;
if (!version) fail('MT_VERSION is not set');
const out = path.resolve('out');
const installer = path.join(out, 'installer');
const files = fs.existsSync(installer) ? fs.readdirSync(installer) : [];
const setup = files.find((f) => /Setup\.exe$/i.test(f));
if (!setup) fail(`No Setup.exe in out/installer (found: ${files.join(', ') || 'nothing'})`);
const assets = files.filter((f) => /Setup\.exe$|^RELEASES$|\.nupkg$/i.test(f)).map((f) => path.join(installer, f));
const lines = fs.existsSync(path.join(out, 'line-counts.md')) ? fs.readFileSync(path.join(out, 'line-counts.md'), 'utf8') : 'Line count unavailable.';
const subject = run('git', ['log', '-1', '--format=%s']).trim();
const notes = [
  `## Material Tailscale v${version}`, '',
  env.MT_CODENAME ? `**Code name:** ${env.MT_CODENAME}\n\n![${env.MT_CODENAME}](${env.MT_PHOTO_URL})\n` : 'Code name unavailable: the public dim sum catalogue could not be read.\n',
  `Commit: ${env.GITHUB_SHA}`, '',
  '### Install',
  'Download **MaterialTailscaleSetup.exe** below and run it. The installer is **unsigned**, so Windows SmartScreen may warn about an unknown publisher. Installed copies update themselves from this release feed and ask before restarting.', '',
  '### Checks',
  'This release workflow runs no automated test or lint gate. Local checks for this commit are recorded in HANDOFF.md.', '',
  '### Changes', `- ${subject}`, '',
  '### Line counts', lines
].join('\n');
fs.writeFileSync(path.join(out, 'notes.md'), notes);
const tag = `v${version}`;
const title = env.MT_CODENAME ? `${tag} · ${env.MT_CODENAME}` : tag;
run('gh', ['release', 'create', tag, ...assets, '--title', title, '--notes-file', path.join(out, 'notes.md'), '--target', env.GITHUB_SHA]);
const shots = path.join(out, 'screenshots');
if (fs.existsSync(shots) && fs.readdirSync(shots).some((f) => f.endsWith('.png'))) {
  try { run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${shots}\\*.png' -DestinationPath '${path.join(out, 'screenshots.zip')}' -Force`]); run('gh', ['release', 'upload', tag, path.join(out, 'screenshots.zip')]); }
  catch { console.log('::warning::Screenshots were not attached.'); }
}
const started = new Date(env.MT_STARTED);
const done = new Date();
const secs = Math.max(0, Math.round((done - started) / 1000));
const pad = (n) => String(n).padStart(2, '0');
const timing = `\n\n### Workflow timing\n- Workflow started: ${started.toISOString().replace(/\.\d{3}Z$/, 'Z')}\n- Workflow completed: ${done.toISOString().replace(/\.\d{3}Z$/, 'Z')}\n- Workflow duration: ${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}\n`;
fs.appendFileSync(path.join(out, 'notes.md'), timing);
run('gh', ['release', 'edit', tag, '--notes-file', path.join(out, 'notes.md')]);
console.log(`Published ${tag} with ${assets.length} installer assets.`);
