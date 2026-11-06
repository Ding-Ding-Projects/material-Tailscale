# Tailscale API OpenAPI specification

`openapi.yaml` is the Tailscale API v2 OpenAPI document, fetched from
`https://api.tailscale.com/api/v2?outputOpenapiSchema=true` on 2026-11-06.
It is published by Tailscale Inc. under the BSD 3-Clause licence
(https://github.com/tailscale/tailscale/blob/main/LICENSE).

`scripts/gen-api-catalog.mjs` turns it into `src/shared/api-catalog.json`, which
drives the Admin destination: every endpoint, parameter and request field is
rendered as a typed control. Refresh with `npm run gen:api -- --fetch`.
