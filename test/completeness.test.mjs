import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validate, render } from '../scripts/lib/completeness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = await import(pathToFileURL(path.join(root, 'src/shared/feature-inventory.js')).href);

// Hand-written on purpose: every feature of the shared list and of Tailscale that this project
// owes. A rule cannot notice a feature that was never listed, so this list is the check.
const REQUIRED = `
tailscale-commands tailscale-peers tailscale-exit-nodes tailscale-routes tailscale-serve tailscale-taildrop
tailscale-dns tailscale-lock tailscale-drive tailscale-certs tailscale-accounts tailscale-diagnostics
tailscale-admin tailscale-console
language-modes funny-levels personal-vocabulary school-mode narrator action-sounds scheduled-settings
display-name adhd-modes dim-sum job-wording
material-design motion live-charts appearance-editor color-picker logos overlays collapsible-filters
accessibility empty-states tabs windows-title-bar
command-palette context-menus rich-controls guided-forms settings-explanations regex-builder folder-search
onboarding progress-recovery features-page blank-presets
super-confirmation element-locks authenticator honest-pricing
local-history exports bulk-actions changelog offline-docs rendered-text notifications
base64 file-converter drawing ollama minecraft world-generator extensions virtual-disks
design-reference screenshots sweep clipping-matrix front-version social-preview
installer release-every-push build-entrypoints build-companion website-companion website
readme roadmap handoff feature-articles postman wiki instruction-mirror vocabulary-lock status-hub
`.trim().split(/\s+/);

test('every required feature is in the inventory, and every claim has its evidence', () => {
  assert.deepEqual(validate(inv, root, REQUIRED), []);
});

test('the inventory check catches a missing feature, missing evidence and an unexplained gap', () => {
  const without = { ...inv, FEATURES: inv.FEATURES.filter((x) => x.id !== 'base64') };
  assert.ok(validate(without, root, REQUIRED).some((e) => e.startsWith('base64: required feature missing')));
  const fake = { ...inv, FEATURES: inv.FEATURES.map((x) => (x.id === 'drawing' ? { ...x, impl: ['src/no-such-file.js'] } : x)) };
  assert.ok(validate(fake, root, REQUIRED).some((e) => e.includes('src/no-such-file.js does not exist')));
  const silent = { ...inv, FEATURES: inv.FEATURES.map((x) => (x.id === 'ollama' ? { ...x, note: null } : x)) };
  assert.ok(validate(silent, root, REQUIRED).some((e) => e.startsWith('ollama: unfinished or unproven without a note')));
});

test('docs/completeness.md is generated from the current inventory', () => {
  assert.equal(fs.readFileSync(path.join(root, 'docs/completeness.md'), 'utf8'), render(inv));
});
