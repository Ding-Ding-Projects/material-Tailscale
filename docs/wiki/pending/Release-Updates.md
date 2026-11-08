# Automatic updates and installer

## Behaviour

Windows builds use Squirrel.Windows (Setup.exe, RELEASES, full and delta .nupkg). The app checks for updates at startup and every four hours, downloads in the background and shows a banner with the version, release notes, an unsigned warning, Restart to install update and Later. Installers are unsigned and Windows may warn about an unknown publisher.

Each release ships its own full package, one delta built from the previous release's full package, and a `RELEASES` index that lists exactly those two. A copy one version behind applies the delta; an older copy tries it, sees it does not match, and Squirrel's `Update.exe` falls back to the full package on its own.

**Check for updates** on the About page and in Settings > About & updates asks the installed app to check now and reports the outcome: checking, already up to date, downloading (you are asked before it restarts), or the error with a button that copies a help request. A copy that was not installed by the Windows installer (a development run, or a build on another platform) says that it does not update itself and points to the website.

## Configuration

Settings > About & updates.

## When something goes wrong

Background checks while offline are silent. A check you start yourself always reports its result, including errors.

## Security and privacy

No authenticity claim is made because nothing is signed.

## How to verify

Install an older release and let it update. The release workflow's install-proof job does this on a clean Windows runner for every release: it installs the previous release, updates it to the new one with `Update.exe`, checks the installed version and uninstalls.

## 廣東話摘要

自動更新同 Squirrel 安裝程式。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](Navigation-Command-Palette)
- [Settings that explain themselves](Navigation-Settings-Explanations)
