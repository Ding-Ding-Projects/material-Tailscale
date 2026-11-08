# Every CLI command and flag

## Behaviour

The Every command destination is generated from a hand-written catalogue of all 73 Tailscale CLI commands and 197 flags (from the official CLI, Serve, Funnel and Tailnet Lock references). Each flag becomes a typed rich control: tri-state switches, segmented pickers, steppers with bounds, duration sliders with unit, CIDR and tag chip editors, live peer, exit-node and account pickers, file and folder browsers, masked secrets and a Serve target builder. A live preview shows the exact command; only flags you touch are sent; validation runs before anything executes. Output renders as a JSON tree or text, with copy and export in every format. Favourites float to the top.

**Guide me** (beside Run) walks through the command's options one at a time with Back, Next, "Skip, keep the default" and a progress bar, then returns to the full form. A failed command shows a **Copy a help request** button with the command, exit code and error. With Momentum on, a successful command suggests one related next command.

## Configuration

The global `--socket` flag is set once in Settings > Tailscale.

## When something goes wrong

Unknown flags or malformed values are refused by the main process, not just the form.

## Security and privacy

Commands run with execFile and an argument list, never through a shell.

## How to verify

Open `set`, change one flag, and check the preview shows only that flag.

## 廣東話摘要

73 個指令、197 個旗標，每個都有專屬控制項同即時預覽。

## Suggested articles

- [Raw console](Tailscale-Raw-Console)
- [Admin console (Tailscale API)](Tailscale-Admin-Console)
