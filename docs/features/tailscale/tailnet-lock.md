# Tailnet Lock

## Behaviour

Shows whether Tailnet Lock is on, the trusted keys and this node's key with copy. Every lock subcommand has a form: sign a node key or pre-signed auth key, add and remove trusted keys (with `--re-sign`), initialise with disablement secrets, read the log with a limit, revoke compromised keys with cosign and finish steps, disable with a disablement secret, disable on this node only, and the disablement KDF.

## Configuration

Keys are entered with a chip editor that checks the tlpub: form.

## When something goes wrong

Destructive lock actions use the two-key super confirmation.

## Security and privacy

Disablement secrets are typed into masked fields and never logged or recorded in history.

## How to verify

On a lock-enabled tailnet, compare Lock status with `tailscale lock status`.

## 廣東話摘要

網絡鎖：簽署、信任鎖匙、紀錄、撤銷同停用。

## Suggested articles

- [Two-key super confirmation](../safety/super-confirmation.md)
- [Every CLI command and flag](../tailscale/cli-commands.md)
