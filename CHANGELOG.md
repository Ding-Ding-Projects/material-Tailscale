# Changelog

Every push to `main` publishes the next release. A section headed "Unreleased" is work on `main` that has no release yet; the release build stamps it with its version, date, code name and commit, so the changelog inside an installed copy names the release it shipped in.

## Unreleased: Midnight Mesh 2

- Every screen redesigned on a design canvas, with the boards generated from the app's own stylesheets.
- Page hero bands with animated illustrations, two-pane Settings, in-page tabs with a sliding indicator, a setup state with steps, live status dots.
- Context menus show live switches, choices, sliders and swatches for values, and keep the menu open while you adjust them.
- The appearance editor gains an Animation and transition tab with presets, timing, easing curves, a keyframe timeline, transitions, a reduced-motion fallback and a preview.
- Home without Tailscale follows its design board: a full-width setup card with steps, a tour shortcut and no empty traffic or peer sections.
- About is rebuilt as a build card and a licences table, with a working update check that explains itself on copies that were not installed by the Windows installer.
- The changelog lists every published release with its code name and commit, and shows unreleased work as unreleased.
- Help requests copied from an error now include the real app version.
- Releases carry one full package, one delta from the previous release and a matching update index, instead of every historic package; Squirrel's GitHub sync had started to collide on the duplicates.
- Design parity evidence for all 48 design views, checked by the tests.
- Screenshots are captured at 100% zoom again, with a provenance manifest.

## v1.0.12 · 2026-11-07 · Crab Roe Siu Mai · 蟹籽燒賣 · cd93523

- Transient release API errors are retried, and packaging errors are reported clearly.
- Clipping fixes and a shared schedules runner.

## v1.0.11 · 2026-11-07 · Classic Siu Mai · 燒賣 · a788bb7

- The Minecraft server manager.
- Regex flavour conversion, attempt trace, benchmark and folder search; Momentum suggestions and guided command forms.
- An end-to-end recording, a clipping matrix, the install-and-update proof job, a Postman collection and the wiki generator.
- Generated API files use documentation address ranges.

## v1.0.7 · 2026-11-07 · Pea Shoot Shrimp Dumpling · 豆苗蝦餃 · ff0bd56

- One-click installers, the full Ollama suite, bundled converters and archive exports.

## v1.0.6 · 2026-11-07 · Spinach Shrimp Dumpling · 菠菜蝦餃 · e25b055

- The unlock ladder is graded in the main process with single-use nonces, and the tools module arrives.

## v1.0.5 · 2026-11-06 · Chive Shrimp Dumpling · 韭菜蝦餃 · 411c8f5

- The not-found card stays inside the peers grid, and the release proof is recorded.

## v1.0.4 · 2026-11-06 · Crab Roe Har Gow · 蟹籽蝦餃 · 227d6aa

- First published release of Material Tailscale.
- Every Tailscale CLI command (73) and flag (197) as rich controls with a live command preview.
- The whole admin API (93 operations) with schema-driven controls, plus bespoke Devices, Policy file, Keys and Settings views.
- Pages for peers, exit nodes, routes, Serve and Funnel, Taildrop, DNS, Tailnet Lock, Taildrive, certificates, accounts and diagnostics.
- English, Cantonese and bilingual modes, funny levels, personal vocabulary, School mode, narrator, schedules, ADHD modes.
- Appearance editor, colour picker, locks, authenticator, local history, exports, command palette, regex workbench.
- Squirrel.Windows installer with automatic updates; website with docs, downloads and tools.
