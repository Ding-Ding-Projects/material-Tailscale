# Design handoff

What is in `design/`, how it is made, and what the next design pass should know.

## Contents

- `canvas/*.dc.html`: sixteen boards (51 views) generated from the app's own stylesheets, plus
  `Sweep.dc.html`, a report board with the every-surface sweep's before and after score.
- `canvas/canvas.json`: where each board sits on the design canvas.
- `canvas/assets/` and `canvas/assets.json`: the files uploaded to the canvas (the three
  stylesheets and the website hero's dark and light captures) and the address each one has there.
- `frames/`: contact sheets of the final board frames, four views to a sheet, from the design
  parity run (dark theme, 1440 by 960, scale 1).
- `REHEARSAL.md`: how the latest pass was reviewed, what it found and what changed.

The per-screen comparison with the real app (raw captures, side-by-side images and diff records)
lives in `docs/design-parity/`, listed by the hand-written `docs/design-parity/inventory.json`.

## Making a change

1. Change the app or website first; the boards follow the product, not the other way round.
2. If `tokens.css`, `app.css` or `mesh2.css` changed, copy them into `canvas/assets/`, upload the
   changed files to the canvas, and put each new address in `canvas/assets.json`. Do the same for
   the hero captures after new screenshots (`shot-dark.webp` and `shot-light.webp` are made from
   `docs/screenshots/{dark,light}-cli-set.png`).
3. Edit the view specs in `scripts/design-boards.mjs` and run `npm run design:boards`.
4. Render every frame with the viewer
   (`npx electron tools/design-reference --all <folder> --width 1440 --height 960 --scale 1 --themes dark,light`)
   and read them. The viewer prints any board whose wrapping choices or overflowing tabs differ
   from the app's layout.
5. Run `npm run design:parity` against a clean build and record any reviewed deviation in the
   inventory; `npm test` fails when a board changed after its evidence.
6. Publish the boards to the canvas.

## Open items

- The website hero's crop cuts the captured window's title bar at the right edge (see
  `REHEARSAL.md`, Unresolved).
- Screens that need a running Tailscale daemon are compared against the app's setup state; the
  inventory records each such difference.
