# Regex builder

## Behaviour

Every search has a regex toggle and a builder: token palette, flags, live highlighting, groups, replacement preview, plain-language explanation, code for JavaScript, Python, Go, C#, Java, Rust and PowerShell, escape as literal, a slow-pattern warning and a saved library.

Tools > Regex builder adds:

- **Flavour conversion** to PCRE, Python, .NET, Java, Go (RE2), Rust and POSIX ERE. Named groups, back-references, Unicode escapes and shorthand classes are rewritten; anything the target cannot express (for example lookaround in Go or Rust) is listed as "Needs attention" instead of being dropped silently.
- **Attempt trace**: every start position the engine tried, in order, with the match, captures and time at each.
- **Benchmark**: 25 runs per engine variant (default, `u`, `v`, case-insensitive) with median and worst time and match count. Only this app's JavaScript engine is timed.
- **Search inside files (GREP)**: a folder search with include patterns, case option, per-file results and Show in folder. Binary files and files over 2 MB are skipped and counted.

## Parity ledger

| Capability | State |
| --- | --- |
| Build from tokens, explain, test, replace | Yes |
| Code generation for 7 languages | Yes |
| Flavour conversion with loss report | Yes (8 flavours) |
| Debugger | Attempt trace per start position; a step-by-step backtracking view inside one attempt is not available because the browser engine does not expose it |
| Benchmark | JavaScript engine variants only; other languages' engines are not executed |
| GREP over folders | Yes |
| Library of saved patterns | Yes (per device) |
| Split, forum, and source-code editor integration | Not built |

## Configuration

Open from the wrench beside any search or Tools > Regex builder.

## When something goes wrong

Invalid patterns show the engine error inline.

## Security and privacy

—

## How to verify

Build a Tailscale IP pattern and test it.

## 廣東話摘要

正則表達式工具。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
