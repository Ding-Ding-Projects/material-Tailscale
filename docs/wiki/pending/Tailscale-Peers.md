# Peers and live status

## Behaviour

The Peers destination lists every device on your tailnet from `tailscale status --json`, refreshed every few seconds. Each card shows the device name, Tailscale IPs, operating system, tags, whether it is an exit node, traffic in and out, last-seen time, and its path: **direct** (a peer-to-peer connection), **relayed** (through a DERP relay), **idle** or **offline**. Cards and the table view share one search box with a regex option, a connection filter, multi-select with select-all, invert and bulk ping, copy IPs and export. Right-click any device for copy, ping, whois, SSH, Taildrop, use as exit node, open in a new tab or raw details; actions from extensions you allowed (such as Copy SSH command or Open web page) follow, separated by a line (see [Extensions](Extensions-Extensions)).

## Configuration

The Status page (open it from the New tab catalogue or with Ctrl+Shift+F) is the evidence view behind those cards: a table of checks (is the Tailscale program found, the backend state, health warnings, the last poll, MagicDNS suffix, tailnet and client version), each with its state and where the claim comes from. When Tailscale is missing, the places that were searched sit behind a "Searched N places" disclosure. With the daemon running it adds This device (host name, DNS name, Tailscale IPs, OS, relay, online) and Health (every warning tailscaled reports). Export JSON saves the current status.

Settings > Tailscale > Status refresh sets the poll interval (1 to 60 seconds). The search and filter row is collapsible and remembers its state.

## When something goes wrong

If Tailscale is not installed or not running the page shows the exact places searched and a button to install or choose its location. Ping and whois failures show the real exit code and error text.

## Security and privacy

Status is read locally from the Tailscale daemon. Nothing is sent anywhere by this page.

## How to verify

Open Peers with Tailscale running; compare the list with `tailscale status`. Select two devices and use Ping all.

## 廣東話摘要

列出 tailnet 上每部裝置、直連定中繼、流量、標籤，可以搜尋、多選、批量 Ping 同匯出。

## Suggested articles

- [Exit nodes](Tailscale-Exit-Nodes)
- [Every CLI command and flag](Tailscale-Cli-Commands)
- [Admin console (Tailscale API)](Tailscale-Admin-Console)
