# Closeout prompt

```text
Continue Material Tailscale (Ding-Ding-Projects/material-Tailscale). The work is on branch
ai/polish/20261107-final-sweep, ahead of main. Read HANDOFF.md and ROADMAP.md first.

State when this was written (2026-11-07, afternoon):
- The last two Release runs on main failed in Squirrel packaging (the GitHub sync collided on
  duplicate delta packages). This branch ships one full and one delta package per release,
  which fixes it; nothing is merged into main yet.
- Built in the app and the website: the Features page, the Ollama suite, the virtual disk
  manager, the regex debugger, two portable companions, the wording lock, and the
  instruction-mirror lock kept beside the private source instead of a hash in this repository.
- A targeted sweep of every surface changed today found 443 findings (21 distinct problems).
  All were fixed at the source, and a re-run of the same surfaces (744 checks) reports zero.
- The clipping matrix was running. Its first configurations flagged only screen-reader-only
  text, which the probe now skips, as the sweep's probe already did.
- Design boards changed after the last parity run, so the two parity tests in npm test stay
  red until the parity evidence is regenerated.

Next, in order:
1. Rebuild from a clean tree: npm run build && node scripts/build-site.mjs &&
   node scripts/build-companions.mjs --stage-only
2. Clipping matrix on every sweep route (MT_CAPTURE_DESTS from scripts/lib/sweep-routes.mjs,
   MT_CLIP_THEMES=dark,light): 100, 125, 150 and 200 percent plus the minimum window, every
   language mode. Fix anything real, then mark the clipping-matrix row done in
   src/shared/feature-inventory.mjs (npm run gen:completeness) and tick ROADMAP.md.
3. Fresh screenshots (MT_CAPTURE_DIR=docs/screenshots npm run screenshots, and
   scripts/capture-companions.mjs), then rebuild the website.
4. Full release sweep in three parts (desktop and small, tablet and mobile, website), merge,
   zero findings; node scripts/sweep-history.mjs; npm run design:boards for the sweep board.
5. npm run design:parity, node scripts/design-frames.mjs, npm test all green.
6. Republish both design canvases, merge the branch into main, push, watch Release,
   install-proof, vdisk-proof and Website, then read back the release (Setup.exe NotSigned,
   both companions attached) and the live website.
Still open after that: VHD Set creation and checkpoints, VHDX metadata, mirroring, change
tracking and identity reset in the virtual disk manager; other engines in the regex benchmark
and editor integration; Discussions (a repository settings change); a real tailnet on Windows.
Rules: ordinary professional English in committed files and commit messages; never
force-push; never add code signing.
```
