import { formatCurrency } from "@/lib/utils"
import { qbList, qbQuery, qbQuote, qbReport } from "@/lib/qb"

const DOCUMENTS = `${import.meta.env.BASE_URL}api/qb/documents`

export async function storeDocuments(entity: "Invoice" | "Payment" | "Deposit", records: Record<string, unknown>[]) {
  const list = records.filter(record => String(record.Id ?? ""))
  if (list.length === 0) return new Map<string, Record<string, unknown>>()
  const save = await fetch(DOCUMENTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, records: list }),
  })
  const saved = await save.json()
  if (!save.ok) throw new Error(saved.error ?? "Could not store the QuickBooks records")
  const read = await fetch(`${DOCUMENTS}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, ids: list.map(record => String(record.Id)) }),
  })
  const stored = await read.json()
  if (!read.ok) throw new Error(stored.error ?? "Could not read the stored QuickBooks records")
  const found = new Map<string, Record<string, unknown>>()
  for (const record of (stored.records ?? []) as Record<string, unknown>[]) found.set(String(record.Id ?? ""), record)
  return found
}

export interface ReviewRow {
  id: string
  docNumber: string
  txnDate: string
  linkId: string
  linkType: string
  customerId: string
  customerName: string
  total: string
  paymentId: string
  paymentTxnDate: string
  paymentTotal: string
  depositAccount: string
  paymentLinkId: string
  paymentLinkType: string
  depositId: string
  depositTxnDate: string
  depositTotal: string
  depositToAccountRefValue: string
  depositToAccountRefName: string
  depositLineAmount: string
  depositLineLinkedTxnId: string
  depositLineLinkedTxnType: string
  depositCleared: string
}

interface Link { id: string; type: string }

export const isPayment = (type: string) => type.toLowerCase() === "payment"

function linksOf(txn: Record<string, unknown>): Link[] {
  const seen = new Set<string>()
  const out: Link[] = []
  const add = (list: unknown) => {
    for (const item of Array.isArray(list) ? list : []) {
      const link = item as { TxnId?: string; TxnType?: string }
      const id = String(link.TxnId ?? "")
      const type = String(link.TxnType ?? "")
      const key = `${type}:${id}`
      if (!id && !type) continue
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ id, type })
    }
  }
  add(txn.LinkedTxn)
  for (const line of Array.isArray(txn.Line) ? txn.Line : []) add((line as { LinkedTxn?: unknown }).LinkedTxn)
  return out
}

function creditMemoLine(payment: Record<string, unknown>) {
  for (const line of Array.isArray(payment.Line) ? payment.Line : []) {
    const row = line as { Amount?: number; LinkedTxn?: { TxnId?: string; TxnType?: string }[] }
    const link = (Array.isArray(row.LinkedTxn) ? row.LinkedTxn : []).find(item => String(item.TxnType ?? "").toLowerCase() === "creditmemo")
    if (!link) continue
    return { amount: Number(row.Amount ?? 0), id: String(link.TxnId ?? ""), type: String(link.TxnType ?? "CreditMemo") }
  }
  return null
}

function firstLinkedTxn(txn: Record<string, unknown>) {
  const list = Array.isArray(txn.LinkedTxn) ? txn.LinkedTxn : []
  const link = (list[0] ?? {}) as { TxnId?: string; TxnType?: string }
  return { id: String(link.TxnId ?? ""), type: String(link.TxnType ?? "") }
}

const emptyPayment = { paymentId: "", paymentTxnDate: "", paymentTotal: "", depositAccount: "", paymentLinkId: ""
  , paymentLinkType: "", depositId: "", depositTxnDate: "", depositTotal: "", depositToAccountRefValue: ""
  , depositToAccountRefName: "", depositLineAmount: "", depositLineLinkedTxnId: "", depositLineLinkedTxnType: "", depositCleared: "" }

export function paymentIdsOf(invoices: Record<string, unknown>[]) {
  return [...new Set(invoices.flatMap(invoice => linksOf(invoice).filter(link => isPayment(link.type) && link.id).map(link => link.id)))]
}

export async function loadPayments(ids: string[]) {
  const fetched: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25)
    const query = `SELECT * FROM Payment WHERE Id IN (${chunk.map(id => `'${qbQuote(id)}'`).join(",")}) MAXRESULTS 1000`
    fetched.push(...qbList<Record<string, unknown>>(await qbQuery(query), "Payment"))
  }
  return storeDocuments("Payment", fetched)
}

export function depositIdsOf(payments: Map<string, Record<string, unknown>>) {
  const ids: string[] = []
  for (const payment of payments.values()) {
    const link = creditMemoLine(payment) ?? firstLinkedTxn(payment)
    if (link.type.toLowerCase() === "deposit" && link.id) ids.push(link.id)
  }
  return [...new Set(ids)]
}

export async function loadDeposits(ids: string[]) {
  const fetched: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25)
    const query = `SELECT * FROM Deposit WHERE Id IN (${chunk.map(id => `'${qbQuote(id)}'`).join(",")}) MAXRESULTS 1000`
    fetched.push(...qbList<Record<string, unknown>>(await qbQuery(query), "Deposit"))
  }
  return storeDocuments("Deposit", fetched)
}

type ReportCol = { value?: string; id?: string }
type ReportRow = { ColData?: ReportCol[]; Rows?: { Row?: ReportRow[] } }

// Clr comes from the General Ledger, not the Deposit record. The txn id sits on the Transaction Type cell.
export async function loadDepositCleared(deposits: Iterable<Record<string, unknown>>) {
  const byAccount = new Map<string, { start: string; end: string }>()
  for (const deposit of deposits) {
    const account = String((deposit.DepositToAccountRef as { value?: string } | undefined)?.value ?? "")
    const date = String(deposit.TxnDate ?? "")
    if (!account || !date) continue
    const span = byAccount.get(account)
    if (!span) byAccount.set(account, { start: date, end: date })
    else {
      if (date < span.start) span.start = date
      if (date > span.end) span.end = date
    }
  }
  const cleared = new Map<string, string>()
  for (const [account, span] of byAccount) {
    const data = await qbReport("/reports/GeneralLedger", {
      account,
      start_date: span.start,
      end_date: span.end,
      columns: "txn_type,is_cleared",
      accounting_method: "Accrual",
    })
    const columns = ((data.Columns as { Column?: { MetaData?: { Name: string; Value: string }[] }[] } | undefined)?.Column ?? [])
    const keyAt = (key: string) => columns.findIndex(column => column.MetaData?.some(meta => meta.Name === "ColKey" && meta.Value === key))
    const typeAt = keyAt("txn_type")
    const clearedAt = keyAt("is_cleared")
    const walk = (rows: ReportRow[] | undefined) => {
      for (const row of rows ?? []) {
        const type = typeAt >= 0 ? row.ColData?.[typeAt] : undefined
        if (type?.id && String(type.value ?? "").toLowerCase() === "deposit") cleared.set(String(type.id), String(row.ColData?.[clearedAt]?.value ?? ""))
        walk(row.Rows?.Row)
      }
    }
    walk((data.Rows as { Row?: ReportRow[] } | undefined)?.Row)
  }
  return cleared
}

export function reviewRows(invoices: Record<string, unknown>[], payments: Map<string, Record<string, unknown>>, deposits: Map<string, Record<string, unknown>>, cleared: Map<string, string> = new Map()): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (const invoice of invoices) {
    const customer = (invoice.CustomerRef as { value?: string; name?: string } | undefined) ?? {}
    const base = {
      id: String(invoice.Id ?? ""),
      docNumber: String(invoice.DocNumber ?? ""),
      txnDate: String(invoice.TxnDate ?? ""),
      customerId: String(customer.value ?? ""),
      customerName: String(customer.name ?? ""),
      total: formatCurrency(Number(invoice.TotalAmt ?? 0)),
    }
    const links = linksOf(invoice)
    const invoiceLinks = links.length === 0 ? [{ id: "", type: "" }] : links
    for (const link of invoiceLinks) {
      const payment = isPayment(link.type) ? payments.get(link.id) : undefined
      if (!payment) {
        rows.push({ ...base, linkId: link.id, linkType: link.type, ...emptyPayment })
        continue
      }
      const credit = creditMemoLine(payment)
      const paymentLink = credit ?? firstLinkedTxn(payment)
      const deposit = paymentLink.type.toLowerCase() === "deposit" ? deposits.get(paymentLink.id) : undefined
      const depositAccountRef = deposit?.DepositToAccountRef as { value?: string; name?: string } | undefined
      const depositLine = (deposit?.Line as { Amount?: number; LinkedTxn?: { TxnId?: string; TxnType?: string }[] }[] | undefined)?.[0]
      const depositLineLink = depositLine?.LinkedTxn?.[0]
      rows.push({
        ...base,
        linkId: link.id,
        linkType: link.type,
        paymentId: String(payment.Id ?? ""),
        paymentTxnDate: String(payment.TxnDate ?? ""),
        paymentTotal: formatCurrency(credit ? credit.amount : Number(payment.TotalAmt ?? 0)),
        depositAccount: String((payment.DepositToAccountRef as { value?: string } | undefined)?.value ?? ""),
        paymentLinkId: paymentLink.id,
        paymentLinkType: paymentLink.type,
        depositId: String(deposit?.Id ?? ""),
        depositTxnDate: String(deposit?.TxnDate ?? ""),
        depositTotal: deposit ? formatCurrency(Number(deposit.TotalAmt ?? 0)) : "",
        depositToAccountRefValue: String(depositAccountRef?.value ?? ""),
        depositToAccountRefName: String(depositAccountRef?.name ?? ""),
        depositLineAmount: depositLine ? formatCurrency(Number(depositLine.Amount ?? 0)) : "",
        depositLineLinkedTxnId: String(depositLineLink?.TxnId ?? ""),
        depositLineLinkedTxnType: String(depositLineLink?.TxnType ?? ""),
        depositCleared: deposit ? (cleared.get(String(deposit.Id ?? "")) ?? "") : "",
      })
    }
  }
  return rows
}
