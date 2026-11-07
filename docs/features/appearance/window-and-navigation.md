# Window and navigation

## Behaviour

A frameless window with a custom title bar, a navigation rail, and browser-style tabs: one workspace tab that ordinary navigation reuses, plus utility tabs opened only from New tab (Ctrl+T) or "Open in a new tab".

On Windows the title bar keeps Windows' own minimise, maximise and close buttons through the title-bar overlay, so hovering maximise offers Snap layouts. The overlay's colours follow the theme: the app sends the title bar's surface and text colours, and the main process accepts only `#rrggbb` values. The bar is a drag region and everything clickable in it opts out of dragging. On other platforms the app draws its own buttons.

The version and its update time always stay on the title bar: the full line on wide windows, a shorter one (version, date and minute) on narrow ones, with the full line as a tooltip. On narrow windows the search button keeps only its icon.

The tab list holds only tabs. Left, Right, Home and End move between them, Delete closes the focused utility tab, and the close mark beside each tab is for the pointer. New tab sits outside the list, and the whole bar is a labelled navigation landmark.

## Configuration

Tabs persist across restarts.

## When something goes wrong

—

## Security and privacy

—

## How to verify

Open a utility tab from the + button and close it with Ctrl+W. On Windows, rest the pointer on maximise and the Snap layouts panel opens; switch between light and dark themes and the caption buttons change colour with the title bar. Each release also carries two photographs of the installed app on a clean Windows runner: `windows-title-bar.png` and `windows-maximise-hover.png`.

## 廣東話摘要

無邊框視窗、導航欄同分頁。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
