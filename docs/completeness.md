# Completeness inventory

Generated from `src/shared/feature-inventory.mjs` by `npm run gen:completeness`; edit the inventory, not this file. The Features page in the app and on the website shows the same rows with search and filters. A state of "built, proof pending" means the check it needs cannot run on the build machine; the note says which.

## Tailscale

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Every Tailscale command | built, proof pending | n/a | n/a | `src/shared/cli-catalog.js`, `src/renderer/ui/command-form.js`, [article](features/tailscale/cli-commands.md), [screenshot](screenshots/dark-cli-set.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Peers and live status | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/peers.md), [screenshot](screenshots/dark-peers.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Exit nodes | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, `src/renderer/ui/controls.js`, [article](features/tailscale/exit-nodes.md), [screenshot](screenshots/dark-exit.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Subnet routes | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/subnet-routes.md), [screenshot](screenshots/dark-routes.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Serve and Funnel | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/serve-funnel.md), [screenshot](screenshots/dark-serve.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Taildrop | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/taildrop.md), [screenshot](screenshots/dark-taildrop.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| MagicDNS | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/magicdns.md), [screenshot](screenshots/dark-dns.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Tailnet Lock | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, `src/renderer/ui/safety.js`, [article](features/tailscale/tailnet-lock.md), [screenshot](screenshots/dark-lock.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Taildrive | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/taildrive.md), [screenshot](screenshots/dark-drive.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Certificates | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/certificates.md), [screenshot](screenshots/dark-certs.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Accounts | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/accounts.md), [screenshot](screenshots/dark-accounts.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Diagnostics | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/diagnostics.md), [screenshot](screenshots/dark-diagnostics.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |
| Admin console | built, proof pending | n/a | n/a | `src/renderer/pages/admin.js`, `src/shared/api-catalog.json`, [article](features/tailscale/admin-console.md), [screenshot](screenshots/dark-admin.png) | Not yet checked against a live admin API from the build machine. |
| Raw console | built, proof pending | n/a | n/a | `src/renderer/pages/tailscale.js`, [article](features/tailscale/raw-console.md), [screenshot](screenshots/dark-console.png) | Not yet checked against a real tailnet: the build machine has no Tailscale daemon. |

## Language and personal touches

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Language modes | finished | finished | n/a | `src/renderer/core/i18n.js`, [article](features/language/language-modes.md), [screenshot](screenshots/dark-settings-language.png) |  |
| Funny levels and dialog emojis | finished | finished | n/a | `src/renderer/core/i18n.js`, `src/renderer/ui/overlay.js`, [article](features/language/funny-levels.md), [screenshot](screenshots/dark-settings-language.png) |  |
| Personal vocabulary | finished | finished | n/a | `src/renderer/core/i18n.js`, `src/renderer/ui/celebrate.js`, `src/renderer/pages/settings.js`, [article](features/language/personal-vocabulary.md) | Dropping the file on the window is an app feature; the website loads it from Settings. |
| School mode | finished | finished | n/a | `src/main/main.js`, `src/renderer/pages/settings.js`, [article](features/language/school-mode.md), [screenshot](screenshots/dark-settings-school.png) |  |
| Narrator and voices | finished | finished | n/a | `src/renderer/core/feedback.js`, [article](features/language/narrator.md) |  |
| Action sounds | finished | finished | n/a | `src/renderer/core/feedback.js`, [article](features/language/action-sounds.md) |  |
| Scheduled settings | finished | finished | n/a | `src/renderer/core/schedules.js`, [article](features/language/scheduled-settings.md), [screenshot](screenshots/dark-settings-schedules.png) | On the website a schedule runs while the page is open. |
| Your name for the app | finished | n/a | n/a | `src/renderer/ui/shell.js`, [article](features/language/display-name.md) |  |
| ADHD modes | finished | finished | n/a | `src/renderer/app.js`, `src/shared/momentum.js`, [article](features/language/adhd-modes.md) | Momentum suggestions follow commands, so they are in the app only. |
| Dim sum surprise | finished | finished | n/a | `src/renderer/ui/dimsum.js`, [article](features/language/dim-sum-surprise.md) |  |
| Resume wording in job workflows | n/a | n/a | n/a | — | This app has no job-related workflows. |

## Look and feel

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Material 3 design | finished | finished | n/a | `src/renderer/styles/app.css`, `src/renderer/styles/mesh2.css`, [article](features/appearance/material-design.md), [screenshot](screenshots/dark-settings-appearance.png) |  |
| Motion with a reduced path | finished | finished | n/a | `src/renderer/styles/app.css`, [article](features/appearance/motion.md) |  |
| Live charts | finished | n/a | n/a | `src/renderer/ui/livechart.js`, [article](features/appearance/live-charts.md), [screenshot](screenshots/dark-home.png) | The website has no live data to chart. |
| Per-element appearance editor | finished | finished | n/a | `src/renderer/ui/appearance.js`, [article](features/appearance/appearance-editor.md) |  |
| Colour picker and translator | finished | finished | n/a | `src/renderer/ui/colorpicker.js`, [article](features/appearance/color-picker.md) |  |
| Logo presets and upload | finished | partly built | n/a | `src/renderer/ui/logo.js`, [article](features/appearance/logo.md), [screenshot](screenshots/dark-settings-appearance.png) | The website shows the app logo; choosing a logo is in the app. |
| Overlays and resizable panels | finished | finished | n/a | `src/renderer/ui/overlay.js`, [article](features/navigation/context-menus.md) |  |
| Collapsible filters and statistics | finished | finished | n/a | `src/renderer/ui/overlay.js`, [screenshot](screenshots/dark-peers.png) |  |
| Accessibility tools | finished | finished | n/a | `src/renderer/app.js`, `site/site.js`, [article](features/appearance/accessibility.md) |  |
| Truthful empty states | finished | finished | n/a | [screenshot](screenshots/dark-home.png) |  |
| Browser-style tabs | finished | n/a | n/a | `src/renderer/ui/shell.js`, [article](features/appearance/window-and-navigation.md) | The website uses pages and links instead of tabs. |
| Windows title bar with Snap layouts | built, proof pending | n/a | n/a | `src/main/main.js`, `src/renderer/ui/shell.js`, [article](features/appearance/window-and-navigation.md) | Photographed on a Windows runner for each release; not yet seen on a real Windows desktop. |

## Finding and doing things

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Command palette | finished | finished | n/a | `src/renderer/ui/palette.js`, [article](features/navigation/command-palette.md), [screenshot](screenshots/light-palette.png) |  |
| Context menus everywhere | finished | finished | n/a | `src/renderer/app.js`, `src/renderer/ui/overlay.js`, [article](features/navigation/context-menus.md) |  |
| Rich controls and info buttons | finished | finished | n/a | `src/renderer/ui/controls.js`, `src/renderer/ui/command-form.js`, [article](features/navigation/rich-controls.md), [screenshot](screenshots/dark-cli-set.png) |  |
| Guide me | finished | n/a | n/a | `src/renderer/ui/command-form.js`, [article](features/tailscale/cli-commands.md) | The website documents it; using it needs the app. |
| Settings that explain themselves | finished | finished | n/a | `src/renderer/pages/settings.js`, `src/renderer/pages/settings-index.js`, [article](features/navigation/settings-explanations.md), [screenshot](screenshots/dark-settings.png) |  |
| Regex builder beside every search | partly built | partly built | n/a | `src/renderer/ui/regex.js`, `src/shared/regex-flavors.js`, `src/renderer/ui/regex-debugger.js`, [article](features/navigation/regex-builder.md), [screenshot](screenshots/dark-regex.png) | Other engines in the benchmark and source-code editor integration are not built; the article lists each one. |
| Search inside files | finished | n/a | n/a | `src/renderer/ui/regex.js`, `src/main/tools.js`, [article](features/navigation/regex-builder.md) | The website cannot read your folders. |
| First-run setup | finished | n/a | n/a | `src/renderer/ui/onboarding.js`, [article](features/navigation/onboarding.md) | The website has nothing to set up. |
| Progress and recovery where work happens | finished | partly built | n/a | `src/renderer/ui/jobs.js`, `src/renderer/ui/command-form.js`, [article](features/tools/minecraft.md) | The website runs only Base64 jobs, which show progress; it has no failures to hand on. |
| This features page | finished | finished | n/a | `src/renderer/pages/features.js`, `src/shared/feature-inventory.mjs`, [article](features/records/features-page.md), [screenshot](screenshots/dark-features.png) |  |
| Presets for blank editors | finished | finished | n/a | `src/renderer/ui/logo.js`, `src/renderer/ui/appearance.js` |  |

## Safety and locks

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Two-key super confirmation | finished | finished | n/a | `src/renderer/ui/safety.js`, [article](features/safety/super-confirmation.md) |  |
| Toy locks, ladder and Support Tickets | finished | finished | n/a | `src/renderer/ui/locks.js`, [article](features/safety/element-locks.md) |  |
| Authenticator and QR pairing | finished | finished | n/a | `src/renderer/pages/tools.js`, `src/shared/totp.js`, [article](features/safety/authenticator.md), [screenshot](screenshots/dark-authenticator.png) |  |
| Free, with no nagging | finished | finished | n/a | `LICENSE` |  |

## Records and messages

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Local version history | finished | finished | n/a | `src/main/history.js`, [article](features/records/local-history.md), [screenshot](screenshots/dark-history.png) | On the website the history lives in this browser. |
| Exports and editor hand-off | finished | finished | n/a | `src/renderer/ui/exporter.js`, [article](features/records/exports.md) | The website downloads exports instead of opening an editor. |
| Bulk actions | finished | finished | n/a | `src/renderer/pages/tailscale.js`, `src/renderer/pages/admin.js`, [article](features/records/bulk-actions.md), [screenshot](screenshots/dark-peers.png) |  |
| Changelog | finished | finished | n/a | `src/renderer/pages/meta.js`, [article](features/records/changelog.md), [screenshot](screenshots/dark-changelog.png) |  |
| Offline documentation | finished | finished | n/a | `src/renderer/pages/meta.js`, `scripts/build-renderer.mjs`, [article](features/records/offline-docs.md), [screenshot](screenshots/dark-docs.png) |  |
| Rendered provider text | finished | finished | n/a | `src/renderer/ui/markdown.js`, [article](features/records/offline-docs.md) |  |
| Notices and their centre | finished | finished | n/a | `src/renderer/ui/overlay.js`, [article](features/records/notifications.md), [screenshot](screenshots/dark-notifications.png) |  |

## Built-in tools

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Regex debugger | finished | finished | n/a | `src/shared/regex-debug.js`, `src/renderer/ui/regex-debugger.js`, `src/renderer/pages/regex-debug.js`, `test/regex-debug.test.mjs`, [article](features/tools/regex-debugger.md), [screenshot](screenshots/dark-regex-debug.png) | Lookbehind and Unicode property escapes are refused with a reason instead of stepped through. |
| Base64 toolkit | finished | finished | n/a | `src/shared/base64.js`, `src/main/base64-files.js`, `src/renderer/pages/base64.js`, [article](features/tools/base64.md), [screenshot](screenshots/dark-base64-overlayb64-demo.png) | The website downloads results under the same names instead of writing beside the file. |
| File converter | partly built | partly built | n/a | `src/renderer/pages/tools.js`, [article](features/tools/file-converter.md), [screenshot](screenshots/dark-converter.png) | Not every format family in the shared list has an adapter yet; the article lists what is there. |
| Drawing and annotation | finished | finished | n/a | `src/renderer/pages/tools.js`, [article](features/tools/drawing.md), [screenshot](screenshots/dark-draw.png) |  |
| Ollama suite | built, proof pending | n/a | n/a | `src/main/ollama.js`, `src/main/ollama-harness.js`, `src/shared/ollama-catalog.js`, `src/shared/ollama-fit.js`, `src/renderer/pages/ollama/index.js`, `test/ollama.test.mjs`, [article](features/tools/ollama.md), [screenshot](screenshots/dark-ollama-store.png) | Built and checked by its tests and by reading the real ollama.com catalogue. Pulling, chatting and launching against a running Ollama were not tried here: the build machine has no Ollama. |
| Minecraft server manager | built, proof pending | n/a | n/a | `src/renderer/pages/minecraft.js`, `src/main/minecraft.js`, [article](features/tools/minecraft.md), [screenshot](screenshots/dark-minecraft.png) | Catalogues and downloads are checked live for all seven flavours; running a server has not been checked on the build machine. |
| Minecraft world generator | built, proof pending | n/a | n/a | `src/renderer/pages/minecraft.js`, [article](features/tools/minecraft.md) | Not yet run on the build machine. |
| Extensions | finished | n/a | n/a | `src/main/extensions.js`, `src/renderer/pages/extensions.js`, [article](features/extensions/extensions.md), [screenshot](screenshots/dark-extensions.png) | Extensions are programs on your computer; the website carries their articles. |
| Virtual disk manager | partly built | n/a | n/a | `src/main/vdisk.js`, `src/main/vdisk/vdisk.ps1`, `src/renderer/pages/vdisks.js`, `scripts/vdisk-proof.ps1`, `test/vdisk.test.mjs`, [article](features/tools/virtual-disks.md), [screenshot](screenshots/dark-vdisks.png) | Every operation runs on a clean Windows runner in each release, which adds the results to the release notes. Not built: creating VHD Sets and their checkpoints, custom metadata, mirroring, change tracking and identity reset, which only the VirtDisk API offers on Windows Home. |

## Design and evidence

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Design reference and parity | finished | finished | n/a | `scripts/design-boards.mjs`, `scripts/design-parity.mjs`, [article](features/appearance/design-reference.md) |  |
| Real screenshots and a recording | finished | finished | n/a | `src/main/main.js`, `scripts/record.mjs` |  |
| Every-surface sweep | finished | finished | n/a | `scripts/sweep.mjs`, `src/main/sweep.js`, [article](features/appearance/every-surface-sweep.md) |  |
| Clipping matrix | finished | n/a | n/a | `scripts/clip-matrix.mjs` |  |
| Version on the front screen | finished | finished | n/a | `src/renderer/ui/shell.js`, `site/site.js` |  |
| A picture for shared links | n/a | finished | n/a | `social-preview.png` |  |

## Build, install and release

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| Installer and automatic updates | finished | n/a | n/a | `scripts/package-win.mjs`, `src/main/main.js`, [article](features/release/updates.md) |  |
| A release on every push | n/a | n/a | finished | `.github/workflows/release.yml`, [article](features/release/release-pipeline.md) |  |
| One-click build | n/a | n/a | finished | `build.bat`, `build-installer.bat`, `download-dependencies.bat`, [article](features/release/build-from-source.md) |  |
| Build companion app | n/a | n/a | built, proof pending | `companions/build/main.js`, `companions/build/ui.js`, `scripts/build-companions.mjs`, [article](features/release/companions.md) | Built into one unsigned .exe by every release; its window was photographed from the same files. Running a build through it needs Windows. |
| Website as a portable app | n/a | n/a | built, proof pending | `companions/site/main.js`, `scripts/build-companions.mjs`, [article](features/release/companions.md) | Built into one unsigned .exe by every release; its pages were photographed from the same files. Opening the .exe itself needs Windows. |
| The website | n/a | finished | finished | `site/site.js`, `scripts/build-site.mjs`, `.github/workflows/pages.yml` |  |

## Project records

| Feature | App | Website | Repository | Evidence | Note |
| --- | --- | --- | --- | --- | --- |
| README | n/a | n/a | finished | `README.md` |  |
| Roadmap checklist | n/a | n/a | finished | `ROADMAP.md` |  |
| Handoff notes | n/a | n/a | finished | `HANDOFF.md`, `CLOSEOUT_PROMPT.md` |  |
| One article per feature | n/a | n/a | finished | `docs/README.md` |  |
| Postman collections | n/a | n/a | finished | `scripts/gen-postman.mjs` |  |
| Wiki kept current | n/a | n/a | finished | `scripts/sync-wiki.mjs` |  |
| Contributor guide | n/a | n/a | finished | `AGENTS.md`, `scripts/check-instructions-lock.mjs` |  |
| Wording lock | n/a | n/a | finished | `scripts/check-vocabulary.mjs`, `.githooks/pre-push`, `build.bat`, `test/vocabulary-lock.test.mjs`, [article](features/records/wording-lock.md) |  |
| Status hub registration | not started | n/a | not started | — | Not started: the hub is reachable only from the maintainer's own network. |

Unfinished items are also unchecked items in `ROADMAP.md`.
