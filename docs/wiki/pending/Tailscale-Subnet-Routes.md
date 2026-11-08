# Subnet routes and app connectors

## Behaviour

Advertise local subnets with a CIDR chip editor that validates each route, offers common LAN suggestions and accepts pasted lists. Tri-state switches set `--accept-routes`, `--snat-subnet-routes`, `--stateful-filtering` and `--advertise-connector`; "Leave as is" sends nothing for that flag.

## Configuration

Apply runs one `tailscale set` with only the values you changed. An empty route list clears all advertised routes.

## When something goes wrong

Invalid CIDRs are refused inline before anything runs. Routes still need approval in the admin console (or Admin > Devices > Routes in this app).

## Security and privacy

Advertising routes exposes those networks to tailnet members allowed by your policy file.

## How to verify

Add your home LAN subnet, apply, and confirm with `tailscale debug prefs` or the admin console.

## 廣東話摘要

用 CIDR 晶片編輯器宣告子網，設定接受路由、SNAT、有狀態過濾同 App 連接器。

## Suggested articles

- [Exit nodes](Tailscale-Exit-Nodes)
- [Admin console (Tailscale API)](Tailscale-Admin-Console)
