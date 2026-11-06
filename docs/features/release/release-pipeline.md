# Release pipeline

## Behaviour

Every push to main builds the app on GitHub Actions, packages the installer, verifies it is unsigned, captures screenshots, counts lines and publishes a uniquely tagged release named with a dim sum code name, then appends the verified workflow timing to the notes. The workflow runs no test gate by the owner's decision; release notes say so.

## Configuration

.github/workflows/release.yml

## When something goes wrong

A failed step leaves the safe outputs uploaded as a workflow artifact.

## Security and privacy

No secrets other than the default token are used.

## How to verify

Push to main and open the newest release.

## 廣東話摘要

每次推送自動發佈。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
