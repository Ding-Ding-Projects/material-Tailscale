# Automatic updates and installer

## Behaviour

Windows builds use Squirrel.Windows (Setup.exe, RELEASES, full and delta .nupkg). The app checks for updates at startup and every four hours, downloads in the background and shows a banner with the version, release notes, an unsigned warning, Restart to install update and Later. Installers are unsigned and Windows may warn about an unknown publisher.

## Configuration

Settings > About & updates.

## When something goes wrong

Offline checks are silent; errors are reported in the banner state.

## Security and privacy

No authenticity claim is made because nothing is signed.

## How to verify

Install an older release and let it update.

## 廣東話摘要

自動更新同 Squirrel 安裝程式。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
