# Contributing

1. `npm ci`, then `npm start`.
2. Keep each change focused. Update the matching article in `docs/features/`, plus `ROADMAP.md` and `HANDOFF.md`.
3. Run `npm test`. For interface changes, run `MT_CAPTURE_DIR=out/shots npm run screenshots` and look at the results.
4. Open a pull request describing what changed and how you checked it.

New Tailscale flags belong in `src/shared/cli-catalog.js`; the interface, palette and validation pick them up automatically.
