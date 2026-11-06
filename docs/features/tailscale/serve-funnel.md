# Serve and Funnel

## Behaviour

Serve shares a local service with your tailnet; Funnel shares it with the internet. The target builder switches between a port, a URL (http, https, self-signed https or tcp backend), a file, a folder or static text. Every flag has its own control: `--bg`, `--https`, `--http`, `--tcp`, `--tls-terminated-tcp`, `--set-path`, `--proxy-protocol`, `--service`, `--tun`, `--accept-app-caps`, `--yes`. The page lists what is being served now, with public or tailnet-only badges, and offers stop, reset, drain, advertise and Service config import and export.

## Configuration

Funnel ports are limited to 443, 8443 and 10000 and are offered as a segmented choice.

## When something goes wrong

Funnel requires HTTPS certificates and the funnel node attribute in your policy file; Tailscale's own error is shown when they are missing.

## Security and privacy

Funnel makes a local service reachable by anyone on the internet. Reset and turning a handler off ask for confirmation.

## How to verify

Serve port 3000 in the background, open the listed URL from another tailnet device, then stop it.

## 廣東話摘要

Serve 同 tailnet 分享本機服務，Funnel 公開畀互聯網。目標可以係 port、網址、檔案、資料夾或文字。

## Suggested articles

- [HTTPS certificates](../tailscale/certificates.md)
- [Every CLI command and flag](../tailscale/cli-commands.md)
