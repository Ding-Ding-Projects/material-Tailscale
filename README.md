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

All captures: [docs/screenshots](docs/screenshots).

End-to-end recording (command palette, guided `tailscale set`, regex trace, Minecraft server wizard, settings), made by `npm run record` from the built app:

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
| `npm run gen:postman` | Writes a Postman collection of every admin API operation to `docs/api/` |
| `npm run wiki` | Builds the GitHub wiki from `docs/` (`-- --push` to publish it) |
| `npm test` | Catalogue, argument builder, RFC 4226 and RFC 6238 vectors, settings explanations |

All `.bat` scripts accept `/s`, `--silent` or `SILENT=1`.
</details>

<details>
<summary><b>Architecture</b></summary>

- `src/main/` Electron main process: window, tray, IPC, the tailscale runner (execFile with argument lists, never a shell), the admin API client (fixed host, documented paths only), the encrypted vault (Electron safeStorage) and local Git history (isomorphic-git).
- `src/shared/cli-catalog.js` every CLI command and flag; `buildArgs` validates every value. `src/shared/api-catalog.json` is generated from `vendor/tailscale-openapi/openapi.yaml` (BSD 3-Clause) by `npm run gen:api`.
- `src/renderer/` the interface: core state and language, rich controls, command and schema forms, pages.
- `site/` the website, which reuses the renderer modules through a browser shim.
- `design/canvas/` the design canvas the interface was built from.
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
