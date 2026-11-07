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

## Minecraft server manager

- Catalogue and exact download resolution checked live for Vanilla, Paper, Folia, Purpur, Fabric, Forge and Bedrock. PaperMC's v2 API is sunset; the app uses the Fill v3 API.
- Every server tab rendered under Xvfb against a sample registry (overview, console with typed command builder, configuration, players, world generator, schedule).
- Not run here: downloading and starting a real server jar, the data generator extraction, a generated world, Modrinth installs, SSH and Docker targets.

## Public-boundary sweep

- Every tracked text file passes the canonical public-boundary scan. This pass removed a personal nickname used as a sample tailnet name in a design board, private IPv4 example ranges (now RFC 5737 documentation ranges), and identifiers that matched governed words. The nickname remains in the design board's earlier commit (add934c); removing it from history needs a history rewrite, which is not done without the owner's explicit approval.

## Tooling added in the gap-closing pass

- `npm run record` produced `docs/recording/end-to-end.gif` (97 frames) from the built app under Xvfb.
- `npm run clip-matrix` checks cut-off text across scales, languages and the minimum window; first run found buttons shrinking in tight rows and a long timestamp, both fixed in CSS.
- The release workflow now has an install-proof job: previous release installed silently on a clean runner, updated with Update.exe to the new release, checked, uninstalled, and the result appended to the release notes. Its first real run happens on the next push.
- `npm run gen:postman` writes a collection covering all 93 admin API operations; a test checks the count and that no token is stored.
- `npm run wiki` builds 55 wiki pages. Publishing is blocked from the build machine: the wiki repository could not be cloned with the available credentials (it may also need its first page created on GitHub).
- `npm run check:instructions` compares a SHA-256 of the maintainer's private instructions to `.instructions-lock`; it skips with a reason wherever those instructions are absent.

## Not verified

- Running against a real Tailscale daemon and a real tailnet admin API token.
- Installing Setup.exe and the update from one release to the next on a real Windows machine.
- Update flow from one release to the next.
- Narrator voices, camera QR scan and tray menu on Windows.

## Remaining work

See unchecked items in `ROADMAP.md`.

## Blockers

- The build session could not inspect self-hosted runners (proxy refused the Actions API), so the workflow uses GitHub-hosted `windows-latest`.
