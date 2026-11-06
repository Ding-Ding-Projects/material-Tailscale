# Locks, unlock ladder and Support Tickets

## Behaviour

Lock any element, tab or appearance value with one of six mixes: PIN, password, PIN plus password, password plus authenticator, PIN plus authenticator, or all three. Each lock has its own credentials in the operating system vault. Wrong attempts back off exponentially. The unlock ladder (dim sum quiz, ten sums, whack-a-dumpling, then the clock) clears only the waiting, three times an hour. Support Tickets opens the data folder with the path shown.

## Configuration

Settings > Locks.

## When something goes wrong

Lost credentials: Support Tickets.

## Security and privacy

Credentials never reach the renderer; PIN and password checks run in the main process.

## How to verify

Lock the Settings page and unlock it.

## 廣東話摘要

用 PIN、密碼或驗證器鎖住任何元素。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
