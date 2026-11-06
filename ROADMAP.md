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
- [ ] Full RegexBuddy-parity ledger (flavour conversion, debugger trace, benchmarking per engine)
- [ ] Momentum mode next-step suggestions beyond the setting itself

## Phase 3: Safety and records
- [x] Two-key super confirmation on every destructive action
- [x] Element locks with six credential mixes, vault-stored credentials, back-off, unlock ladder, Support Tickets
- [x] Built-in authenticator (RFC 6238, SHA-1/256/512, 6 to 8 digits, QR from image, clipboard and camera)
- [x] Local Git history with append-only restore
- [x] Exports in JSON, YAML, CSV, Markdown, HTML and text; VS Code and editor hand-off
- [x] Notification centre with bulk delete; changelog viewer; offline docs
- [ ] Unlock ladder grading in the main process with single-use nonces (currently graded in the interface)

## Phase 4: Tools
- [x] Base64 toolkit with verified round trip
- [x] File converter for data, images and encodings; other categories listed with the missing tool
- [x] Drawing board with seven pens, eraser, SVG and PNG export, screenshot annotation
- [x] Ollama model list and pull
- [x] Minecraft Java version discovery
- [ ] Bundled converters for documents, audio, video and archives
- [ ] One-click managed Ollama installer
- [ ] Minecraft server creator, plugin installer and world generator

## Phase 5: Release and website
- [x] Squirrel.Windows packaging, unsigned verification, update banner
- [x] Release on every push with version tag, dim sum code name, line counts and measured timing
- [x] screenshot capture mode in the built app and in the release workflow
- [x] Website that reuses the app's modules: landing, features, docs, download, changelog, status, tools, settings
- [x] Social preview from a real capture, Open Graph tags
- [ ] Screen recording of an end-to-end path committed to the repository
- [ ] Clipping matrix at 125/150/200% scale and every language mode
