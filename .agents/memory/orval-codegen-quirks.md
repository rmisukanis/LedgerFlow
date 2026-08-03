---
name: Orval codegen quirks
description: Non-obvious Orval v8 behaviors that trip up generated hook usage
---

## Query key naming — double-prefix
Generated query key helpers follow the pattern `getGet<OperationName>QueryKey`, not `get<OperationName>QueryKey`.
Example: `useGetTransactionSummary` → key helper is `getGetTransactionSummaryQueryKey()`.

**Why:** Orval prefixes the getter function (`getTransactionSummary`) with another `get` to form the key helper name.

## integer vs number in OpenAPI spec
Use `type: number` for all numeric fields in `openapi.yaml`. Using `type: integer` causes Orval v8 to emit `z.number().int()` (Zod `.int()` method) which does not exist in Zod v3. This breaks `pnpm run typecheck:libs`.

## Multipart file upload
Do NOT put `multipart/form-data` request bodies in the OpenAPI spec. Orval cannot generate Zod-safe server schemas for `File`/`Blob`. Instead:
- Omit from spec entirely
- Use `multer` directly in the route handler
- On the frontend, call the endpoint with a plain `fetch()` + `FormData` (not the generated hook)

## Hook call patterns
- Queries return `T` directly (not `{ data: T }`)
- Pass `queryKey` when using `enabled`: `useGetThing(id, { query: { enabled: !!id, queryKey: getGetThingQueryKey(id) } })`
- Mutations: `mutation.mutate({ data: { ... } })` — body always under `data` key
