import { Router, type IRouter } from "express";
import { db, transactionsTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  UpdateTransactionBody,
  DeleteTransactionParams,
  ImportTransactionsBody,
  ListTransactionsResponse,
  GetTransactionResponse,
  CreateTransactionResponse,
  UpdateTransactionResponse,
  GetTransactionSummaryResponse,
  ImportTransactionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeTransaction(t: Record<string, unknown>) {
  return {
    ...t,
    amount: Number(t.amount),
    category: t.category ?? null,
    externalId: t.externalId ?? null,
    notes: t.notes ?? null,
    aiFlags: t.aiFlags ?? null,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
  };
}

// GET /transactions
router.get("/transactions", async (req, res): Promise<void> => {
  const queryParams = ListTransactionsQueryParams.safeParse(req.query);
  const { source, status, search } = queryParams.success ? queryParams.data : {};

  let query = db.select().from(transactionsTable).$dynamic();

  if (source) query = query.where(eq(transactionsTable.source, source));
  else if (status) query = query.where(eq(transactionsTable.status, status));
  else if (search) query = query.where(ilike(transactionsTable.description, `%${search}%`));

  const transactions = await query.orderBy(sql`${transactionsTable.transactionDate} DESC`);
  res.json(ListTransactionsResponse.parse(transactions.map(t => serializeTransaction(t as unknown as Record<string, unknown>))));
});

// GET /transactions/summary
router.get("/transactions/summary", async (req, res): Promise<void> => {
  const all = await db.select().from(transactionsTable);

  const income = all.filter((t) => t.type === "income");
  const expenses = all.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);

  const sourceMap = new Map<string, { count: number; amount: number }>();
  for (const t of all) {
    const entry = sourceMap.get(t.source) ?? { count: 0, amount: 0 };
    entry.count++;
    entry.amount += Number(t.amount);
    sourceMap.set(t.source, entry);
  }

  res.json(
    GetTransactionSummaryResponse.parse({
      totalIncome,
      totalExpenses,
      netAmount: totalIncome - totalExpenses,
      pending: all.filter((t) => t.status === "pending").length,
      flagged: all.filter((t) => t.status === "flagged").length,
      bySource: Array.from(sourceMap.entries()).map(([source, data]) => ({
        source,
        count: data.count,
        amount: data.amount,
      })),
    })
  );
});

// POST /transactions/import
router.post("/transactions/import", async (req, res): Promise<void> => {
  const parsed = ImportTransactionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { source, data } = parsed.data;
  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  if (source === "excel" && data) {
    try {
      const rows = JSON.parse(data) as Record<string, unknown>[];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          await db.insert(transactionsTable).values({
            description: String(row.description ?? ""),
            amount: String(parseFloat(String(row.amount ?? 0))),
            type: (String(row.type ?? "expense") as "income" | "expense" | "transfer"),
            category: String(row.category ?? "") || undefined,
            source: "excel",
            transactionDate: String(row.transactionDate ?? row.date ?? new Date().toISOString().split("T")[0]),
            status: "pending",
            notes: String(row.notes ?? "") || undefined,
          });
          created++;
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "error"}`);
          failed++;
        }
      }
    } catch (err) {
      res.status(400).json({ error: "Invalid JSON data" });
      return;
    }
  } else if (source === "quickbooks") {
    // QB import is a future enhancement — return a placeholder success
    res.json(ImportTransactionsResponse.parse({ created: 0, failed: 0, errors: ["QuickBooks import not yet implemented"] }));
    return;
  }

  res.json(ImportTransactionsResponse.parse({ created, failed, errors }));
});

// POST /transactions
router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [transaction] = await db
    .insert(transactionsTable)
    .values({ ...parsed.data, amount: String(parsed.data.amount) })
    .returning();

  res.status(201).json(CreateTransactionResponse.parse(serializeTransaction(transaction as unknown as Record<string, unknown>)));
});

// GET /transactions/:id
router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [transaction] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json(GetTransactionResponse.parse(serializeTransaction(transaction as unknown as Record<string, unknown>)));
});

// PATCH /transactions/:id
router.patch("/transactions/:id", async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount != null) updateData.amount = String(parsed.data.amount);

  const [transaction] = await db
    .update(transactionsTable)
    .set(updateData)
    .where(eq(transactionsTable.id, params.data.id))
    .returning();

  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json(UpdateTransactionResponse.parse(serializeTransaction(transaction as unknown as Record<string, unknown>)));
});

// DELETE /transactions/:id
router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(transactionsTable).where(eq(transactionsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
