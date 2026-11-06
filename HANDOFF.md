# Handoff

## State (2026-11-06)

First complete build of Material Tailscale: Electron app, website, docs, release pipeline.

## Verification actually run

- `npm test`: 6 of 6 pass (catalogue integrity, argument validation, RFC 4226 HOTP vectors, RFC 6238 TOTP vectors for SHA-1, SHA-256 and SHA-512, admin catalogue coverage, settings explanations).
- Built app launched under Xvfb on Linux with Electron 37 and driven through 36 destinations in both themes; 73 PNGs in `docs/screenshots`. Tailscale was not installed there, so status-driven pages show the not-found state.
- The capture revealed and fixed two defects: untouched `set` flags were being sent, and `[hidden]` panes were visible.

## Release proof

- v1.0.4 · Crab Roe Har Gow · 蟹籽蝦餃 published by the release workflow on commit 227d6aa: MaterialTailscaleSetup.exe (139 MB, unsigned), RELEASES, MaterialTailscale-1.0.4-full.nupkg and screenshots.zip (73 PNGs captured on the Windows runner). Notes carry line counts and measured timing (00:03:31).
- The website deployed through GitHub Pages and returns HTTP 200.
- Earlier runs v1.0.1 to v1.0.3 failed (long font file names on Windows checkout, missing npm install in the website job, release-notes step); each fix is in the history.

## Not verified

- Running against a real Tailscale daemon and a real tailnet admin API token.
- Installing Setup.exe and the update from one release to the next on a real Windows machine.
- Update flow from one release to the next.
- Narrator voices, camera QR scan and tray menu on Windows.

## Remaining work

See unchecked items in `ROADMAP.md`.

## Blockers

- The build session could not inspect self-hosted runners (proxy refused the Actions API), so the workflow uses GitHub-hosted `windows-latest`.
