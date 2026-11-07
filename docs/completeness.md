# Completeness inventory

Per-surface inventory of the shared product feature list. App = desktop app, Site = website. Evidence lists the implementation file, article and capture.

| Feature | App | Site | Implementation | Article | Capture |
| --- | --- | --- | --- | --- | --- |
| Language modes | yes | yes | src/renderer/core/i18n.js | features/language/language-modes.md | dark-settings-language.png |
| Funny levels and dialog emojis | yes | yes | core/i18n.js, ui/overlay.js | features/language/funny-levels.md | dark-settings-language.png |
| Personal vocabulary upload and drop | yes | yes | core/i18n.js, pages/settings.js, app.js | features/language/personal-vocabulary.md | — |
| School mode (shared record) | yes | yes (per browser) | main.js shared record, pages/settings.js | features/language/school-mode.md | dark-settings-school.png |
| Narrator and voice pickers | yes | yes (same settings and voice pickers; speaks the site's own notices) | core/feedback.js | features/language/narrator.md | — |
| Action sounds | yes | yes | core/feedback.js | features/language/action-sounds.md | — |
| Scheduled settings | yes | yes (runs while the page is open) | core/schedules.js | features/language/scheduled-settings.md | dark-settings-schedules.png |
| Display name | yes | n/a | ui/shell.js | features/language/display-name.md | — |
| ADHD modes, Momentum suggestions | yes | yes (Momentum: app only, it follows commands) | app.js, ui/command-form.js, shared/momentum.js | features/language/adhd-modes.md | — |
| Dim sum surprise (cannot be turned off) | yes | yes | ui/dimsum.js | features/language/dim-sum-surprise.md | — |
| Material 3 design, frameless window | yes | yes | styles/app.css, ui/shell.js | features/appearance/material-design.md | all |
| Motion with reduced path | yes | yes | styles/app.css | features/appearance/motion.md | — |
| Live charts | yes | n/a | ui/livechart.js | features/appearance/live-charts.md | dark-home.png |
| Appearance editor | yes | yes | ui/appearance.js | features/appearance/appearance-editor.md | — |
| Colour picker and translator | yes | yes | ui/colorpicker.js | features/appearance/color-picker.md | — |
| Logo presets and upload | yes | uses app logo | ui/logo.js, pages/settings.js | features/appearance/logo.md | dark-settings-appearance.png |
| Overlays, resizable panels | yes | yes | ui/overlay.js | features/navigation/context-menus.md | — |
| Collapsible filters | yes | yes | ui/overlay.js collapsible | — | dark-peers.png |
| Accessibility tools | yes | yes | app.js, site.js | features/appearance/accessibility.md | — |
| Truthful empty states | yes | yes | all pages | — | dark-home.png |
| Onboarding wizard | yes | n/a | ui/onboarding.js | features/navigation/onboarding.md | — |
| Tabs | yes | n/a (site uses pages) | ui/shell.js | features/appearance/window-and-navigation.md | all |
| Regex builder, flavour conversion, trace, benchmark | yes | yes | ui/regex.js, shared/regex-flavors.js | features/navigation/regex-builder.md | dark-regex.png |
| Folder search (GREP) | yes | n/a (needs local files) | ui/regex.js, main/tools.js | features/navigation/regex-builder.md | — |
| Guide me on command forms | yes | n/a | ui/command-form.js | features/tailscale/cli-commands.md | — |
| Help request on failures | yes | n/a | ui/jobs.js, ui/command-form.js | features/tools/minecraft.md | — |
| Command palette | yes | yes | ui/palette.js, site.js | features/navigation/command-palette.md | light-palette.png |
| Context menus with shortcuts | yes | yes | app.js, ui/overlay.js | features/navigation/context-menus.md | — |
| Rich controls and info buttons | yes | yes | ui/controls.js, ui/command-form.js | features/navigation/rich-controls.md | dark-cli-set.png |
| Settings explanations and provenance | yes | yes | pages/settings.js, settings-index.js | features/navigation/settings-explanations.md | dark-settings.png |
| Super confirmation | yes | yes | ui/safety.js | features/safety/super-confirmation.md | — |
| Element locks, ladder, Support Tickets | yes | yes | ui/locks.js | features/safety/element-locks.md | — |
| Authenticator and QR pairing | yes | yes | pages/tools.js, ui/locks.js | features/safety/authenticator.md | dark-authenticator.png |
| Local history | yes | yes (browser store) | main/history.js | features/records/local-history.md | dark-history.png |
| Exports and editor hand-off | yes | downloads | ui/exporter.js | features/records/exports.md | — |
| Bulk actions | yes | yes | pages/tailscale.js, admin.js, overlay.js | features/records/bulk-actions.md | dark-peers.png |
| Changelog viewer | yes | yes | pages/meta.js | features/records/changelog.md | dark-changelog.png |
| Offline docs | yes | yes | pages/meta.js, build-renderer.mjs | features/records/offline-docs.md | dark-docs.png |
| Rendered provider text | yes | yes | ui/markdown.js | features/records/offline-docs.md | — |
| Notifications and centre | yes | yes | ui/overlay.js | features/records/notifications.md | dark-notifications.png |
| File converter | partial | partial | pages/tools.js | features/tools/file-converter.md | dark-converter.png |
| Base64 toolkit | yes | yes | pages/tools.js | features/tools/base64.md | dark-base64.png |
| Minecraft server manager | built; catalogues and download resolution verified live for all seven flavours; running a server and the generator unverified here | n/a | pages/minecraft.js, main/minecraft.js | features/tools/minecraft.md | dark-minecraft.png |
| Ollama suite | partial (list, pull) | n/a | pages/tools.js | features/tools/ollama.md | dark-ollama.png |
| Drawing and annotation | yes | yes | pages/tools.js | features/tools/drawing.md | dark-draw.png |
| Front-screen version and time | yes | yes | ui/shell.js, site.js | — | title bar in every capture |
| Real screenshots | yes | yes | main.js capture mode | — | docs/screenshots |
| Squirrel installer, auto updates | yes | n/a | scripts/package-win.mjs, main.js | features/release/updates.md | — |
| Release on every push | yes | n/a | .github/workflows/release.yml | features/release/release-pipeline.md | — |
| Build entrypoints | yes | n/a | build.bat, build-installer.bat, download-dependencies.* | features/release/build-from-source.md | — |
| Website with every feature | n/a | yes | site/ | — | — |
| Social preview | yes | yes | social-preview.png | — | — |

| End-to-end recording | yes | n/a | scripts/record.mjs | README.md | docs/recording/end-to-end.gif |
| Clipping matrix | yes | n/a | scripts/clip-matrix.mjs | README.md | out/clipping (not committed) |
| Postman collection | n/a | n/a | scripts/gen-postman.mjs | docs/api/ | — |
| Extensions: manager, permission review, built-in extensions, any-language protocol | yes | n/a (runs programs; the articles are on the site) | main/extensions.js, ui/extensions-client.js, pages/extensions.js, extensions/ | features/extensions/extensions.md, features/extensions/writing-extensions.md | dark-extensions.png, dark-extensions-overlayext-consent.png |
| Every-surface sweep (release check) | yes | yes | scripts/sweep.mjs, main/sweep.js, shared/sweep-probes.js | features/appearance/every-surface-sweep.md | docs/sweep/summary.md |
| Windows title bar with system caption buttons (Snap layouts) | yes (Windows) | n/a | main.js titleBarOverlay, ui/shell.js | features/appearance/window-and-navigation.md | windows-title-bar.png on each release |

Gaps are tracked as unchecked items in ROADMAP.md.
