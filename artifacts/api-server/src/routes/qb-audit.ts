import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db, qbAuditTable, qbDocumentsTable } from "@workspace/db";
import { getAuthorizedClient, getQbApiBase, getStoredToken } from "../lib/qb-client";

const router: IRouter = Router();
const UNDEPOSITED_FUNDS = "4";

function updatedTime(record: Record<string, unknown>) {
  const meta = record.MetaData as { LastUpdatedTime?: string } | undefined;
  return String(meta?.LastUpdatedTime ?? "");
}

async function qbRequest(path: string, method: "GET" | "POST", body?: unknown, query?: string) {
  const client = await getAuthorizedClient();
  const token = await getStoredToken();
  if (!client || !token) throw new Error("QuickBooks is not connected");
  const url = `${getQbApiBase()}/v3/company/${token.realmId}${path}?minorversion=75${query ? `&${query}` : ""}`;
  try {
    const response = await client.makeApiCall({
      url,
      method,
      headers: method === "POST"
        ? { Accept: "application/json", "Content-Type": "application/json" }
        : { Accept: "application/json" },
      body: method === "POST" ? body : undefined,
    });
    return (response.json ?? response.body) as Record<string, unknown>;
  } catch (err) {
    const failure = err as { message?: string; fault?: { errors?: { message?: string; detail?: string; code?: string }[] } };
    const item = failure.fault?.errors?.[0];
    const text = [item?.detail, item?.message, item?.code].filter(Boolean).join(" ");
    throw new Error(text || failure.message || "QuickBooks request failed");
  }
}

function isMissing(err: unknown) {
  const text = err instanceof Error ? err.message : "";
  return text.includes("610") || /not found/i.test(text);
}

async function saveDocument(realmId: string, entity: string, record: Record<string, unknown>) {
  const qbId = String(record.Id ?? "");
  const lastUpdatedTime = updatedTime(record);
  const existing = await db.select({ id: qbDocumentsTable.id }).from(qbDocumentsTable).where(and(
    eq(qbDocumentsTable.realmId, realmId),
    eq(qbDocumentsTable.entity, entity),
    eq(qbDocumentsTable.qbId, qbId),
  ));
  if (existing.length === 0) {
    await db.insert(qbDocumentsTable).values({ realmId, entity, qbId, lastUpdatedTime, payload: record });
    return;
  }
  await db.update(qbDocumentsTable).set({ lastUpdatedTime, payload: record, storedAt: new Date() }).where(and(
    eq(qbDocumentsTable.realmId, realmId),
    eq(qbDocumentsTable.entity, entity),
    eq(qbDocumentsTable.qbId, qbId),
  ));
}

// Reads saved fixes for this company. The range is the date the fix was saved, not the QuickBooks transaction date.
router.post("/qb/audit/read", async (req, res): Promise<void> => {
  const start = String(req.body?.startDate ?? "");
  const end = String(req.body?.endDate ?? "");
  if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end))) {
    res.status(400).json({ error: "Dates must be YYYY-MM-DD." });
    return;
  }
  const token = await getStoredToken();
  if (!token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  const where = [eq(qbAuditTable.realmId, token.realmId), isNull(qbAuditTable.reversedAt)];
  if (start) where.push(gte(qbAuditTable.changedAt, new Date(`${start}T00:00:00.000Z`)));
  if (end) where.push(lte(qbAuditTable.changedAt, new Date(`${end}T23:59:59.999Z`)));
  const records = await db.select().from(qbAuditTable).where(and(...where)).orderBy(desc(qbAuditTable.changedAt));
  res.json({ records });
});

// Moves each payment to Undeposited Funds, creates the bank deposit, and records both in the database.
router.post("/qb/audit/submit", async (req, res): Promise<void> => {
  const memo = String(req.body?.memo ?? "").trim();
  const fixes = Array.isArray(req.body?.fixes) ? req.body.fixes as { paymentId?: unknown; originalAccount?: unknown; accountName?: unknown }[] : null;
  if (!memo || !fixes || fixes.length === 0) {
    res.status(400).json({ error: "Send the memo and at least one proposed payment." });
    return;
  }
  const token = await getStoredToken();
  if (!token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  const stored = await db.select({ payload: qbDocumentsTable.payload }).from(qbDocumentsTable).where(and(
    eq(qbDocumentsTable.realmId, token.realmId),
    eq(qbDocumentsTable.entity, "Payment"),
  ));
  const payments = new Map(stored.map(row => [String(row.payload.Id ?? ""), row.payload]));
  const prior = await db.select({ paymentId: qbAuditTable.paymentId, depositId: qbAuditTable.depositId }).from(qbAuditTable).where(and(
    eq(qbAuditTable.realmId, token.realmId),
    isNull(qbAuditTable.reversedAt),
  ));
  const already = new Map(prior.map(row => [row.paymentId, row.depositId]));
  const saved: { paymentId: string; depositId: string }[] = [];
  const seen = new Set<string>();
  for (const fix of fixes) {
    const paymentId = String(fix.paymentId ?? "");
    if (!paymentId || seen.has(paymentId)) continue;
    seen.add(paymentId);
    const existingDeposit = already.get(paymentId);
    if (existingDeposit) {
      saved.push({ paymentId, depositId: existingDeposit });
      continue;
    }
    const payment = payments.get(paymentId);
    if (!payment) {
      res.status(saved.length ? 200 : 404).json({ saved, error: `Payment ${paymentId} is not in the database. Pull invoices again.` });
      return;
    }
    const account = payment.DepositToAccountRef as { value?: string; name?: string } | undefined;
    const storedAccount = String(account?.value ?? "");
    const bankAccount = storedAccount === UNDEPOSITED_FUNDS ? String(fix.originalAccount ?? "") : storedAccount;
    const bankName = String(fix.accountName ?? account?.name ?? "");
    const amount = Number(payment.TotalAmt ?? 0);
    const txnDate = String(payment.TxnDate ?? "");
    if (!bankAccount || bankAccount === UNDEPOSITED_FUNDS || !txnDate || !Number.isFinite(amount) || amount === 0) {
      res.status(saved.length ? 200 : 400).json({ saved, error: `Payment ${paymentId} is missing an account, date, or amount.` });
      return;
    }
    try {
      if (storedAccount !== UNDEPOSITED_FUNDS) {
        const paymentResponse = await qbRequest("/payment", "POST", {
          Id: paymentId,
          SyncToken: String(payment.SyncToken ?? "0"),
          sparse: true,
          DepositToAccountRef: { value: UNDEPOSITED_FUNDS },
        });
        const updatedPayment = (paymentResponse.Payment ?? paymentResponse) as Record<string, unknown>;
        await saveDocument(token.realmId, "Payment", updatedPayment);
      }
      const depositResponse = await qbRequest("/deposit", "POST", {
        TxnDate: txnDate,
        PrivateNote: memo,
        DepositToAccountRef: { value: bankAccount, name: bankName },
        Line: [{ Amount: amount, LinkedTxn: [{ TxnId: paymentId, TxnType: "Payment", TxnLineId: "0" }] }],
      });
      const deposit = (depositResponse.Deposit ?? depositResponse) as Record<string, unknown>;
      await saveDocument(token.realmId, "Deposit", deposit);
      const depositAccount = deposit.DepositToAccountRef as { value?: string; name?: string } | undefined;
      await db.insert(qbAuditTable).values({
        realmId: token.realmId,
        changedAt: new Date(),
        memo,
        paymentId,
        txnDate,
        totalAmt: amount.toFixed(2),
        originalDepositAccount: bankAccount,
        updatedDepositAccount: UNDEPOSITED_FUNDS,
        depositId: String(deposit.Id ?? ""),
        depositToAccountRef: String(depositAccount?.value ?? bankAccount),
        depositToAccountRefName: String(depositAccount?.name ?? bankName),
        lineAmount: amount.toFixed(2),
        linkedTxnId: paymentId,
        linkedTxnType: "Payment",
      });
      saved.push({ paymentId, depositId: String(deposit.Id ?? "") });
    } catch (err) {
      res.status(saved.length ? 200 : 502).json({ saved, error: err instanceof Error ? err.message : `Payment ${paymentId} could not be saved.` });
      return;
    }
  }
  res.json({ saved });
});

async function removeDocument(realmId: string, entity: string, qbId: string) {
  await db.delete(qbDocumentsTable).where(and(
    eq(qbDocumentsTable.realmId, realmId),
    eq(qbDocumentsTable.entity, entity),
    eq(qbDocumentsTable.qbId, qbId),
  ));
}

// Deletes the deposit created by a saved fix and puts the payment back on its original bank account.
router.post("/qb/audit/reverse", async (req, res): Promise<void> => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id)) : null;
  if (!ids || ids.length === 0) {
    res.status(400).json({ error: "Select at least one saved change." });
    return;
  }
  const token = await getStoredToken();
  if (!token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  const rows = await db.select().from(qbAuditTable).where(and(
    eq(qbAuditTable.realmId, token.realmId),
    isNull(qbAuditTable.reversedAt),
    inArray(qbAuditTable.id, ids),
  ));
  const byId = new Map(rows.map(row => [row.id, row]));
  const reversed: number[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || !row.originalDepositAccount) continue;
    try {
      if (row.depositId) {
        try {
          const depositBody = await qbRequest(`/deposit/${row.depositId}`, "GET");
          const deposit = (depositBody.Deposit ?? depositBody) as Record<string, unknown>;
          if (deposit.Id) {
            await qbRequest("/deposit", "POST", { Id: String(deposit.Id), SyncToken: String(deposit.SyncToken ?? "0") }, "operation=delete");
          }
        } catch (err) {
          if (!isMissing(err)) throw err;
        }
        await removeDocument(token.realmId, "Deposit", row.depositId);
      }
      const paymentBody = await qbRequest(`/payment/${row.paymentId}`, "GET");
      const payment = (paymentBody.Payment ?? paymentBody) as Record<string, unknown>;
      const paymentResponse = await qbRequest("/payment", "POST", {
        Id: row.paymentId,
        SyncToken: String(payment.SyncToken ?? "0"),
        sparse: true,
        DepositToAccountRef: { value: row.originalDepositAccount },
      });
      const updatedPayment = (paymentResponse.Payment ?? paymentResponse) as Record<string, unknown>;
      await saveDocument(token.realmId, "Payment", updatedPayment);
      await db.update(qbAuditTable).set({ reversedAt: new Date() }).where(eq(qbAuditTable.id, row.id));
      reversed.push(row.id);
    } catch (err) {
      res.status(reversed.length ? 200 : 502).json({ reversed, error: err instanceof Error ? err.message : `Change ${id} could not be reversed.` });
      return;
    }
  }
  if (reversed.length === 0) {
    res.status(404).json({ reversed, error: "Those changes are not in the audit register." });
    return;
  }
  res.json({ reversed });
});

export default router;
