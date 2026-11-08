# Closeout prompt

```text
Continue Material Tailscale (Ding-Ding-Projects/material-Tailscale). Read HANDOFF.md and
ROADMAP.md first.

State when this was written (2026-11-08):
- Branch ai/polish/20261107-final-sweep is being merged into main by fast-forward in the commit
  that carries this file. Main's last two Release runs had failed in Squirrel packaging; this
  branch ships one full and one delta package per release, which is the fix. The Release,
  install-proof, vdisk-proof and Website runs of this push still have to be watched.
- The virtual disk manager is finished: every operation goes through the Windows virtual disk
  API and the Storage module (DiskPart is no longer used), VHD Sets are created through the API
  with CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE, and the Advanced section renews
  identifiers, edits VHDX metadata, tracks changed blocks, manages VHD Set checkpoints and
  mirrors a disk. Shrink can shrink the last partition first. The proof script ran on a hosted
  Windows runner with 60 results and no failures (branch probe/vdisk-api).
- A page-render race is fixed: an older page could paint over a newer one when navigation and
  a view transition overlapped; captures now wait for the page they asked for.
- Release sweep on the build of 04996f1: 3,816 checks, zero findings. The surfaces changed
  since then were swept again on the final build: 456 checks, zero findings, and the changelog,
  the notices demo and the Advanced view once more after the last fixes: 144 checks, zero.
- Design canvases republished; design parity evidence regenerated for 66 views.

Next, in order:
1. Run the full sweep on the release commit (three parts: desktop and small, tablet and mobile,
   website; --resume if a part is stopped), node scripts/sweep-history.mjs, then
   npm run design:boards, and tick the sweep item in ROADMAP.md.
2. Watch the Release, install-proof, vdisk-proof and Website runs of every push to main; read
   back each release (Setup.exe NotSigned, both companions attached) and the live website.
Still open: a real tailnet on Windows (running a daemon needs the owner's permission), other
engines in the regex benchmark and editor integration, adapters for the remaining
file-converter format families, Discussions (a repository settings change), the status
service (reachable only from the owner's network), Ollama and Minecraft runtime checks.
Rules: ordinary professional English in committed files and commit messages; never
force-push; never add code signing.
```
