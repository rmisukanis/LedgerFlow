import { Router, type IRouter } from "express";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { bankingFeedLinesTable, db } from "@workspace/db";
import { escapeQbString, queryQuickBooks, QbNotConnectedError, QbUpstreamError } from "../lib/qb-client";

const router: IRouter = Router();
const UNDEPOSITED_FUNDS = "4";
const DAY = 4;

type FeedRow = typeof bankingFeedLinesTable.$inferSelect;

interface Candidate {
  entity: "Deposit" | "Purchase" | "Payment" | "Bill"
  id: string
  date: string
  name: string
  amountCents: number
}

function cents(value: unknown) {
  const amount = Number(value ?? Number.NaN);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

function isoDate(value: string) {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function dayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function closeEnough(left: string, right: string) {
  if (!left || !right) return false;
  return Math.abs(dayNumber(left) - dayNumber(right)) <= DAY;
}

function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function lineKey(bankAccountId: string, date: string, description: string, amountCents: number) {
  return `${bankAccountId}|${date}|${description.trim().toLowerCase()}|${amountCents}`;
}

function refName(value: unknown) {
  const ref = value as { name?: string } | undefined;
  return String(ref?.name ?? "");
}

function toResponse(row: FeedRow) {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    bankAccountName: row.bankAccountName,
    date: row.txnDate,
    description: row.description,
    amount: row.amount,
    status: row.status,
    action: row.action,
    qbEntity: row.qbEntity,
    qbId: row.qbId,
    reason: row.reason,
  };
}

function listOf(body: Record<string, unknown>, name: string) {
  const rows = body[name];
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
}

async function loadCandidates(bankAccountId: string, start: string, end: string) {
  const [deposits, purchases, payments, bills] = await Promise.all([
    qbList(`SELECT Id, TxnDate, TotalAmt, DepositToAccountRef FROM Deposit WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 1000`, "Deposit"),
    qbList(`SELECT Id, TxnDate, TotalAmt, AccountRef, EntityRef FROM Purchase WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 1000`, "Purchase"),
    qbList(`SELECT Id, TxnDate, TotalAmt, DepositToAccountRef, CustomerRef FROM Payment WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' MAXRESULTS 1000`, "Payment"),
    qbList(`SELECT Id, TxnDate, Balance, VendorRef FROM Bill WHERE TxnDate >= '${start}' AND TxnDate <= '${end}' AND Balance > '0' MAXRESULTS 1000`, "Bill"),
  ]);
  return [
    ...deposits.filter(row => String((row.DepositToAccountRef as { value?: string } | undefined)?.value ?? "") === bankAccountId).map(row => ({ entity: "Deposit" as const, id: String(row.Id ?? ""), date: String(row.TxnDate ?? ""), name: "", amountCents: cents(row.TotalAmt) })),
    ...purchases.filter(row => String((row.AccountRef as { value?: string } | undefined)?.value ?? "") === bankAccountId).map(row => ({ entity: "Purchase" as const, id: String(row.Id ?? ""), date: String(row.TxnDate ?? ""), name: refName(row.EntityRef), amountCents: Math.abs(cents(row.TotalAmt)) })),
    ...payments.filter(row => String((row.DepositToAccountRef as { value?: string } | undefined)?.value ?? "") === UNDEPOSITED_FUNDS).map(row => ({ entity: "Payment" as const, id: String(row.Id ?? ""), date: String(row.TxnDate ?? ""), name: refName(row.CustomerRef), amountCents: cents(row.TotalAmt) })),
    ...bills.map(row => ({ entity: "Bill" as const, id: String(row.Id ?? ""), date: String(row.TxnDate ?? ""), name: refName(row.VendorRef), amountCents: cents(row.Balance) })),
  ].filter(item => item.id && item.date && Number.isFinite(item.amountCents));
}

function optionsFor(line: FeedRow, candidates: Candidate[]) {
  const amount = Math.abs(cents(line.amount));
  const moneyIn = cents(line.amount) > 0;
  const description = line.description.toLowerCase();
  return candidates.filter(item => {
    if (moneyIn ? item.entity !== "Deposit" && item.entity !== "Payment" : item.entity !== "Purchase" && item.entity !== "Bill") return false;
    if (Math.abs(dayNumber(line.txnDate) - dayNumber(item.date)) > 14) return false;
    const exact = item.amountCents === amount;
    const close = Math.abs(item.amountCents - amount) <= Math.max(100, Math.round(amount * 0.05));
    const named = item.name.length >= 4 && description.includes(item.name.toLowerCase());
    return exact || close || named;
  }).slice(0, 20);
}

function actionFor(entity: string) {
  if (entity === "Deposit" || entity === "Purchase") return "already_on_register";
  if (entity === "Payment") return "link_payment";
  if (entity === "Bill") return "bill_payment";
  return "";
}

function grokError(body: Record<string, unknown>) {
  const error = body.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && typeof (error as { message?: string }).message === "string") return (error as { message: string }).message;
  return "Grok did not answer.";
}

async function grokModel(base: string, key: string) {
  const chosen = process.env.GROK_MODEL?.trim();
  if (chosen) return chosen;
  const response = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
  const body = await response.json() as { data?: { id?: string }[] };
  const ids = (body.data ?? []).map(item => String(item.id ?? "")).filter(id => id.startsWith("grok-") && !/image|video|voice/i.test(id));
  if (!response.ok || !ids[0]) throw new Error("This Grok key has no chat model. Set GROK_MODEL in .env.");
  return ids[0];
}

function responseText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const content = (item as { content?: { text?: string }[] }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) if (part?.text) parts.push(part.text);
  }
  if (parts.length > 0) return parts.join("\n");
  const choices = body.choices as { message?: { content?: string } }[] | undefined;
  return choices?.[0]?.message?.content ?? "";
}

async function qbList(query: string, name: string) {
  const body = await queryQuickBooks(query);
  return listOf(body, name);
}

function decide(lines: FeedRow[], candidates: Candidate[]) {
  const decisions = new Map<number, { status: string; action: string; qbEntity: string; qbId: string; reason: string }>();
  const used = new Map<string, number>();
  for (const line of lines) {
    const amount = cents(line.amount);
    const moneyIn = amount > 0;
    const hits = candidates.filter(item => closeEnough(line.txnDate, item.date) && item.amountCents === Math.abs(amount) && (moneyIn ? item.entity === "Deposit" || item.entity === "Payment" : item.entity === "Purchase" || item.entity === "Bill"));
    const register = hits.filter(item => item.entity === "Deposit" || item.entity === "Purchase");
    const open = hits.filter(item => item.entity === "Payment" || item.entity === "Bill");
    const pool = register.length > 0 ? register : open;
    if (pool.length === 0) {
      decisions.set(line.id, { status: "needs_review", action: "", qbEntity: "", qbId: "", reason: "No QuickBooks record has this amount within 4 days." });
      continue;
    }
    if (pool.length > 1) {
      const names = pool.map(item => `${item.entity} ${item.id}`).join(", ");
      decisions.set(line.id, { status: "needs_review", action: "", qbEntity: "", qbId: "", reason: `More than one record fits: ${names}.` });
      continue;
    }
    const chosen = pool[0];
    const key = `${chosen.entity}:${chosen.id}`;
    const other = used.get(key);
    if (other != null) {
      const shared = `${chosen.entity} ${chosen.id} also fits another bank line.`;
      decisions.set(line.id, { status: "needs_review", action: "", qbEntity: "", qbId: "", reason: shared });
      decisions.set(other, { status: "needs_review", action: "", qbEntity: "", qbId: "", reason: shared });
      continue;
    }
    used.set(key, line.id);
    const onRegister = chosen.entity === "Deposit" || chosen.entity === "Purchase";
    decisions.set(line.id, {
      status: "matched",
      action: onRegister ? "already_on_register" : chosen.entity === "Payment" ? "link_payment" : "bill_payment",
      qbEntity: chosen.entity,
      qbId: chosen.id,
      reason: onRegister
        ? `${chosen.entity} ${chosen.id} is already on this bank account${chosen.name ? ` for ${chosen.name}` : ""}.`
        : chosen.entity === "Payment"
          ? `Payment ${chosen.id} is in Undeposited Funds${chosen.name ? ` for ${chosen.name}` : ""}.`
          : `Bill ${chosen.id} is still open${chosen.name ? ` for ${chosen.name}` : ""}.`,
    });
  }
  return decisions;
}

router.get("/banking-feed", async (req, res): Promise<void> => {
  const bankAccountId = String(req.query.bankAccountId ?? "").trim();
  const start = String(req.query.start ?? "").trim();
  const end = String(req.query.end ?? "").trim();
  if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end))) {
    res.status(400).json({ error: "Send start and end as YYYY-MM-DD." });
    return;
  }
  const filters = [];
  if (bankAccountId) filters.push(eq(bankingFeedLinesTable.bankAccountId, bankAccountId));
  if (start) filters.push(gte(bankingFeedLinesTable.txnDate, start));
  if (end) filters.push(lte(bankingFeedLinesTable.txnDate, end));
  const rows = await db.select().from(bankingFeedLinesTable).where(filters.length ? and(...filters) : undefined).orderBy(bankingFeedLinesTable.txnDate, bankingFeedLinesTable.id);
  res.json({ rows: rows.map(toResponse) });
});

router.post("/banking-feed", async (req, res): Promise<void> => {
  const bankAccountId = String(req.body?.bankAccountId ?? "").trim();
  const bankAccountName = String(req.body?.bankAccountName ?? "").trim();
  const incoming = Array.isArray(req.body?.rows) ? req.body.rows as Record<string, unknown>[] : null;
  if (!bankAccountId || !incoming || incoming.length === 0) {
    res.status(400).json({ error: "Choose a bank account and at least one statement line." });
    return;
  }
  const prepared = [];
  const seen = new Set<string>();
  for (const [index, row] of incoming.entries()) {
    const date = isoDate(String(row.date ?? ""));
    const description = String(row.description ?? "").trim();
    const amount = cents(row.amount);
    if (!date || !description || !Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ error: `Row ${index + 1} needs a date, a description, and a non-zero amount. Nothing was saved.` });
      return;
    }
    const key = lineKey(bankAccountId, date, description, amount);
    if (seen.has(key)) {
      res.status(400).json({ error: `Row ${index + 1} repeats ${description} on ${date}. Nothing was saved.` });
      return;
    }
    seen.add(key);
    prepared.push({ bankAccountId, bankAccountName, txnDate: date, description, amount: (amount / 100).toFixed(2), lineKey: key });
  }
  const existing = await db.select({ lineKey: bankingFeedLinesTable.lineKey }).from(bankingFeedLinesTable).where(inArray(bankingFeedLinesTable.lineKey, prepared.map(row => row.lineKey)));
  if (existing.length > 0) {
    res.status(400).json({ error: "A line in this file is already saved for this bank account. Nothing was saved." });
    return;
  }
  const saved = await db.insert(bankingFeedLinesTable).values(prepared).returning();
  res.json({ rows: saved.map(toResponse) });
});

router.post("/banking-feed/match", async (req, res): Promise<void> => {
  const bankAccountId = String(req.body?.bankAccountId ?? "").trim();
  if (!bankAccountId) {
    res.status(400).json({ error: "Choose a bank account." });
    return;
  }
  const lines = await db.select().from(bankingFeedLinesTable).where(and(
    eq(bankingFeedLinesTable.bankAccountId, bankAccountId),
    inArray(bankingFeedLinesTable.status, ["unmatched", "needs_review", "matched"]),
  ));
  if (lines.length === 0) {
    res.json({ rows: [] });
    return;
  }
  const dates = lines.map(line => line.txnDate).sort();
  const start = shiftDate(dates[0], -DAY);
  const end = shiftDate(dates[dates.length - 1], DAY);
  const account = escapeQbString(bankAccountId);
  try {
    const candidates = await loadCandidates(bankAccountId, start, end);
    const decisions = decide(lines, candidates);
    for (const line of lines) {
      const next = decisions.get(line.id);
      if (!next) continue;
      await db.update(bankingFeedLinesTable).set(next).where(eq(bankingFeedLinesTable.id, line.id));
    }
    const rows = await db.select().from(bankingFeedLinesTable).where(eq(bankingFeedLinesTable.bankAccountId, bankAccountId)).orderBy(bankingFeedLinesTable.txnDate, bankingFeedLinesTable.id);
    res.json({ rows: rows.map(toResponse), start, end, account });
  } catch (err) {
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks is not connected" });
      return;
    }
    const message = err instanceof QbUpstreamError ? err.message : err instanceof Error ? err.message : "QuickBooks could not be searched.";
    res.status(502).json({ error: message });
  }
});

router.post("/banking-feed/review", async (req, res): Promise<void> => {
  const bankAccountId = String(req.body?.bankAccountId ?? "").trim();
  const key = process.env.GROK_API_KEY?.trim() ?? "";
  if (!key) {
    res.status(400).json({ error: "Add GROK_API_KEY to the .env file, then restart the API." });
    return;
  }
  if (!bankAccountId) {
    res.status(400).json({ error: "Choose a bank account." });
    return;
  }
  const lines = await db.select().from(bankingFeedLinesTable).where(and(
    eq(bankingFeedLinesTable.bankAccountId, bankAccountId),
    eq(bankingFeedLinesTable.status, "needs_review"),
  ));
  if (lines.length === 0) {
    res.json({ rows: [], identified: 0, still: 0 });
    return;
  }
  const dates = lines.map(line => line.txnDate).sort();
  const start = shiftDate(dates[0], -14);
  const end = shiftDate(dates[dates.length - 1], 14);
  try {
    const candidates = await loadCandidates(bankAccountId, start, end);
    const packets = lines.map(line => ({
      id: line.id,
      date: line.txnDate,
      description: line.description,
      amount: line.amount,
      flag: line.reason,
      candidates: optionsFor(line, candidates).map(item => ({ entity: item.entity, id: item.id, date: item.date, name: item.name, amount: (item.amountCents / 100).toFixed(2) })),
    }));
    const base = (process.env.GROK_BASE_URL?.trim() || "https://api.x.ai/v1").replace(/\/$/, "");
    const model = await grokModel(base, key);
    const response = await fetch(`${base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: "You match bank statement lines to QuickBooks records. Reply with JSON only: {\"picks\":[{\"id\":number,\"entity\":\"Deposit\"|\"Purchase\"|\"Payment\"|\"Bill\"|\"\",\"qbId\":\"\",\"confidence\":\"high\"|\"low\",\"note\":\"\"}]}. Choose a record only from that line's candidates. Use high only when the description and amount are the same money. Otherwise leave entity and qbId blank." },
          { role: "user", content: JSON.stringify({ lines: packets }) },
        ],
      }),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const message = grokError(body);
      res.status(502).json({ error: message });
      return;
    }
    const raw = responseText(body).replace(/```json|```/g, "").trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    const parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : "{}") as { picks?: { id?: number; entity?: string; qbId?: string; confidence?: string; note?: string }[] };
    const picks = new Map((parsed.picks ?? []).map(pick => [Number(pick.id), pick]));
    const claimed = new Set<string>();
    let identified = 0;
    for (const line of lines) {
      const pick = picks.get(line.id);
      const note = String(pick?.note ?? "").trim();
      const entity = String(pick?.entity ?? "");
      const qbId = String(pick?.qbId ?? "");
      const allowed = optionsFor(line, candidates).find(item => item.entity === entity && item.id === qbId);
      const claim = `${entity}:${qbId}`;
      if (allowed && pick?.confidence === "high" && !claimed.has(claim)) {
        claimed.add(claim);
        identified += 1;
        await db.update(bankingFeedLinesTable).set({
          status: "matched",
          action: actionFor(entity),
          qbEntity: entity,
          qbId,
          reason: note ? `Grok: ${note}` : `Grok matched ${entity} ${qbId}.`,
        }).where(eq(bankingFeedLinesTable.id, line.id));
        continue;
      }
      if (note) await db.update(bankingFeedLinesTable).set({ reason: `Grok: ${note}` }).where(eq(bankingFeedLinesTable.id, line.id));
    }
    const rows = await db.select().from(bankingFeedLinesTable).where(eq(bankingFeedLinesTable.bankAccountId, bankAccountId)).orderBy(bankingFeedLinesTable.txnDate, bankingFeedLinesTable.id);
    res.json({ rows: rows.map(toResponse), identified, still: lines.length - identified });
  } catch (err) {
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks is not connected" });
      return;
    }
    const message = err instanceof QbUpstreamError ? err.message : err instanceof Error ? err.message : "Grok did not answer.";
    res.status(502).json({ error: message });
  }
});

router.post("/banking-feed/delete", async (req, res): Promise<void> => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id)) : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "Select at least one line to delete." });
    return;
  }
  const removed = await db.delete(bankingFeedLinesTable).where(inArray(bankingFeedLinesTable.id, ids)).returning({ id: bankingFeedLinesTable.id });
  res.json({ deleted: removed.map(row => row.id) });
});

router.post("/banking-feed/status", async (req, res): Promise<void> => {
  const id = Number(req.body?.id);
  const status = String(req.body?.status ?? "");
  if (!Number.isInteger(id) || (status !== "accepted" && status !== "excluded")) {
    res.status(400).json({ error: "Send a line id and accepted or excluded." });
    return;
  }
  const [row] = await db.select().from(bankingFeedLinesTable).where(eq(bankingFeedLinesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "That line is not saved." });
    return;
  }
  if (status === "accepted" && row.status !== "matched") {
    res.status(400).json({ error: "Accept is only for a line with one matching QuickBooks record. Nothing was posted." });
    return;
  }
  const [saved] = await db.update(bankingFeedLinesTable).set({ status }).where(eq(bankingFeedLinesTable.id, id)).returning();
  res.json({ row: toResponse(saved) });
});

export default router;
