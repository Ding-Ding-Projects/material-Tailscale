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

- Commit and push coherent work promptly to the authorised branch; read back the remote commit before calling it done.
- Every push to `main` produces one tagged release; notes record which checks actually ran and the measured workflow timing.
- Keep README, ROADMAP, HANDOFF, docs and the website current with behaviour.
- Destructive operations require explicit confirmation; preserve user data and settings; never expose secrets.
