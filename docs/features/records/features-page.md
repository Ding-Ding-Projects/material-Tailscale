# Features page

## Behaviour

Features, in the app (from the palette or the Docs area) and on the website, lists every feature
in the shared feature list and every Tailscale feature: what it does for you, how to reach it, and
its state on the app, the website and the repository. Each card folds away how to reach the
feature, a note on anything unfinished, the files that build it, a button that opens its article,
and on the website a screenshot from the built app.

The states are honest. **Finished** means built and checked. **Built, proof pending** means
built, but the check it needs cannot run on the build machine (a real tailnet, a real Windows
desktop, a running game server); the note says which. **Partly built** and **Not started** say
what is left. **Not applicable** says why. Nothing unfinished is shown as finished.

Search matches titles, descriptions, how-to lines, notes and file names. The regex button beside
it switches to a regular expression, and the tools button opens the full regex builder. Filters
choose which surface's state to show and filter by state and category; they fold away, show how
many are active, and are remembered on this device.

## Configuration

None. The rows come from `src/shared/feature-inventory.js`, and `docs/completeness.md` is
generated from the same file (`npm run gen:completeness`).

## Failure modes

- No feature matches: the page says so and offers to show every feature.
- An invalid regular expression matches nothing and shows the engine's message under the field.

## Security

The page reads only the bundled inventory. Filters are stored locally with the other settings.

## Verification

`test/completeness.test.mjs` fails when a feature in its hand-written required list is missing
from the inventory, when a row points at a file, article or screenshot that does not exist, when
an unfinished or unproven row has no note, or when `docs/completeness.md` is stale; it also proves
it catches each of those by breaking a copy of the inventory. Try it: open Features, type
"base64", switch the surface to Website, and choose Not started.
