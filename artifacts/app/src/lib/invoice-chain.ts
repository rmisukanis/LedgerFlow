import { formatCurrency } from "@/lib/utils"
import { qbList, qbQuery, qbQuote } from "@/lib/qb"

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

const emptyPayment = { paymentId: "", paymentTxnDate: "", paymentTotal: "", depositAccount: "", paymentLinkId: "", paymentLinkType: "" }

export function paymentIdsOf(invoices: Record<string, unknown>[]) {
  return [...new Set(invoices.flatMap(invoice => linksOf(invoice).filter(link => isPayment(link.type) && link.id).map(link => link.id)))]
}

export async function loadPayments(ids: string[]) {
  const found = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25)
    const query = `SELECT * FROM Payment WHERE Id IN (${chunk.map(id => `'${qbQuote(id)}'`).join(",")}) MAXRESULTS 1000`
    const list = qbList<Record<string, unknown>>(await qbQuery(query), "Payment")
    for (const payment of list) found.set(String(payment.Id ?? ""), payment)
  }
  return found
}

export function reviewRows(invoices: Record<string, unknown>[], payments: Map<string, Record<string, unknown>>): ReviewRow[] {
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
      })
    }
  }
  return rows
}
