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
4. **The website hero was boxed.** A generic illustration sat in the hero and a whole-window
   screenshot sat in a framed box below it. The hero now holds the real app, cropped to its upper
   left at a size where its words can be read, running off the band's right and bottom edges; the
   crop ends in the gap after the second column of controls, so no control is cut. The boxed
   screenshot is gone.
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

- The hero crop also cuts the captured window's title bar at the right edge, including its search
  button. It is the window's own chrome running off the band with the rest of the window; it was
  kept rather than moving the crop into the controls.

## Not checked

- The fresh-eye review was a separate pass by the same author on newly rendered frames, not by an
  independent reviewer.
- The canvas itself was checked in Chromium-based renderers only, and touch input was not tried.
