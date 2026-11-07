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
- Design parity evidence for all 49 design views, checked by the tests.
- Screenshots are captured at 100% zoom again, with a provenance manifest.
- A release check sweeps every page, dialog, menu and overlay of the app and every page of the website, in both themes, all three language modes and four window sizes, for accessibility rules, console errors, clipped or overlapping text and keyboard focus. The first runs reported 1,791 findings, a few of them from the checker itself; the real problems were fixed where they started, in shared components and tokens rather than screen by screen, and the final run before this release reports none.
- On Windows the title bar keeps Windows' own minimise, maximise and close buttons, so Snap layouts work, and their colours follow the theme.
- Menus and the command palette are proper lists: arrow keys move, Left and Right change a live value, and screen readers hear each value and how to change it. Dialogs, the setup wizard and the palette keep Tab inside until they close.
- The tab bar holds only tabs; Delete closes a utility tab and New tab sits beside the list.
- Every control shows a focus ring from the keyboard, including search boxes, steppers and sliders, and scrolling boxes can be scrolled from the keyboard.
- Narrow and short windows no longer scroll sideways, the Settings list scrolls on short windows, and the title bar shortens its version line and search button instead of hiding them.
- Light-theme success and danger buttons and badges meet the contrast minimum.
- Toasts wait while they have keyboard focus or the pointer, at most three stay on screen (fewer on short windows), and focus goes back where it came from when one leaves. Keyboard focus always brings the focused control into view, including read-only output boxes, and long button labels wrap inside the button instead of running off a phone screen.
- Website routes for desktop-only tools explain that the tool is in the desktop app instead of failing to render.
- Base64 beside your files: drop a file on the toolkit and its Base64 is written next to it as the full name plus `.base64.txt` (`report.pdf` becomes `report.pdf.base64.txt`); drop that text file and the original comes back beside it with its name and extension restored, from the name, then a `data:` type, then the file's signature. Nothing is ever overwritten: a taken name gets `(1)` before the extension. Files of any size stream with progress, pause, resume and cancel, and every result is checked by a SHA-256 round trip before it keeps its name. The toolkit also gains custom line lengths, UTF-16 BE, strict errors that name the exact character and offset, `data:` URL building and reading, sandboxed previews of pictures, sound, video, text and hex, JSON records and ZIP export, and a history with undo and redo that survives a restart. The website downloads results under the same names.
- The regex workbench's generated-code box shows all seven lines instead of scrolling, and scrolling boxes get keyboard access on the next frame rather than a moment later.
- Extensions: small programs in any language add actions to every device's menu and checks to Diagnostics. A manager (Tools > Extensions) lists each one with its state, what it adds, what it may see or do, its recent runs and any manifest problems, and has a switch that stops them all. New and changed extensions stay off until you review exactly what they ask for; they never receive keys, tokens, e-mail addresses or vault contents, start with a clean environment, are stopped after five seconds, and have their answers checked. Four built-in extensions come with the app: SSH command, Device summary, Web page and Tailnet health. The docs include an authoring guide with Python, PowerShell and JavaScript samples.

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
