# Accounts and login

## Behaviour

Lists every account logged in on this device (`tailscale switch --list --json`) with one-click switching, removing (alpha), `whoami`, logout, and a full login form with every flag: auth key or OAuth client and ID token for workload identity, login server, hostname, tags, routes, exit node, operator, posture, QR code, timeout and unattended mode on Windows. Login URLs stream into the page with an Open button.

## Configuration

Secrets accept a `file:` prefix through a file browser button.

## When something goes wrong

If the daemon is stopped the login form says so; logout uses super confirmation.

## Security and privacy

Auth keys and client secrets are masked and never written to history.

## How to verify

Add a second account, switch between them, and confirm on Home.

## 廣東話摘要

本機所有帳戶、快速切換、完整登入選項同登出。

## Suggested articles

- [Every CLI command and flag](../tailscale/cli-commands.md)
