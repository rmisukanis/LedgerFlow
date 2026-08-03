import { Router, type IRouter } from "express";
import { db, apiCollectionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateApiCollectionBody,
  UpdateApiCollectionParams,
  UpdateApiCollectionBody,
  DeleteApiCollectionParams,
  ListApiCollectionsResponse,
  CreateApiCollectionResponse,
  UpdateApiCollectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeCollection(c: Record<string, unknown>) {
  return {
    ...c,
    description: c.description ?? null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  };
}

// GET /api-collections
router.get("/api-collections", async (req, res): Promise<void> => {
  const collections = await db
    .select()
    .from(apiCollectionsTable)
    .orderBy(sql`${apiCollectionsTable.createdAt} DESC`);

  res.json(ListApiCollectionsResponse.parse(collections.map(c => serializeCollection(c as unknown as Record<string, unknown>))));
});

// POST /api-collections
router.post("/api-collections", async (req, res): Promise<void> => {
  const parsed = CreateApiCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [collection] = await db.insert(apiCollectionsTable).values(parsed.data).returning();
  res.status(201).json(CreateApiCollectionResponse.parse(serializeCollection(collection as unknown as Record<string, unknown>)));
});

// PATCH /api-collections/:id
router.patch("/api-collections/:id", async (req, res): Promise<void> => {
  const params = UpdateApiCollectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateApiCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [collection] = await db
    .update(apiCollectionsTable)
    .set(parsed.data)
    .where(eq(apiCollectionsTable.id, params.data.id))
    .returning();

  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  res.json(UpdateApiCollectionResponse.parse(serializeCollection(collection as unknown as Record<string, unknown>)));
});

// DELETE /api-collections/:id
router.delete("/api-collections/:id", async (req, res): Promise<void> => {
  const params = DeleteApiCollectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(apiCollectionsTable).where(eq(apiCollectionsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
