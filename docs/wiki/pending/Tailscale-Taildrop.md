# Taildrop

## Behaviour

Drop files onto the page or browse for them, pick a device with the live peer picker, and send with `tailscale file cp`. Progress streams into the page. Receive files with `tailscale file get` into a folder you choose, with a conflict policy (skip, overwrite, rename), wait and loop options.

## Configuration

The update interval for progress is a duration slider (default 250 ms).

## When something goes wrong

If a device cannot receive files the error from Tailscale is shown in the output panel.

## Security and privacy

Files go directly between your devices over Tailscale.

## How to verify

Send a small file to another device and receive it there with Receive files.

## 廣東話摘要

拖檔案入嚟，揀裝置傳送；或者將收到嘅檔案放入指定資料夾。

## Suggested articles

- [Peers and live status](Tailscale-Peers)
