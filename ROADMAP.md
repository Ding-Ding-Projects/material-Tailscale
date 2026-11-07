# Roadmap

## Phase 1: Tailscale coverage
- [x] Catalogue of all 73 CLI commands and 197 flags from the official references, with validated argument building
- [x] Rich typed control for every flag and argument, live command preview, only-touched flags sent
- [x] Bespoke pages: Home, Peers, Exit nodes, Routes, Serve and Funnel, Taildrop, DNS, Tailnet Lock, Taildrive, Certificates, Accounts, Diagnostics
- [x] Raw console for debug subcommands
- [x] Admin API: 93 operations from the vendored OpenAPI document with schema-driven controls
- [x] Admin bespoke views: Devices (bulk), Policy file editor, Keys, Tailnet settings
- [ ] Live verification against a real tailnet on Windows (not available on the build machine)

## Phase 2: Interface and personalisation
- [x] Material 3 Expressive "Midnight Mesh" design from the design canvas, dark and light, seed colour, density
- [x] Frameless window, rail, browser-style tabs, view transitions, reduced-motion path
- [x] English, Cantonese, bilingual; two funny-level sliders; dialog emoji switch
- [x] Personal vocabulary upload and drop with full validation and celebration
- [x] School mode shared record with rename and shared password
- [x] Narrator with per-language voice pickers, rate and pitch; action sounds; quiet hours
- [x] Scheduled settings with local and HTTPS sources
- [x] ADHD modes (Focus, Low stimulation, Time awareness, One thing at a time, Momentum)
- [x] Per-element appearance editor across states; infinite colour picker and translator; logo presets and upload
- [x] Accessibility tools menu
- [x] Command palette with live controls and teleport; context menus with filter and regex everywhere
- [x] Regex workbench (builder, tester, explainer, replace, code generation, library)
- [x] Regex parity ledger, flavour conversion, attempt trace, benchmark and folder search (see docs/features/navigation/regex-builder.md for what is not built)
- [x] Momentum mode next-step suggestions
- [x] Guide me: one option at a time on every command form
- [x] Copy a help request on failed commands

## Phase 3: Safety and records
- [x] Two-key super confirmation on every destructive action
- [x] Element locks with six credential mixes, vault-stored credentials, back-off, unlock ladder, Support Tickets
- [x] Built-in authenticator (RFC 6238, SHA-1/256/512, 6 to 8 digits, QR from image, clipboard and camera)
- [x] Local Git history with append-only restore
- [x] Exports in JSON, YAML, CSV, Markdown, HTML and text; VS Code and editor hand-off
- [x] Notification centre with bulk delete; changelog viewer; offline docs
- [x] Unlock ladder grading in the main process with single-use nonces

## Phase 4: Tools
- [x] Base64 toolkit with verified round trip
- [x] File converter for data, images and encodings; other categories listed with the missing tool
- [x] Drawing board with seven pens, eraser, SVG and PNG export, screenshot annotation
- [x] Ollama model list and pull
- [x] Minecraft Java version discovery
- [x] Bundled converters for documents, audio, video and archives
- [x] One-click managed Ollama installer
- [x] Minecraft server creator, plugin installer and world generator (generator run against a real server jar not yet verified in this environment)

## Phase 5: Release and website
- [x] Squirrel.Windows packaging, unsigned verification, update banner (first release v1.0.4 published)
- [x] Release on every push with version tag, dim sum code name, line counts and measured timing
- [x] screenshot capture mode in the built app and in the release workflow
- [x] Website that reuses the app's modules: landing, features, docs, download, changelog, status, tools, settings
- [x] Social preview from a real capture, Open Graph tags
- [x] Screen recording of an end-to-end path committed to the repository (`docs/recording/end-to-end.gif`)
- [x] Install and update proof on a clean Windows runner after every release (previous release installed, updated with Update.exe, uninstalled)
- [x] Postman collection of every admin API operation
- [x] Wiki generator from docs (publishing blocked from the build machine, see HANDOFF)
- [ ] Clipping matrix at 125/150/200% scale and every language mode

## Midnight Mesh 2

- [x] Design canvas boards for every screen family, overlay and the website (15 boards, 49 views)
- [x] Page hero bands with animated illustrations, two-pane Settings, in-page tabs, setup state with steps
- [x] Context menus carry live controls (switch, choice, slider, swatch) with keyboard support
- [x] Animation and transition tab in the per-element appearance editor
- [x] Design-reference viewer, hand-written parity inventory, side-by-side and diff evidence, negative regression
- [x] Final polish: Home and Minecraft first-run states follow their boards; About rebuilt (build table, licences, working update check); Status shows dot markers, folded search paths, This device and Health; changelog lists every published release and marks unreleased work
- [x] Fixed: About printed a stray "null"; help requests said "App version: unknown"; the changelog read "Unreleased: Midnight Mesh 2" as version 2
- [x] Release packaging ships one full package and one delta per release instead of every historic package (Squirrel's GitHub sync collided on the duplicates and failed releases 13 and 14)
- [ ] Every-surface sweep reports zero findings in a full run (4 window sizes, 2 themes, 3 language modes; every app surface and every website page), bound to the release commit
- [x] Sweep tooling: axe-core WCAG 2.2 AA and best practices, console and blocked content, clipped, off-screen and overlapping text, and a keyboard walk, with a throwaway profile and a before and after board on the design canvas
- [x] Fixed at the source: icon names read aloud, nested controls in menus and the palette, tab list holding buttons, unnamed popovers, dialogs that let Tab leave, missing focus rings, skipped heading levels, sideways scrolling on narrow windows, an unreachable Settings list on short windows, light-theme contrast, desktop-only website routes
- [x] Windows title bar keeps the system caption buttons through the title-bar overlay (Snap layouts), with overlay colours that follow the theme through validated IPC
- [ ] Title-bar overlay and Snap layouts seen on a real Windows desktop (the build workspace is Linux, where the app draws its own buttons)
- [x] Extensions: manifest version 1, any-language JSON protocol over standard input and output, permissions with a review before first run and after every change, an allow-list of what reaches an extension, a clean environment, a five-second limit and a 64 KiB answer limit, checked answers, a manager with search and a master switch, device-menu actions and Diagnostics checks, four built-in extensions, an authoring guide with samples, and tests that run real extension processes
- [ ] Extension actions seen in a populated device menu (needs a Tailscale daemon with peers on the capture machine)
- [ ] Populated tailnet states in parity captures (needs a Tailscale daemon on the capture machine)
- [ ] Dedicated build GUI companion (portable executable that drives build.bat and build-installer.bat)

