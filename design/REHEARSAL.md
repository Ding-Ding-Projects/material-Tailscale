# Rehearsal: Midnight Mesh 2, final polish pass (2026-11-07)

How this pass was checked, what the review found, what changed and what was not checked. The
checklist is Stageshow 1.1.1 (`benjitaylor/skills`, commit `299140f`), installed fresh for this
pass; the installed copy matched the copy kept for reference apart from line endings.

## What was rehearsed

- **Medium.** Stills: the design boards in `design/canvas/` and the website's home hero. Nothing
  in this pass is an authored animation, so Stageshow's motion rules (beats, loops, the cursor,
  `film.mjs --gate`) had nothing to judge. Its framing, restraint and craft rules did.
- **Gold.** `hero-demo` and `opposite-corners`, filmed as stills beside the website hero. Kept from
  them: a product window that runs off the band's edges instead of floating whole, one place for
  the eye to land, no dead corners. Changed: the hero shows a real capture of the app, so it has
  real words everywhere instead of placeholder bars; that is deliberate, because the site shows
  the actual product.
- **Captured.** All 104 board frames (51 views in dark and light) at 1440 by 960, scale 1, twice:
  before the fixes and after them. The website hero at 1440, 820 and 390 pixels wide in both
  themes. App captures of every screen whose code changed, and the full screenshot set from the
  clean build of the final code.
- **Layout check.** Stageshow's `layout.mjs` on the website hero at 1440, 820 and 390 wide:
  no issues detected (three controls and three or four padded containers each). That check
  measures boxes; it is not visual approval, which came from reading the frames.
- **Drift check.** The design viewer now reports any board that draws a wrapping choice or
  overflowing tabs differently from the app. The final render reports none.

## Review: findings, ranked, and what changed

Framing first, then hierarchy and density, then polish. Each finding was read off a frame.

1. **Overlays floated alone on an empty board.** The palette, welcome wizard, context menu,
   appearance editor, super confirmation, unlock ladder and notices each sat in the middle of an
   empty canvas, with air on all four sides. Now each sits over the page it opens on, one window
   tall, dimmed exactly when the app dims (dialogs, the wizard and the palette over a scrim;
   menus, the editor and notices over the page as it is).
2. **The Taildrop board painted the whole page.** Its drop target borrowed the class of the app's
   window-wide drop layer, which covered every view on that board. It is now an in-card target
   like the app's, with its own class.
3. **Dead corners.** Home's peer row used three of four columns, the Peers grid six of eight,
   the Mullvad list stopped short of its neighbour, each Settings section ended on a row with one
   card, and the Taildrop inbox stopped short of Send to. Each now fills its rows with real
   content: two more sample devices, two more locations and files, and the real settings of each
   section (six each) instead of a partial list.
4. **The website hero was boxed, then cropped.** A generic illustration sat in the hero and a
   whole-window screenshot sat in a framed box below it. The first fix cropped the real app to its
   upper left, which cut the window's title bar and its search button at the right edge. The hero
   now shows the whole command window (a dedicated 1120 by 760 capture), set into the band and
   running off its bottom edge only, so every word in it, title bar included, can be read.
5. **Stock AI icons.** Sparkles marked Automatic (best available) and Suggest the best one. They
   now use an automatic icon and a network-check icon, in the app and on the boards.
6. **Cut controls without a cue.** The game-server tabs ran past their card mid-word with nothing
   to say more were hidden. Tabs that run past an edge now fade there and show an arrow, in the app
   and on the boards.
7. **Uneven choices.** A segmented choice stretched across a card left a blank stripe beside its
   options, and a choice that could not fit one row wrapped unevenly. Options now share the width,
   and a choice that cannot fit becomes a two-column grid.
8. **A thin regex board.** It showed a pattern, chips and a conversion; the app shows a whole
   workbench. The board now shows every part in the app's order.
9. **A bare "-" in Admin.** The tailnet field showed only "-". It is labelled, and says that "-"
   means the tailnet the credential belongs to.
10. **Notices on top of the update banner.** On the board they overlapped, and in narrower windows
    the app could do the same. Notices now stack above the banner whenever it shows.
11. **An empty strip beside docs articles.** Wide windows left a blank column next to the article.
    An "On this page" list of the article's headings now fills it, in the app and on the website.

## Assumptions

- Boards are judged at the parity tuple (1440 by 960, scale 1). The canvas shows them at their own
  preview sizes, and the Overlays board is one window tall to match.

## Unresolved

- None from this pass. The title-bar crop recorded here earlier is fixed (finding 4).

## Not checked

- The fresh-eye review was a separate pass by the same author on newly rendered frames, not by an
  independent reviewer.
- The canvas itself was checked in Chromium-based renderers only, and touch input was not tried.

## Second canvas: Everything added (2026-11-07)

The Features page, the virtual disk manager, the Ollama suite, the regex debugger and the two
portable companions were designed on a second canvas (*Material Tailscale · Everything added*,
`design/additions/`, 6 boards and 14 views) before they were built, then built to match.

- **Captured.** Every additions frame at 1440 by 960 in dark, read before and after the fixes,
  and the built screens from the clean build.
- **Real numbers.** The Features boards count the real inventory; the regex debugger board runs the
  real step engine (136 steps and 30 backtracks for `^(a+)+b` on "aaaac"); the store board's tag
  count was corrected to the real catalogue (7,661 tags on 271 pages).

Findings, ranked, and what changed:

1. **The build companion's buttons turned into circles.** Its window reused the app's `outlet`
   grid, which stretched each child to a third of the window. The window now lays out as a plain
   column, and the three buttons are the pills on the board.
2. **"null" on screen.** The debugger's summary row and the harness preflight printed "null" where
   an optional part was absent. Every new page now appends through a helper that skips empty parts.
3. **Navigation drawn as choices.** The offline guide's article rows carried radio dots. They are
   link rows with a chevron.
4. **A clipped search hint.** "Search conversations" did not fit the conversation list. It reads
   "Search chats".
5. **The step view was too small to follow.** The debugger's pattern and text are larger, with
   labels, and the current token and position stand out.

Not checked: the same author reviewed these frames; the companions were photographed on Linux,
where the build companion's buttons are off.

