# Diagnostics

## Behaviour

Network check (`tailscale netcheck --format=json`) shows UDP, IPv4, IPv6, NAT type, nearest DERP, public IP and animated latency bars for every DERP region. Checks from extensions you allowed run with **Run checks** and list each result as fine, needs a look or problem (see [Extensions](Extensions-Extensions)). Forms for ping, version, metrics print and write, bug report, system policies list and reload, update, local web interface, wait, licences, shell completion, kubeconfig, systray, Synology and macOS system extension commands, nc, ssh and get.

## Configuration

Platform-specific commands carry a Windows, macOS or Linux badge.

## When something goes wrong

Each command shows its exit code and stderr when it fails.

## Security and privacy

Diagnostics run locally. Bug reports send logs to Tailscale only when you run that command.

## How to verify

Run the network check and compare with `tailscale netcheck`.

## 廣東話摘要

網絡檢查、DERP 延遲、版本、指標、錯誤報告同系統政策。

## Suggested articles

- [Every CLI command and flag](Tailscale-Cli-Commands)
