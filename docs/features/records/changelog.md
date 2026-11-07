# Changelog viewer

## Behaviour

Every published release with its date, dim sum code name and commit, filtered by date range and regex search, exported or copied with its range. The release this copy is running is marked **running now**.

Work on `main` that has no release yet appears as **Unreleased**, with its title and an "on main, not released yet" badge. The release build stamps that section with its version, date, code name and commit, so the changelog inside an installed copy names the release it shipped in. The same section becomes the change list in the release notes.

`CHANGELOG.md` headings use `## v1.2.3 · 2026-01-02 · Code name · 代號 · sha` for releases and `## Unreleased: Title` for pending work; `scripts/lib/changelog.mjs` parses them and `test/changelog.test.mjs` checks every heading.

## Configuration

Help > Changelog.

## When something goes wrong

—

## Security and privacy

—

## How to verify

Filter by a date range; the Unreleased entry stays visible only while the range is open at the end. Run `npm test` to check every heading parses.

## 廣東話摘要

更新紀錄檢視器。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
