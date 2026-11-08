# Regex debugger

## Behaviour

Tools > Regex debugger, and **Step through** in every regex builder, run a pattern over a text
and record every step the engine takes: each start position it tries, each token it matches or
fails to match, each repeat it attempts and each time it backtracks to try another way. A
scrubber, step buttons and Play move through the steps; the pattern shows the current token
highlighted and the text shows how far the current attempt has got. The step list can show
everything, only backtracks or only matches, and a row jumps to its step.

The page counts the steps and backtracks. When a pattern takes far more steps than the text is
long (a repeat inside a repeat, or alternatives that can match the same text), it says so and
explains how to rewrite it. Try `^(a+)+b` on `aaaac`: 136 steps and 30 backtracks, and 131,100
steps once the text has ten more letters; `^a+b` gives the same answer in 31.

## Configuration

Flags: ignore case (`i`), multiline (`m`), dot matches newline (`s`) and Unicode (`u`). The text
is limited to its first 4,000 characters, the run stops after 200,000 steps, and the first
20,000 steps are kept for stepping.

## When something goes wrong

- Lookbehind (`(?<=…)`, `(?<!…)`), Unicode property escapes (`\p{…}`) and the `v` flag are refused
  with that reason; the attempt trace and the rest of the builder still run them with the real
  engine.
- A pattern that does not parse shows the parser's message.
- A run that reaches 200,000 steps stops and says so instead of hanging.

## Security and privacy

Everything runs in the page. The pattern and text are not saved or sent anywhere.

## How to verify

`test/regex-debug.test.mjs` runs 32 patterns through the debugger and the browser engine and
fails if any match, span or group differs; it also checks that every step is counted, that a
runaway pattern stops at the limit, and that unsupported constructs are refused.

## 廣東話摘要

正則除錯器會一步一步行俾你睇：每次嘗試、配對、失敗同回溯都有記錄，可以拉、可以播，
回溯太多會提你點改。答案同瀏覽器引擎對過，32 個 pattern 冇一個錯。

## Suggested articles

- [Regex builder](Navigation-Regex-Builder)
- [Command palette (Ctrl+Shift+F)](Navigation-Command-Palette)
