# Closeout prompt

```text
Continue Material Tailscale (Ding-Ding-Projects/material-Tailscale). Read HANDOFF.md and
ROADMAP.md first.

State when this was written (2026-11-08):
- main is at the commit that carries this file. The branch ai/polish/20261107-final-sweep was
  merged into main by fast-forward at c116078 and released as v1.0.15: the release, install
  proof (v1.0.12 updated to v1.0.15 and uninstalled) and virtual disk proof (60 results, none
  failed) all passed in run 42510325402, and the website serves that commit.
- The full every-surface sweep on the build of c116078 reported 3,840 checks and zero findings;
  it is recorded in docs/sweep/ and the sweep item in ROADMAP.md is ticked.
- The virtual disk manager is finished: every operation goes through the Windows virtual disk
  API and the Storage module (DiskPart is no longer used), VHD Sets are created through the API
  with CREATE_VIRTUAL_DISK_FLAG_CREATE_BACKING_STORAGE, and the Advanced section renews
  identifiers, edits VHDX metadata, tracks changed blocks, manages VHD Set checkpoints and
  mirrors a disk. Shrink can shrink the last partition first.
- Design canvases are republished; design parity covers 66 views; npm test passes 80 of 80.

Next, in order:
1. Watch the Release, install-proof, vdisk-proof and Website runs of the push that carries this
   file, and read back the release (Setup.exe NotSigned, both companions attached) and the live
   website.
Still open: a real tailnet on Windows (running a daemon needs the owner's permission), other
engines in the regex benchmark and editor integration, adapters for the remaining
file-converter format families, Discussions (a repository settings change), the status
service (reachable only from the owner's network), Ollama and Minecraft runtime checks.
Rules: ordinary professional English in committed files and commit messages; never
force-push; never add code signing.
```
