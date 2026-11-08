# Building from source

## Behaviour

`build.bat` installs dependencies, builds and optionally runs (`.\build.bat --run`). `build-installer.bat` produces the Squirrel installer. `download-dependencies.bat` and `.sh` fetch pinned dependencies. All accept `/s`, `--silent` and `SILENT=1`.

## Configuration

Node.js 22 is required; the scripts report each phase.

## When something goes wrong

Each script exits non-zero on the first real failure.

## Security and privacy

No signing certificates are used.

## How to verify

Run `.\build.bat --run` on a fresh Windows machine.

## 廣東話摘要

由原始碼建置。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](Navigation-Command-Palette)
- [Settings that explain themselves](Navigation-Settings-Explanations)
