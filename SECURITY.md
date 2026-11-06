# Security

Please report vulnerabilities privately through GitHub's "Report a vulnerability" on this repository.

- Tailscale commands run through `execFile` with argument lists built from a validated catalogue; no shell is used.
- Admin API requests are limited to documented method and path pairs on `api.tailscale.com`.
- Credentials (API tokens, OAuth secrets, lock credentials, authenticator secrets) are encrypted with Electron safeStorage (the operating system keychain) and are not written to history, exports or logs.
- Installers are unsigned; verify downloads come from this repository's releases.
