# Exit nodes

## Behaviour

Choose an exit node from a live list (your own exit nodes and Mullvad locations from `tailscale exit-node list`), let Tailscale pick automatically (`auto:any`), ask for a suggestion (`tailscale exit-node suggest`) or turn it off. A switch controls `--exit-node-allow-lan-access`. Another switch advertises this device as an exit node (`--advertise-exit-node`).

## Configuration

Apply runs `tailscale set --exit-node=<choice> --exit-node-allow-lan-access=<on|off>`. Filter the list by name, country or city.

## When something goes wrong

Advertising needs admin approval; the app says so. If the list is empty, the app falls back to peers that offer themselves as exit nodes.

## Security and privacy

Exit node traffic goes through the chosen device. LAN access keeps local devices reachable while it is on.

## How to verify

Pick an exit node, apply, then check the Home hero shows it and `tailscale status` marks it.

## 廣東話摘要

揀出口節點、自動揀、攞建議，或者將本機宣告做出口節點。

## Suggested articles

- [Peers and live status](../tailscale/peers.md)
- [Subnet routes and app connectors](../tailscale/subnet-routes.md)
