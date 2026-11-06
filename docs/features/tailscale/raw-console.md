# Raw console

## Behaviour

Type any tailscale arguments, including debug subcommands, and see rendered output. History is kept for the session list. Suggestions include common debug commands.

## Configuration

Arguments are split respecting quotes and passed as a list.

## When something goes wrong

Errors show the real exit code and stderr.

## Security and privacy

No shell is involved; the program run is always the located tailscale binary.

## How to verify

Run `debug prefs` and compare with the terminal.

## 廣東話摘要

直接輸入 tailscale 參數，包括 debug 子指令。

## Suggested articles

- [Every CLI command and flag](../tailscale/cli-commands.md)
