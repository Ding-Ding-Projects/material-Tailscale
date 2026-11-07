# Every-surface sweep

## Behaviour

Before a release, an automated sweep opens every surface of the app and of the website and reports what eyes skip:

- **App:** every page, every Settings section, the command palette, the setup wizard, the super confirmation, the unlock ladder, toasts, the dim sum surprise card, the New tab catalogue, a context menu with live values, both tabs of the appearance editor, the Minecraft dialogs, and the extensions manager with its permission review (59 surfaces).
- **Website:** every page, every Settings section the website offers, and every bundled article (84 pages).
- **Each in:** dark and light themes; English, Cantonese and bilingual modes; and four window sizes: desktop (1440 by 940), a 1080p screen at 200 percent (960 by 540), tablet (820 by 1180) and phone (390 by 844).

For each surface and combination it records:

- axe-core WCAG 2.2 A and AA rules plus best practices (violations only);
- console errors, failed loads and blocked content;
- text that is clipped by a box that hides overflow, text pushed outside the window, and text covered by something that is not an open menu, dialog or toast;
- a keyboard walk with Tab that flags focus on a hidden control, a control without a name, an icon name read aloud, focus with no visible change, and focus that leaves an open modal dialog.

Truncation with an ellipsis counts as clipping unless the full text is disclosed (a tooltip or an accessible name). The random dim sum surprise is held back during page checks, because one load in ten would fetch the public catalogue; its card is checked as a surface of its own. Every finding is fixed at its root token or component rather than per screen, and the sweep runs again.

Problem patterns this sweep caught once and now checks everywhere:

- icon glyph names read aloud (every glyph is hidden from assistive technology by the DOM builder);
- a tab list holding close buttons and the New tab button (the list now holds only tabs);
- controls nested inside menu and palette options (live values are drawn inside the option; the filter is a combobox driving a listbox);
- popovers without names, modal dialogs that let Tab leave, and leaving toasts that still took focus;
- focus shown only by a tone change on search boxes, steppers and sliders (each now has a ring);
- headings that skipped a level, a page without a level-one heading, and rendered text marked as duplicate landmarks;
- a grid column that grew to its content and pushed every page sideways on tablet and phone widths;
- a sticky Settings list taller than a short window, whose last sections could not be reached;
- light-theme buttons and badges below the contrast minimum;
- website routes for desktop-only tools that failed to render;
- a timed toast that dismissed itself while it held focus (toasts now wait while focused or hovered and hand focus back when they leave), and a pile of toasts that stacked past the top of a short window (at most three stay, fewer when the window is short);
- a read-only output box that Tab reached without scrolling it into view (keyboard focus now scrolls any control that is out of sight just far enough);
- a box that started scrolling only after a resize or a font load and stayed out of the keyboard order;
- a bilingual button label wider than a phone screen (button labels now wrap inside the button).

## Configuration

```
npm run build && node scripts/build-site.mjs
# where the GitHub API is not reachable from Node, give the website build a saved release
# so the download page is checked with real release assets:
gh api repos/Ding-Ding-Projects/material-Tailscale/releases/latest > release.json
MT_RELEASE_JSON=release.json node scripts/build-site.mjs
xvfb-run -a -s "-screen 0 1600x1300x24" node scripts/sweep.mjs            # app and website, full matrix
xvfb-run -a -s "-screen 0 1600x1300x24" node scripts/sweep.mjs --quick    # one size, theme and language
```

`--app-only` and `--site-only` limit the run; `--resume` continues an interrupted run in the same output folder, keeping finished checks and refusing to continue if the build or the matrix changed, so one report never mixes two builds; `MT_SWEEP_SIZES`, `MT_SWEEP_THEMES`, `MT_SWEEP_LANGS`, `MT_SWEEP_ROUTES` and `MT_SWEEP_SITE_ROUTES` narrow it further. The surfaces are listed in `scripts/lib/sweep-routes.mjs`; the in-page checks are in `src/shared/sweep-probes.js`; the app side runs in `src/main/sweep.js` with a throwaway profile, so it never touches your settings and can run beside an open copy of the app. The website is served over local HTTP, as GitHub Pages serves it.

## When something goes wrong

The sweep exits with code 1 when anything is found and writes `out/sweep/summary.md` (distinct problems, most frequent first, each with one example surface) and `out/sweep/report.json`. A surface that fails to open is reported as a sweep error, not skipped.

## Security and privacy

The app sweep uses a temporary profile and the website sweep a fresh browser context, so no account, token or personal setting is read or changed. The reports contain element selectors and visible interface text only.

## How to verify

Run the full sweep after a build and confirm it reports zero findings. To prove a check works, undo one of the fixes above (for example remove a slider's focus ring) and watch the sweep report it. An automated pass never replaces looking at the screenshots.

## 廣東話摘要

發佈之前自動逐個畫面、逐個主題、逐種語言同四個視窗大小檢查無障礙、焦點、截字、重疊同主控台錯誤，要零問題先可以出。

## Suggested articles

- [Accessibility tools](accessibility.md)
- [Design reference and parity](design-reference.md)
- [Context menus](../navigation/context-menus.md)
