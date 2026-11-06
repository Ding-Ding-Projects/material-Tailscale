# Authenticator and QR pairing

## Behaviour

A built-in authenticator for any TOTP account: add by otpauth link, QR image, clipboard, camera or manual secret; SHA-1, SHA-256 and SHA-512; 6 to 8 digits; any period. Codes are verified against the RFC 6238 test vectors, shown large with copy, countdown and the next code. Lock pairing draws a local QR with the secret revealed only on request.

## Configuration

Tools > Authenticator.

## When something goes wrong

Bad links and images explain what is wrong.

## Security and privacy

Secrets are stored encrypted with the operating system keychain.

## How to verify

Run `npm test` for the RFC vectors.

## 廣東話摘要

內置驗證器同 QR 配對。

## Suggested articles

- [Command palette (Ctrl+Shift+F)](../navigation/command-palette.md)
- [Settings that explain themselves](../navigation/settings-explanations.md)
