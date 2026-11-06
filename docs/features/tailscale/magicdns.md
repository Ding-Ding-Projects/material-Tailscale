# MagicDNS and DNS queries

## Behaviour

Shows `tailscale dns status --json` as a collapsible tree, runs live queries through the Tailscale forwarder with `tailscale dns query <name> <type>` (A, AAAA, CNAME, MX, NS, PTR, SRV, TXT, CAA, SOA) and toggles `--accept-dns`. Tailnet-wide DNS (nameservers, search paths, split DNS, MagicDNS) lives in Admin > DNS.

## Configuration

The record type is a segmented picker; the name field suggests your peers.

## When something goes wrong

Older clients without `dns query` show Tailscale's own error.

## Security and privacy

Queries go through your local Tailscale DNS forwarder.

## How to verify

Query a peer name for A and compare with `tailscale ip`.

## 廣東話摘要

睇本機 DNS 狀態、做即時查詢、切換接受 DNS。

## Suggested articles

- [Admin console (Tailscale API)](../tailscale/admin-console.md)
