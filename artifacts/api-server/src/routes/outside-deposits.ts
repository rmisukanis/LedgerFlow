import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, outsideDepositsTable } from "@workspace/db";

const router: IRouter = Router();
const TEMPLATES = new Set(["Venmo"]);

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

router.post("/outside-deposits", async (req, res): Promise<void> => {
  const template = String(req.body?.template ?? "");
  const rows = Array.isArray(req.body?.rows) ? req.body.rows as Record<string, unknown>[] : null;
  if (!TEMPLATES.has(template) || !rows || rows.length === 0) {
    res.status(400).json({ error: "Send a Venmo file with at least one row." });
    return;
  }
  try {
    const values = rows.map(row => ({
      transactionId: wholeId(String(row.transaction_id ?? "")),
      template,
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
    const missing = values.find(row => !row.transactionId);
    if (missing) {
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
    await db.insert(outsideDepositsTable).values(values).onConflictDoUpdate({
      target: outsideDepositsTable.transactionId,
      set: {
        template: sql`excluded.template`,
        standardTransferId: sql`excluded.standard_transfer_id`,
        txnDate: sql`excluded.txn_date`,
        timeUtc: sql`excluded.time_utc`,
        type: sql`excluded.type`,
        status: sql`excluded.status`,
        fromParty: sql`excluded.from_party`,
        toParty: sql`excluded.to_party`,
        noteInvoice: sql`excluded.note_invoice`,
        amountTotal: sql`excluded.amount_total`,
        amountFee: sql`excluded.amount_fee`,
        amountNet: sql`excluded.amount_net`,
        fundingSource: sql`excluded.funding_source`,
        destination: sql`excluded.destination`,
        storedAt: sql`now()`,
      },
    });
    res.json({ saved: values.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not save the deposit file." });
  }
});

export default router;
