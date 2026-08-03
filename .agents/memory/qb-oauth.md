---
name: QB OAuth token storage
description: How QuickBooks OAuth is implemented and how tokens persist
---

## Implementation
- Package: `intuit-oauth` v4 (not v6 — v6 was not in the npm registry on Replit)
- Tokens stored in `qb_tokens` DB table (schema: `lib/db/src/schema/qb-tokens.ts`)
- Helper: `artifacts/api-server/src/lib/qb-client.ts`

## Auto-refresh flow
`getAuthorizedClient()` reads the most recent token row, checks expiry, and calls `client.refresh()` if the access token is expired. Refresh token lasts ~100 days.

## makeApiCall response type
`makeApiCall()` returns `ApiResponse` (not `AuthResponse`). Access JSON via `response.json`, NOT `response.getJson()` — that method is on `AuthResponse` only.

## Redirect URI
Must be registered in Intuit Developer Portal → app → Keys & OAuth. Format:
`https://<REPLIT_DEV_DOMAIN>/api/qb/auth/callback`

Dev domain changes on every restart of a stopped repl — re-register if the domain changes.

## Secrets
`QB_CLIENT_ID`, `QB_CLIENT_SECRET` stored as Replit Secrets. `QB_ENVIRONMENT` defaults to `sandbox`.

**Why:** Persistent token storage means users only OAuth once per ~100 days, not on every server restart.
