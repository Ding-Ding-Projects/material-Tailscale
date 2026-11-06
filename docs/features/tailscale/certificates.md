# HTTPS certificates

## Behaviour

Runs `tailscale cert` for this device's MagicDNS name (suggested automatically) with save pickers for the certificate and key files, `--min-validity` as a duration and `--serve-demo`.

## Configuration

Leave the file paths empty to use Tailscale's defaults.

## When something goes wrong

HTTPS must be enabled for the tailnet; otherwise Tailscale explains how.

## Security and privacy

The private key is written only where you choose.

## How to verify

Request a certificate and open the written file.

## 廣東話摘要

為本機 ts.net 名稱攞 Let's Encrypt 證書。

## Suggested articles

- [Serve and Funnel](../tailscale/serve-funnel.md)
