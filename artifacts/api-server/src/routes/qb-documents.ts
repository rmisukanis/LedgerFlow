import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, qbDocumentsTable } from "@workspace/db";
import { getStoredToken } from "../lib/qb-client";

const router: IRouter = Router();
const ENTITIES = new Set(["Invoice", "Payment", "Deposit"]);

function lastUpdatedTime(record: Record<string, unknown>) {
  const meta = record.MetaData as { LastUpdatedTime?: string } | undefined;
  return String(meta?.LastUpdatedTime ?? "");
}

// Saves the raw QuickBooks records for this company. An id that is already stored is left alone when LastUpdatedTime matches, and replaced when it does not.
router.post("/qb/documents", async (req, res): Promise<void> => {
  const entity = String(req.body?.entity ?? "");
  const records = Array.isArray(req.body?.records) ? req.body.records as Record<string, unknown>[] : null;
  if (!ENTITIES.has(entity) || !records) {
    res.status(400).json({ error: "Send an Invoice, Payment, or Deposit list." });
    return;
  }
  const token = await getStoredToken();
  if (!token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  const incoming = records.filter(record => String(record.Id ?? ""));
  const ids = incoming.map(record => String(record.Id));
  const existing = ids.length === 0 ? [] : await db.select({
    qbId: qbDocumentsTable.qbId,
    lastUpdatedTime: qbDocumentsTable.lastUpdatedTime,
  }).from(qbDocumentsTable).where(and(
    eq(qbDocumentsTable.realmId, token.realmId),
    eq(qbDocumentsTable.entity, entity),
    inArray(qbDocumentsTable.qbId, ids),
  ));
  const stored = new Map(existing.map(row => [row.qbId, row.lastUpdatedTime]));
  let inserted = 0;
  let unchanged = 0;
  let updated = 0;
  for (const record of incoming) {
    const qbId = String(record.Id);
    const updatedTime = lastUpdatedTime(record);
    const previous = stored.get(qbId);
    if (previous === undefined) {
      await db.insert(qbDocumentsTable).values({
        realmId: token.realmId,
        entity,
        qbId,
        lastUpdatedTime: updatedTime,
        payload: record,
      });
      inserted += 1;
      continue;
    }
    if (previous === updatedTime) {
      unchanged += 1;
      continue;
    }
    await db.update(qbDocumentsTable).set({
      lastUpdatedTime: updatedTime,
      payload: record,
      storedAt: new Date(),
    }).where(and(
      eq(qbDocumentsTable.realmId, token.realmId),
      eq(qbDocumentsTable.entity, entity),
      eq(qbDocumentsTable.qbId, qbId),
    ));
    updated += 1;
  }
  res.json({ inserted, unchanged, updated });
});

// Returns the stored raw records for the requested QuickBooks ids.
router.post("/qb/documents/read", async (req, res): Promise<void> => {
  const entity = String(req.body?.entity ?? "");
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => String(id)).filter(Boolean) : null;
  if (!ENTITIES.has(entity) || !ids) {
    res.status(400).json({ error: "Send an Invoice, Payment, or Deposit id list." });
    return;
  }
  const token = await getStoredToken();
  if (!token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  if (ids.length === 0) {
    res.json({ records: [] });
    return;
  }
  const rows = await db.select({ payload: qbDocumentsTable.payload }).from(qbDocumentsTable).where(and(
    eq(qbDocumentsTable.realmId, token.realmId),
    eq(qbDocumentsTable.entity, entity),
    inArray(qbDocumentsTable.qbId, ids),
  ));
  res.json({ records: rows.map(row => row.payload) });
});

export default router;
