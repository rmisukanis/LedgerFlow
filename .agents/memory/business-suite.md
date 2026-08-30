---
name: Business Suite architecture
description: Overall structure of the 3-module business productivity suite
---

## Modules
1. **QuickBooks CRUD** — QuickBooks invoice and deposit search with OAuth
2. **API Explorer** — Postman-like request runner with saved collections

## Monorepo layout
- `artifacts/app` — React/Vite frontend, port via `$PORT`, preview at `/`
- `artifacts/api-server` — Express 5 backend, port 8080, mounted at `/api`
- `lib/db` — Drizzle ORM schema + migrations (PostgreSQL)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`)
- `lib/api-client-react` — Orval-generated React Query hooks
- `lib/api-zod` — Orval-generated Zod schemas

## DB tables
`invoices`, `qb_tokens`, `api_collections`, `api_requests`, `transactions`

## Key packages on api-server
`intuit-oauth`, `multer`, `xlsx`, `@types/multer`

## Frontend pages
- `/` and `/crud` — QuickBooks CRUD (`src/pages/invoices.tsx`)
- `/api-explorer` — API Explorer (`src/pages/api-explorer.tsx`)

**Why:** Single-artifact approach keeps routing simple and avoids cross-artifact auth complexity.
