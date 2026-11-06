# Handoff

## State (2026-11-06)

First complete build of Material Tailscale: Electron app, website, docs, release pipeline.

## Verification actually run

- `npm test`: 6 of 6 pass (catalogue integrity, argument validation, RFC 4226 HOTP vectors, RFC 6238 TOTP vectors for SHA-1, SHA-256 and SHA-512, admin catalogue coverage, settings explanations).
- Built app launched under Xvfb on Linux with Electron 37 and driven through 36 destinations in both themes; 73 PNGs in `docs/screenshots`. Tailscale was not installed there, so status-driven pages show the not-found state.
- The capture revealed and fixed two defects: untouched `set` flags were being sent, and `[hidden]` panes were visible.

## Not verified

- Running against a real Tailscale daemon and a real tailnet admin API token.
- The Windows release workflow and the Squirrel installer (first run happens on the push that adds it).
- Update flow from one release to the next.
- Narrator voices, camera QR scan and tray menu on Windows.

## Remaining work

See unchecked items in `ROADMAP.md`.

## Blockers

- The build session could not inspect self-hosted runners (proxy refused the Actions API), so the workflow uses GitHub-hosted `windows-latest`.
