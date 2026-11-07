# Agent guide

## Agent conversation vocabulary

Agents working in this repository use the shared private conversation vocabulary defined in
the maintainer's canonical agent instructions for every reply, including chat prose, visible
reasoning, status lines, and task or session titles. Read those instructions and apply them
in full. They are deliberately not restated here, because this file is part of this
repository's public record.

That vocabulary never appears in anything published. Keep it out of commit messages, branch
names, code, code comments, test names, documentation, this file, issues, pull requests,
discussions, release notes, published sites, logs, and every other file in this repository.
Published writing uses ordinary professional English, and exact technical identifiers always
keep their literal spelling. The single documented public-safe exception is named in those
canonical instructions; do not infer any other.

Scan any text bound for a public surface against that vocabulary before publishing it. A
reviewer cannot tell a correct release note from a leaking one by reading it, so the scan is
a step, not a habit.

## Working here

- `npm ci`, then `npm start` to build and run; `npm test` for the checks.
- New CLI flags go in `src/shared/cli-catalog.js` with a type, description and default; the form, palette and docs pick them up.
- Refresh the admin API catalogue with `npm run gen:api -- --fetch`.
- Every user-facing change updates the matching article in `docs/features/`, `ROADMAP.md` and `HANDOFF.md` in the same commit.
- Capture real screenshots with `npm run screenshots` (`MT_CAPTURE_DIR` required) after interface changes.
- Before a release, run the every-surface sweep (`npm run build && node scripts/build-site.mjs`, then `node scripts/sweep.mjs`, under `xvfb-run` on Linux); it must report zero findings. `--resume` continues an interrupted run against the same build. Record the result with `node scripts/sweep-history.mjs`.
- Extensions: the host is `src/main/extensions.js` (with `src/shared/extension-api.js` for the protocol), the built-ins are in `extensions/builtin`, samples in `extensions/samples`, and `test/extensions.test.mjs` runs real extension processes. A protocol change bumps `API_VERSION` and updates `docs/features/extensions/writing-extensions.md`.
- Base64 toolkit: the core is `src/shared/base64.js`, conversions beside the source file are `src/main/base64-files.js`, and the page is `src/renderer/pages/base64.js` with `src/renderer/ui/base64-*.js`; `test/base64.test.mjs` runs real conversions on disk.
- Never add code signing. Never force-push.

## Shared instructions (sanitised mirror)

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
