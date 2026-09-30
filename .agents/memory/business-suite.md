---
name: Business Suite direction
description: Product consolidation and the intended collection-driven QuickBooks explorer
---

The user wants the QuickBooks records view to be the API Explorer, not a separate CRUD module beside a generic request runner.

**Why:** They want a simpler Postman-like experience selecting method, entity, and operation from supplied Postman collections.

**How to apply:** Keep future collection-driven operations in the existing explorer. Do not restore the removed Dashboard, Financial Intelligence, or old generic explorer without a new request. Importing collections and building operation dropdowns requires the collections and further implementation; the rename alone does not supply that behavior.