# Material Tailscale

**Every Tailscale switch. One beautiful window.** A Material 3 Expressive desktop app for Windows that gives every Tailscale CLI command, every flag and every admin API setting a real, rich control.

**Website:** https://ding-ding-projects.github.io/material-Tailscale/ · **Download:** [latest release](https://github.com/Ding-Ding-Projects/material-Tailscale/releases/latest) · **Docs:** [docs/README.md](docs/README.md)

```powershell
.\build.bat --run
```

![Material Tailscale editing tailscale set preferences with rich controls](social-preview.png)

- **73 CLI commands and 197 flags**, each with a typed control (tri-state switches, segmented pickers, steppers, duration sliders, CIDR and tag chip editors, live peer, exit-node and account pickers, file browsers, masked secrets) and a live preview of the exact command.
- **93 admin API operations** generated from Tailscale's OpenAPI specification: devices, policy file, auth keys, DNS, users, tailnet settings, webhooks, logs and streaming, services, posture, invites, contacts, OAuth apps and organisations.
- Bespoke pages for peers, exit nodes, subnet routes, Serve and Funnel, Taildrop, MagicDNS, Tailnet Lock, Taildrive, certificates, accounts and diagnostics.
- English, Hong Kong Cantonese or both; Ctrl+Shift+F command palette; regex builder on every search; appearance editor on every element; locks, authenticator, local Git history, exports in every format, and full accessibility tools.
- **Base64 beside your files**: drop a file to write `report.pdf.base64.txt` next to it, drop that text to get `report.pdf` back, never overwriting, with every variant, strict error offsets, `data:` URLs, safe previews and a history with undo, all verified by a SHA-256 round trip ([how it works](docs/features/tools/base64.md)).
- **Extensions in any language** add actions to every device and checks to Diagnostics. Each one waits for your permission, sees only what you allow (never keys or tokens), and is stopped after five seconds; four built-in extensions come with the app ([how to write one](docs/features/extensions/writing-extensions.md)).

- **Ollama, all of it**: install, start and stop Ollama; browse every model and tag in the official catalogue with a fit verdict for this computer (and the numbers behind it); download through a cart that has no money in it; chat, create, copy and launch tools against a local model ([article](docs/features/tools/ollama.md)).
- **Virtual disks on Windows**: create, attach, grow, shrink, compact, convert and merge VHD and VHDX files, attach ISOs, and **Quick pack** dropped files into a new, automatically sized VHDX, checked file by file and never overwriting ([article](docs/features/tools/virtual-disks.md)).
- **Regex debugger** that steps through every attempt, match and backtrack ([article](docs/features/tools/regex-debugger.md)), and a **Features page** with the honest state of every feature ([inventory](docs/completeness.md)).
- **Portable companions** in every release: a build window that carries its own source, and the whole website working offline ([article](docs/features/release/companions.md)).

The installer is **unsigned**. Windows SmartScreen may warn about an unknown publisher; choose *More info* then *Run anyway*. Material Tailscale is independent and not affiliated with Tailscale Inc. Tailscale is a trademark of Tailscale Inc.

## Contents

<details>
<summary><b>Screens from the real app</b></summary>

Captured from the built app by `npm run screenshots` (Electron, both themes). Tailscale was not installed on the capture machine, so status pages show the honest "not found" state.

| | |
| --- | --- |
| ![Home, dark](docs/screenshots/dark-home.png) | ![Every command, dark](docs/screenshots/dark-cli.png) |
| ![tailscale set, dark](docs/screenshots/dark-cli-set.png) | ![Serve and Funnel target builder, dark](docs/screenshots/dark-cli-serve.png) |
| ![Admin console, light](docs/screenshots/light-admin.png) | ![Settings, light](docs/screenshots/light-settings.png) |
| ![Exit nodes, light](docs/screenshots/light-exit.png) | ![Command palette, light](docs/screenshots/light-palette.png) |
| ![Extensions manager, dark](docs/screenshots/dark-extensions.png) | ![Allowing an extension, dark](docs/screenshots/dark-extensions-overlayext-consent.png) |
| ![Base64 files converted beside their source, dark](docs/screenshots/dark-base64-overlayb64-demo.png) | ![Base64 toolkit, light](docs/screenshots/light-base64-overlayb64-demo.png) |
| ![Ollama store with every tag and its fit verdict, dark](docs/screenshots/dark-ollama-store.png) | ![Ollama chat, light](docs/screenshots/light-ollama-chat.png) |
| ![Virtual disks: create a disk, dark](docs/screenshots/dark-vdisks-create.png) | ![Regex debugger stepping through a backtracking pattern, dark](docs/screenshots/dark-regex-debug.png) |
| ![Features page, dark](docs/screenshots/dark-features.png) | ![Portable build companion, dark](docs/screenshots/dark-companion-build.png) |

All captures: [docs/screenshots](docs/screenshots).

Design parity: every screen is designed on a design canvas (two canvases: *Midnight Mesh 2* and *Everything added*) and compared with the real app ([how it works](docs/features/appearance/design-reference.md)).

![Design reference beside the real app for the Tools page](docs/design-parity/captures/tools/side-by-side.webp)

Every-surface sweep: before a release, every page, dialog, menu and overlay of the app and every page of the website is checked in both themes, all three language modes and four window sizes for accessibility rules, console errors, cut-off or overlapping text and keyboard focus ([how it works](docs/features/appearance/every-surface-sweep.md), [latest results](docs/sweep/summary.md)).

End-to-end recording (command palette, guided `tailscale set`, regex trace, Base64 files converted beside their source, Minecraft server wizard, settings), made by `npm run record` from the built app:

![End-to-end recording](docs/recording/end-to-end.gif)
</details>

<details>
<summary><b>Install and update</b></summary>

1. Download `MaterialTailscaleSetup.exe` from the [latest release](https://github.com/Ding-Ding-Projects/material-Tailscale/releases/latest) and run it.
2. Install [Tailscale](https://tailscale.com/download) if you have not; the app finds it in the standard folder or on PATH, or you can choose its location in Settings.
3. Updates are checked at startup and every four hours. When one is ready a banner offers **Restart to install update** or **Later**.

Installers are built with Squirrel.Windows (`Setup.exe`, `RELEASES`, full and delta `.nupkg`) and are never code-signed.
</details>

<details>
<summary><b>Build from source</b></summary>

| Command | What it does |
| --- | --- |
| `.\build.bat --run` | Installs dependencies (Node.js 22 via winget if missing, then `npm ci`), builds, runs tests, launches the app |
| `.\build-installer.bat` | Everything above, then the unsigned Squirrel.Windows installer in `out\installer` |
| `download-dependencies.bat` / `.sh` | Fetches pinned dependencies only |
| `npm run screenshots` | Drives the built app through every destination and writes PNGs (set `MT_CAPTURE_DIR`) |
| `npm run record` | Records an end-to-end path through the built app as `docs/recording/end-to-end.gif` |
| `npm run clip-matrix` | Checks every destination for cut-off text at 100, 125, 150 and 200% scale, in English, Cantonese and both, and at the minimum window size |
| `npm run sweep` | The release check: every app surface and website page in both themes, three language modes and four window sizes (axe-core, console, layout, keyboard walk); run under `xvfb-run` on Linux after building the app and the website |
| `npm run gen:postman` | Writes a Postman collection of every admin API operation to `docs/api/` |
| `npm run wiki` | Builds the GitHub wiki from `docs/` (`-- --push` to publish it, `-- --stage` to keep the pages in `docs/wiki/pending/` until it can be) |
| `npm test` | Catalogue, argument builder, RFC 4226 and RFC 6238 vectors, settings explanations |

All `.bat` scripts accept `/s`, `--silent` or `SILENT=1`.
</details>

<details>
<summary><b>Architecture</b></summary>

- `src/main/` Electron main process: window, tray, IPC, the tailscale runner (execFile with argument lists, never a shell), the admin API client (fixed host, documented paths only), the encrypted vault (Electron safeStorage) and local Git history (isomorphic-git).
- `src/shared/cli-catalog.js` every CLI command and flag; `buildArgs` validates every value. `src/shared/api-catalog.json` is generated from `vendor/tailscale-openapi/openapi.yaml` (BSD 3-Clause) by `npm run gen:api`.
- `src/renderer/` the interface: core state and language, rich controls, command and schema forms, pages.
- `site/` the website, which reuses the renderer modules through a browser shim.
- `design/canvas/` the design canvas the interface was built from; `design/REHEARSAL.md` how the latest design pass was reviewed and `design/HANDOFF.md` how to change the boards.
</details>

<details>
<summary><b>Project size</b></summary>

Counted by `node scripts/count-lines.mjs` (vendored spec, fonts, design canvas, generated catalogue and binaries excluded). Each release's notes carry the count for that tag.

| Category | Files | Lines | Non-blank |
| --- | ---: | ---: | ---: |
| See the latest release notes | | | |

How long a person would take: the release notes show the estimate with its method (non-blank lines at 15 to 30 finished lines per hour).
</details>

<details>
<summary><b>Shared agent instructions (sanitised)</b></summary>

Agents working here follow the maintainer's shared instructions. The parts that matter in this public repository, generalised:

- Save coherent work early: commit and push to the authorised branch promptly, never force-push, and read back the remote commit.
- Every push to `main` publishes a new tagged release through `.github/workflows/release.yml`; release notes state which checks actually ran.
- Keep `README.md`, `ROADMAP.md`, `HANDOFF.md`, `docs/` and the website current in the same change that alters behaviour.
- Destructive actions in the app use the two-key confirmation; never weaken security or expose credentials.
- Published text uses ordinary professional English. See `AGENTS.md`.
</details>

## Licence

MIT. See [LICENSE](LICENSE). The vendored Tailscale OpenAPI document is BSD 3-Clause. Fonts are under the SIL Open Font License and Apache 2.0 as published by Google Fonts.

## Shared agent instructions (sanitised mirror)

<details>
<summary>Show the mirrored rules</summary>

This is a sanitised mirror of the maintainer's shared agent instructions. It was last reviewed against its source on 2026-11-07, and `npm run check:instructions` reports when that source has changed since, using a lock kept beside the source instead of a hash in this repository. Machine names, paths, hosts, addresses and credentials are removed, and rules that needed them are stated in general terms. Do not edit it here expecting the change to spread: change the canonical instructions first, then refresh this copy.

**Delivery**
- Commit and push coherent work promptly to the authorised branch, then read back the remote commit before calling it done. Never force-push or rewrite published history.
- Every push to `main` publishes one tagged, normal (not draft, not prerelease) release. Release notes record:
  - which checks actually ran;
  - the measured workflow start, finish and duration;
  - line counts;
  - the release's dim sum code name, linked to the public catalogue photo.
- Continuous integration builds and releases. Tests and linters run locally in the task that changes the code; their results are reported honestly, and they never gate a release.
- Windows installers use Squirrel.Windows (`Setup.exe`, `RELEASES`, full and delta packages). They are unsigned and are verified as not signed. Installed copies update in the background and show the update as unsigned.
- The repository keeps working `build.bat` and `build-installer.bat` entry points.
- Every release also carries two portable, unsigned single-file companions: a build window over those entry points that carries its commit's complete source, and the whole website working offline.
- The README, the per-feature docs, the roadmap, the handoff notes, the wiki and the website stay current with behaviour in the same change.

**Every user-facing surface (app and website)**
- English, playful Hong Kong Cantonese and a compact bilingual mode. Two independent funny-level sliders, from 1 to 5, default to 5; facts never change with them.
- The version and its build-provenance time show on the front screen.
- A command palette on `Ctrl+Shift+F` reaches every page, setting and command. Its results carry live controls and teleport to the exact element.
- Every search, dropdown and context menu has its own filter and an anchored regex builder. Plain text is the default. Each regex builder is held to the full feature set of RegexBuddy, step-by-step debugging included.
- Context menus exist for every element. They show working shortcuts and live controls for values, and include Edit appearance… and Lock this element….
- A per-element appearance editor covers typography, colour, shape, layers, effects, and animation and transition, with reset and reduced motion respected.
- Browser-style tabs with pinning, groups, four kinds of tab search, and closing tabs that do or do not contain a text.
- Accessibility tools are reachable everywhere: high contrast, large targets, focus ring, reduced motion and read aloud.
- An optional narrator, optional action sounds, ADHD modes and School mode.
- A practical first-run setup wizard, and a guided mode on complex forms.
- Toy element locks (PIN, password, TOTP) with a playful unlock ladder and support tickets.
- A built-in TOTP authenticator, with secrets stored only in the system vault.
- Local version history with redaction, exports in common formats, and bulk actions.
- A local file converter with a searchable adapter catalogue.
- A local Base64 toolkit with every variant, strict error offsets, `data:` URLs, safe previews, exports and a history with undo. Dropping a file writes its Base64 beside it as the full name plus `.base64.txt`, and dropping that text writes the original back beside it with its name and extension restored, never overwriting; a website downloads the same names instead.
- A local Ollama manager and a Minecraft server manager.
- On Windows, a full virtual disk manager for VHD, VHDX and VHD Set files with ISO attach: every documented operation through a route that works on Windows Home, and Quick pack, which turns dropped files and folders into a new, automatically sized VHDX beside them, verifies every file and never overwrites.
- A dim sum surprise and app-logo presets.
- A personal-vocabulary JSON can be dropped on the window. It stays on the device.
- Destructive actions need a super confirmation. Notices never block work, and a failed operation offers a copyable help request.
- Extension support tailored to the app: a versioned manifest per extension folder, a language-neutral out-of-process protocol, declared permissions with consent before first use and after any change, limits on time and answer size, no sensitive values handed over, a searchable manager with a master switch, useful built-in extensions, a public authoring article with runnable samples, and tests and screenshots as proof.
- On Windows, a frameless title bar keeps the system minimise, maximise and close buttons through the title-bar overlay, so Snap layouts keep working, and the overlay colours follow the theme through validated messages.

**Design and evidence**
- A checked-in design reference has a plain viewer, a hand-written per-screen parity inventory, side-by-side and diff evidence, and a negative test.
- Screenshots and recordings come from the real built app. They are inspected, carry provenance, and contain no private data.
- Before every release, an automated sweep opens every state, dialog, menu, overlay and website page in both themes, every language mode and four window sizes (phone, tablet, a 1080p screen at 200 percent, desktop), and reports console errors and blocked content, accessibility violations (WCAG 2.2 AA and best practices), clipped, off-screen and overlapping text, and keyboard-focus problems. A release needs zero findings, each fixed at its source, followed by fresh screenshots and an honest before and after score on the design canvas.

**Safety and privacy**
- Never expose secrets or personal data in source, logs, exports, captures or public records.
- Preserve user data, settings and existing installations. Destructive operations require explicit confirmation.
- The maintainer's private conversation vocabulary never appears in anything published. Scan public text before publishing it.

</details>
