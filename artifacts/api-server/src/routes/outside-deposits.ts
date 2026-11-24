import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool, outsideDepositsTable, outsideDepositTransactionsTable } from "@workspace/db";
import { OUTSIDE_DEPOSIT_TEMPLATES } from "../outside-deposit-templates";
import { escapeQbString, queryQuickBooks, QbNotConnectedError, QbUpstreamError } from "../lib/qb-client";

const router: IRouter = Router();

class RejectedUpload extends Error {}

function wholeId(value: string) {
  const text = value.trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return text;
  const sign = match[1];
  const fraction = match[3] ?? "";
  const digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, "");
  const shift = Number(match[4]) - fraction.length;
  if (shift >= 0) return `${sign}${digits}${"0".repeat(shift)}`;
  const point = digits.length + shift;
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

function money(value: unknown, label: string) {
  const text = String(value ?? "").trim().replace(/[$,]/g, "");
  if (!text) return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`${label} is not a number.`);
  return text;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const parsedTxnDate = sql`(CASE
  WHEN txn_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN txn_date::date
  WHEN txn_date ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' THEN to_date(txn_date, 'MM/DD/YYYY')
  ELSE NULL
END)`;

function amountText(value: string | null) {
  return value ?? "";
}

type StoredRow = {
  template: string
  transactionId: string
  standardTransferId: string | null
  txnDate: string
  timeUtc: string
  type: string
  status: string
  fromParty: string
  toParty: string
  noteInvoice: string
  amountTotal: string | null
  amountFee: string | null
  amountNet: string | null
  fundingSource: string
  destination: string
  matchedInQuickbooks: boolean
  depositId: string
}

function toResponse(row: StoredRow) {
  return {
    template: row.template,
    transaction_id: row.transactionId,
    standard_transfer_id: row.standardTransferId ?? "",
    date: row.txnDate,
    time_utc: row.timeUtc,
    type: row.type,
    status: row.status,
    from_party: row.fromParty,
    to_party: row.toParty,
    note_invoice: row.noteInvoice,
    amount_total: amountText(row.amountTotal),
    amount_fee: amountText(row.amountFee),
    amount_net: amountText(row.amountNet),
    funding_source: row.fundingSource,
    destination: row.destination,
    matched_in_quickbooks: row.matchedInQuickbooks ? "true" : "false",
    deposit_id: row.depositId,
  };
}

function dateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "9999-99-99";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

router.get("/outside-deposits", async (req, res): Promise<void> => {
  const template = String(req.query.template ?? "").trim();
  const kind = String(req.query.kind ?? "standard").trim().toLowerCase();
  const matched = String(req.query.matched ?? "false").trim().toLowerCase();
  const start = String(req.query.start ?? "").trim();
  const end = String(req.query.end ?? "").trim();
  if ((start && !ISO_DATE.test(start)) || (end && !ISO_DATE.test(end))) {
    res.status(400).json({ error: "Send start and end as YYYY-MM-DD." });
    return;
  }
  const [knownDeposits, knownTransactions] = await Promise.all([
    db.selectDistinct({ template: outsideDepositsTable.template }).from(outsideDepositsTable),
    db.selectDistinct({ template: outsideDepositTransactionsTable.template }).from(outsideDepositTransactionsTable),
  ]);
  const templates = [...new Set([
    ...Object.keys(OUTSIDE_DEPOSIT_TEMPLATES),
    ...knownDeposits.map(row => row.template),
    ...knownTransactions.map(row => row.template),
  ])].sort();
  const depositIds = String(req.query.depositIds ?? "").split(",").map(id => id.trim()).filter(Boolean);
  if (depositIds.length > 0) {
    const stored = await db.select().from(outsideDepositTransactionsTable).where(and(
      inArray(outsideDepositTransactionsTable.depositId, depositIds),
      eq(outsideDepositTransactionsTable.matchedInQuickbooks, true),
    )).orderBy(outsideDepositTransactionsTable.txnDate, outsideDepositTransactionsTable.transactionId);
    res.json({ templates, rows: stored.map(toResponse) });
    return;
  }
  if (!start && !end) {
    res.json({ templates, rows: [] });
    return;
  }
  const filters = [];
  if (template && template.toLowerCase() !== "all") filters.push(eq(outsideDepositsTable.template, template));
  if (matched === "true" || matched === "false") filters.push(eq(outsideDepositsTable.matchedInQuickbooks, matched === "true"));
  if (start) filters.push(sql`${parsedTxnDate} >= ${start}::date`);
  if (end) filters.push(sql`${parsedTxnDate} <= ${end}::date`);
  const transactionFilters = [];
  if (template && template.toLowerCase() !== "all") transactionFilters.push(eq(outsideDepositTransactionsTable.template, template));
  if (matched === "true" || matched === "false") transactionFilters.push(eq(outsideDepositTransactionsTable.matchedInQuickbooks, matched === "true"));
  if (start) transactionFilters.push(sql`${parsedTxnDate} >= ${start}::date`);
  if (end) transactionFilters.push(sql`${parsedTxnDate} <= ${end}::date`);
  const deposits = kind === "other"
    ? []
    : await db.select().from(outsideDepositsTable).where(and(...filters)).orderBy(sql`${parsedTxnDate} NULLS LAST`, outsideDepositsTable.transactionId);
  const transactions = kind === "standard"
    ? []
    : await db.select().from(outsideDepositTransactionsTable).where(and(...transactionFilters)).orderBy(sql`${parsedTxnDate} NULLS LAST`, outsideDepositTransactionsTable.transactionId);
  const rows = [...deposits.map(toResponse), ...transactions.map(toResponse)]
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || a.transaction_id.localeCompare(b.transaction_id));
  res.json({ templates, rows });
});

function shiftIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function linkedTypes(value: unknown) {
  const list = Array.isArray(value) ? value : [];
  return list.map(item => String((item as { TxnType?: unknown }).TxnType ?? "").toLowerCase());
}

function depositHasPayment(deposit: Record<string, unknown>) {
  if (linkedTypes(deposit.LinkedTxn).includes("payment")) return true;
  const lines = Array.isArray(deposit.Line) ? deposit.Line : [];
  return lines.some(line => linkedTypes((line as { LinkedTxn?: unknown }).LinkedTxn).includes("payment"));
}

router.get("/outside-deposits/unlinked-deposits", async (req, res): Promise<void> => {
  const start = String(req.query.start ?? "").trim();
  const end = String(req.query.end ?? "").trim();
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    res.status(400).json({ error: "Send start and end as YYYY-MM-DD." });
    return;
  }
  const from = shiftIso(start, -4);
  const to = shiftIso(end, 4);
  try {
    const raw: Record<string, unknown>[] = [];
    for (let position = 1; position <= 5000; position += 1000) {
      const query = `SELECT * FROM Deposit WHERE TxnDate >= '${escapeQbString(from)}' AND TxnDate <= '${escapeQbString(to)}' STARTPOSITION ${position} MAXRESULTS 1000`;
      const queryResponse = await queryQuickBooks(query);
      const page = (queryResponse.Deposit as Record<string, unknown>[]) ?? [];
      raw.push(...page);
      if (page.length < 1000) break;
    }
    const deposits = raw.filter(deposit => !depositHasPayment(deposit)).map(deposit => {
      const account = (deposit.DepositToAccountRef as { name?: unknown; value?: unknown }) ?? {};
      const amount = Number(deposit.TotalAmt ?? 0);
      return {
        id: String(deposit.Id ?? ""),
        txnDate: String(deposit.TxnDate ?? ""),
        amount: Number.isFinite(amount) ? amount.toFixed(2) : "",
        accountName: String(account.name ?? ""),
        accountId: String(account.value ?? ""),
        memo: String(deposit.PrivateNote ?? ""),
      };
    }).filter(deposit => deposit.id);
    res.json({ start: from, end: to, deposits });
  } catch (err) {
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks is not connected." });
      return;
    }
    if (err instanceof QbUpstreamError) {
      res.status(502).json({ error: "QuickBooks could not be searched." });
      return;
    }
    res.status(500).json({ error: "Could not search QuickBooks deposits." });
  }
});

function moneyCents(value: unknown) {
  if (value == null || value === "") return null;
  const amount = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function dollars(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const [whole, fraction] = (Math.abs(cents) / 100).toFixed(2).split(".");
  return `${sign}$${Number(whole).toLocaleString("en-US")}.${fraction}`;
}

router.post("/outside-deposits/link", async (req, res): Promise<void> => {
  const links = Array.isArray(req.body?.links) ? req.body.links as Array<{ transactionId?: unknown; depositId?: unknown }> : [];
  const cleaned = links.map(link => ({
    transactionId: String(link.transactionId ?? "").trim(),
    depositId: String(link.depositId ?? "").trim(),
  })).filter(link => link.transactionId && link.depositId);
  if (cleaned.length === 0) {
    res.status(400).json({ error: "Choose a QuickBooks deposit before submitting.\nNothing was saved." });
    return;
  }
  try {
    const transactionIds = [...new Set(cleaned.map(link => link.transactionId))];
    const stored = await db.select({
      transactionId: outsideDepositsTable.transactionId,
      standardTransferId: outsideDepositsTable.standardTransferId,
      amountNet: outsideDepositsTable.amountNet,
      amountTotal: outsideDepositsTable.amountTotal,
    }).from(outsideDepositsTable).where(inArray(outsideDepositsTable.transactionId, transactionIds));
    const byId = new Map(stored.map(row => [row.transactionId, row]));
    const depositIds = [...new Set(cleaned.map(link => link.depositId))];
    const query = `SELECT Id, TotalAmt FROM Deposit WHERE Id IN (${depositIds.map(id => `'${escapeQbString(id)}'`).join(", ")})`;
    const queryResponse = await queryQuickBooks(query);
    const quickbooks = new Map(((queryResponse.Deposit as Record<string, unknown>[]) ?? []).map(deposit => [String(deposit.Id ?? ""), deposit]));
    const problems: string[] = [];
    const ready: Array<{ transactionId: string; depositId: string; standardTransferId: string }> = [];
    for (const link of cleaned) {
      const row = byId.get(link.transactionId);
      const deposit = quickbooks.get(link.depositId);
      if (!row) {
        problems.push(`Transaction ${link.transactionId} is not a saved deposit.`);
        continue;
      }
      if (!deposit) {
        problems.push(`Deposit ${link.depositId} was not found in QuickBooks.`);
        continue;
      }
      const transactionCents = moneyCents(row.amountNet) ?? moneyCents(row.amountTotal);
      const depositCents = moneyCents(deposit.TotalAmt);
      if (transactionCents == null || depositCents == null || Math.abs(transactionCents) !== Math.abs(depositCents)) {
        const transactionText = transactionCents == null ? "blank" : dollars(transactionCents);
        const depositText = depositCents == null ? "blank" : dollars(depositCents);
        problems.push(`Deposit ${link.depositId} does not agree with transaction ${link.transactionId}. The deposit is ${depositText} and the transaction is ${transactionText}.`);
        continue;
      }
      ready.push({ ...link, standardTransferId: row.standardTransferId });
    }
    if (problems.length > 0) {
      res.status(400).json({ error: `${problems.join("\n")}\nNothing was saved.` });
      return;
    }
    let transactions = 0;
    await db.transaction(async tx => {
      for (const link of ready) {
        await tx.update(outsideDepositsTable).set({
          matchedInQuickbooks: true,
          depositId: link.depositId,
        }).where(eq(outsideDepositsTable.transactionId, link.transactionId));
        if (!link.standardTransferId) continue;
        const updated = await tx.update(outsideDepositTransactionsTable).set({
          matchedInQuickbooks: true,
          depositId: link.depositId,
        }).where(eq(outsideDepositTransactionsTable.standardTransferId, link.standardTransferId)).returning({ id: outsideDepositTransactionsTable.id });
        transactions += updated.length;
      }
    });
    res.json({ saved: ready.length, transactions });
  } catch (err) {
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks is not connected.\nNothing was saved." });
      return;
    }
    if (err instanceof QbUpstreamError) {
      res.status(502).json({ error: "QuickBooks could not be checked.\nNothing was saved." });
      return;
    }
    res.status(500).json({ error: "Could not save the deposit links.\nNothing was saved." });
  }
});

function readOnlySelect(input: string) {
  let text = input.trim();
  if (text.endsWith(";")) text = text.slice(0, -1).trim();
  if (!text) throw new Error("Write a SELECT statement.");
  if (text.includes(";")) throw new Error("Send one statement. A semicolon can only end it.");
  if (!/^(select|with)\b/i.test(text)) throw new Error("Start with SELECT.");
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|create|comment|vacuum|call|execute|set|into|merge)\b/i.test(text)) {
    throw new Error("Only a SELECT that reads rows is allowed.");
  }
  return text;
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

router.post("/outside-deposits/query", async (req, res): Promise<void> => {
  let statement = "";
  try {
    statement = readOnlySelect(String(req.body?.sql ?? ""));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "That statement cannot be run." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(`SELECT * FROM (${statement}) AS outside_sql LIMIT 500`);
    await client.query("COMMIT");
    const columns = result.fields.map(field => field.name);
    res.json({
      columns,
      rows: result.rows.map(row => Object.fromEntries(columns.map(name => [name, cellText((row as Record<string, unknown>)[name])]))),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(400).json({ error: err instanceof Error ? err.message : "The statement could not be run." });
  } finally {
    client.release();
  }
});

router.post("/outside-deposits", async (req, res): Promise<void> => {
  const templateName = String(req.body?.template ?? "");
  const spec = OUTSIDE_DEPOSIT_TEMPLATES[templateName];
  const rows = Array.isArray(req.body?.rows) ? req.body.rows as Record<string, unknown>[] : null;
  if (!spec || !rows || rows.length === 0) {
    res.status(400).json({ error: "Send a known template with at least one row." });
    return;
  }
  try {
    const values = rows.map(row => ({
      transactionId: wholeId(String(row.transaction_id ?? "")),
      template: spec.name,
      standardTransferId: wholeId(String(row.standard_transfer_id ?? "")),
      txnDate: String(row.date ?? "").trim(),
      timeUtc: String(row.time_utc ?? "").trim(),
      type: String(row.type ?? "").trim(),
      status: String(row.status ?? "").trim(),
      fromParty: String(row.from_party ?? "").trim(),
      toParty: String(row.to_party ?? "").trim(),
      noteInvoice: String(row.note_invoice ?? "").trim(),
      amountTotal: money(row.amount_total, "amount_total"),
      amountFee: money(row.amount_fee, "amount_fee"),
      amountNet: money(row.amount_net, "amount_net"),
      fundingSource: String(row.funding_source ?? "").trim(),
      destination: String(row.destination ?? "").trim(),
      storedAt: new Date(),
    }));
    if (values.some(row => !row.transactionId)) {
      res.status(400).json({ error: "Every row needs a transaction_id." });
      return;
    }
    const counts = new Map<string, number>();
    for (const row of values) counts.set(row.transactionId, (counts.get(row.transactionId) ?? 0) + 1);
    const repeated = [...counts.entries()].filter(([, count]) => count > 1);
    if (repeated.length > 0) {
      res.status(400).json({ error: `These transaction ids are repeated, so nothing was saved: ${repeated.map(([id, count]) => `${id} (${count} rows)`).join(", ")}.` });
      return;
    }
    const deposits = values.filter(row => row.type === spec.depositType);
    const transactions = values.filter(row => row.type !== spec.depositType).map(row => ({
      ...row,
      standardTransferId: row.standardTransferId || null,
    }));
    const missingTransfer = deposits.find(row => !row.standardTransferId);
    if (missingTransfer) {
      res.status(400).json({ error: `Every ${spec.depositType} needs a standard_transfer_id. Nothing was saved.` });
      return;
    }
    const transferCounts = new Map<string, number>();
    for (const row of deposits) transferCounts.set(row.standardTransferId, (transferCounts.get(row.standardTransferId) ?? 0) + 1);
    const repeatedTransfers = [...transferCounts.entries()].filter(([, count]) => count > 1);
    if (repeatedTransfers.length > 0) {
      res.status(400).json({ error: `These standard transfer ids are repeated, so nothing was saved: ${repeatedTransfers.map(([id]) => id).join(", ")}.` });
      return;
    }
    const saved = await db.transaction(async tx => {
      const ids = values.map(row => row.transactionId);
      const [storedDeposits, storedTransactions] = await Promise.all([
        tx.select({ transactionId: outsideDepositsTable.transactionId }).from(outsideDepositsTable).where(inArray(outsideDepositsTable.transactionId, ids)),
        tx.select({ transactionId: outsideDepositTransactionsTable.transactionId }).from(outsideDepositTransactionsTable).where(inArray(outsideDepositTransactionsTable.transactionId, ids)),
      ]);
      const already = [...storedDeposits, ...storedTransactions].map(row => row.transactionId);
      if (already.length > 0) {
        throw new RejectedUpload(`These transaction ids are already stored, so nothing was saved: ${already.join(", ")}.`);
      }
      if (deposits.length > 0) {
        const transferIds = deposits.map(row => row.standardTransferId);
        const storedTransfers = await tx.select({ standardTransferId: outsideDepositsTable.standardTransferId }).from(outsideDepositsTable).where(inArray(outsideDepositsTable.standardTransferId, transferIds));
        if (storedTransfers.length > 0) {
          throw new RejectedUpload(`These standard transfer ids are already stored, so nothing was saved: ${storedTransfers.map(row => row.standardTransferId).join(", ")}.`);
        }
        await tx.insert(outsideDepositsTable).values(deposits);
      }
      const knownTransfers = new Set(deposits.map(row => row.standardTransferId));
      const needed = [...new Set(transactions.flatMap(row => row.standardTransferId && !knownTransfers.has(row.standardTransferId) ? [row.standardTransferId] : []))];
      if (needed.length > 0) {
        const found = await tx.select({ standardTransferId: outsideDepositsTable.standardTransferId }).from(outsideDepositsTable).where(inArray(outsideDepositsTable.standardTransferId, needed));
        const foundIds = new Set(found.map(row => row.standardTransferId));
        const missing = needed.filter(id => !foundIds.has(id));
        if (missing.length > 0) {
          throw new RejectedUpload(`These rows point at a standard transfer that is not stored, so nothing was saved: ${missing.join(", ")}.`);
        }
      }
      if (transactions.length > 0) await tx.insert(outsideDepositTransactionsTable).values(transactions);
      return { saved: values.length, deposits: deposits.length, transactions: transactions.length };
    });
    res.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the deposit file.";
    res.status(err instanceof RejectedUpload ? 400 : 500).json({ error: message });
  }
});

export default router;
