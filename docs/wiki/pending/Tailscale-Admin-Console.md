# Admin console (Tailscale API)

## Behaviour

Connect an API access token or OAuth client (with scopes) and manage the whole tailnet. Devices: searchable table with multi-select bulk authorize, tags, key expiry, expire and delete, plus rename, routes approval, IPv4, posture attributes and device invites per device. Policy file: HuJSON editor with validate and test, preview rule matches and save. Keys: list, details, revoke, and a rich auth key creator. Settings: every tailnet setting prefilled from the API with only changes sent. DNS, users, webhooks, logs and log streaming, services, posture integrations, invites, contacts, OAuth apps and organisations: every operation of the vendored OpenAPI specification (93 operations) rendered with typed controls generated from its schema.

## Configuration

The tailnet defaults to `-` (the credential's tailnet).

## When something goes wrong

API errors show the HTTP status and Tailscale's message; partial bulk failures list every skipped device and why.

## Security and privacy

Credentials are encrypted with the operating system keychain and stay in the main process. Requests are only allowed for documented method and path pairs to api.tailscale.com.

## How to verify

Connect a read-only token and load Devices; compare with the admin console.

## 廣東話摘要

用 API 權杖管理成個 tailnet：裝置、政策檔、鎖匙、DNS、用戶、設定等 93 個操作。

## Suggested articles

- [Every CLI command and flag](Tailscale-Cli-Commands)
- [Local version history](Records-Local-History)
