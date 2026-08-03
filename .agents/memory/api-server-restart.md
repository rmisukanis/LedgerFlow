---
name: API server needs manual restart
description: api-server dev workflow does not hot-reload route changes; logs strip query strings
---
- The api-server dev workflow does NOT reliably hot-reload route/handler edits. **Why:** search filters were "broken" for a whole session because the running process predated the filter code; curl proved the route ignored params until a workflow restart fixed it. **How to apply:** after editing api-server code, restart `artifacts/api-server: API Server` before debugging behavior.
- pino-http request logs strip query strings (even OAuth callback shows bare path), so logs cannot confirm whether query params arrived — use curl instead.
