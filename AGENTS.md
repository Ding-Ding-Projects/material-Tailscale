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
- Never add code signing. Never force-push.

## Shared instructions (sanitised mirror)

This is a sanitised mirror of the maintainer's shared agent instructions. It was refreshed on 2026-11-07, and its source hash is checked by `npm run check:instructions`. Machine names, paths, hosts, addresses and credentials are removed, and rules that needed them are stated in general terms. Do not edit it here expecting the change to spread: change the canonical instructions first, then refresh this copy.

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
- The README, the per-feature docs, the roadmap, the handoff notes, the wiki and the website stay current with behaviour in the same change.

**Every user-facing surface (app and website)**
- English, playful Hong Kong Cantonese and a compact bilingual mode. Two independent funny-level sliders, from 1 to 5, default to 5; facts never change with them.
- The version and its build-provenance time show on the front screen.
- A command palette on `Ctrl+Shift+F` reaches every page, setting and command. Its results carry live controls and teleport to the exact element.
- Every search, dropdown and context menu has its own filter and an anchored regex builder. Plain text is the default.
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
- A local Ollama manager and a Minecraft server manager.
- A dim sum surprise and app-logo presets.
- A personal-vocabulary JSON can be dropped on the window. It stays on the device.
- Destructive actions need a super confirmation. Notices never block work, and a failed operation offers a copyable help request.

**Design and evidence**
- A checked-in design reference has a plain viewer, a hand-written per-screen parity inventory, side-by-side and diff evidence, and a negative test.
- Screenshots and recordings come from the real built app. They are inspected, carry provenance, and contain no private data.

**Safety and privacy**
- Never expose secrets or personal data in source, logs, exports, captures or public records.
- Preserve user data, settings and existing installations. Destructive operations require explicit confirmation.
- The maintainer's private conversation vocabulary never appears in anything published. Scan public text before publishing it.
