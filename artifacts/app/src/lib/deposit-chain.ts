import { loadPayments, storeDocuments, type ReviewRow } from "@/lib/invoice-chain"
import { formatCurrency } from "@/lib/utils"
import { qbList, qbQuery, qbQuote } from "@/lib/qb"

interface Link { id: string; type: string; amount: string }

const emptyInvoice = { id: "", docNumber: "", txnDate: "", linkId: "", linkType: "", customerId: "", customerName: "", total: "" }
const emptyPayment = { paymentId: "", paymentTxnDate: "", paymentTotal: "", depositAccount: "", paymentLinkId: "", paymentLinkType: "" }

function linksOf(txn: Record<string, unknown>, type: string): Link[] {
  const wanted = type.toLowerCase()
  const seen = new Set<string>()
  const out: Link[] = []
  const add = (list: unknown, amount: string) => {
    for (const item of Array.isArray(list) ? list : []) {
      const link = item as { TxnId?: string; TxnType?: string }
      const id = String(link.TxnId ?? "")
      const linkType = String(link.TxnType ?? "")
      if (linkType.toLowerCase() !== wanted || !id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, type: linkType, amount })
    }
  }
  add(txn.LinkedTxn, "")
  for (const line of Array.isArray(txn.Line) ? txn.Line : []) {
    const row = line as { Amount?: number; LinkedTxn?: unknown }
    add(row.LinkedTxn, formatCurrency(Number(row.Amount ?? 0)))
  }
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

export function paymentIdsOfDeposits(deposits: Record<string, unknown>[]) {
  return [...new Set(deposits.flatMap(deposit => linksOf(deposit, "Payment").map(link => link.id)))]
}

export function invoiceIdsOf(payments: Map<string, Record<string, unknown>>) {
  return [...new Set([...payments.values()].flatMap(payment => linksOf(payment, "Invoice").map(link => link.id)))]
}

export async function loadInvoices(ids: string[]) {
  const fetched: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25)
    const query = `SELECT * FROM Invoice WHERE Id IN (${chunk.map(id => `'${qbQuote(id)}'`).join(",")}) MAXRESULTS 1000`
    fetched.push(...qbList<Record<string, unknown>>(await qbQuery(query), "Invoice"))
  }
  return storeDocuments("Invoice", fetched)
}

export async function loadDepositPayments(ids: string[]) {
  return loadPayments(ids)
}

function invoiceFields(invoice: Record<string, unknown> | undefined, paymentId: string): Pick<ReviewRow, "id" | "docNumber" | "txnDate" | "linkId" | "linkType" | "customerId" | "customerName" | "total"> {
  if (!invoice) return emptyInvoice
  const customer = (invoice.CustomerRef as { value?: string; name?: string } | undefined) ?? {}
  const backLink = linksOf(invoice, "Payment").find(link => link.id === paymentId) ?? linksOf(invoice, "Payment")[0]
  return {
    id: String(invoice.Id ?? ""),
    docNumber: String(invoice.DocNumber ?? ""),
    txnDate: String(invoice.TxnDate ?? ""),
    linkId: backLink?.id ?? paymentId,
    linkType: backLink?.type ?? (paymentId ? "Payment" : ""),
    customerId: String(customer.value ?? ""),
    customerName: String(customer.name ?? ""),
    total: formatCurrency(Number(invoice.TotalAmt ?? 0)),
  }
}

function paymentFields(payment: Record<string, unknown> | undefined): Pick<ReviewRow, "paymentId" | "paymentTxnDate" | "paymentTotal" | "depositAccount" | "paymentLinkId" | "paymentLinkType"> {
  if (!payment) return emptyPayment
  const credit = creditMemoLine(payment)
  const paymentLink = credit ?? firstLinkedTxn(payment)
  return {
    paymentId: String(payment.Id ?? ""),
    paymentTxnDate: String(payment.TxnDate ?? ""),
    paymentTotal: formatCurrency(credit ? credit.amount : Number(payment.TotalAmt ?? 0)),
    depositAccount: String((payment.DepositToAccountRef as { value?: string } | undefined)?.value ?? ""),
    paymentLinkId: paymentLink.id,
    paymentLinkType: paymentLink.type,
  }
}

export function reviewDepositRows(deposits: Record<string, unknown>[], payments: Map<string, Record<string, unknown>>, invoices: Map<string, Record<string, unknown>>, customerId = "", cleared: Map<string, string> = new Map()): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (const deposit of deposits) {
    const account = deposit.DepositToAccountRef as { value?: string; name?: string } | undefined
    const depositBase = {
      depositId: String(deposit.Id ?? ""),
      depositTxnDate: String(deposit.TxnDate ?? ""),
      depositTotal: formatCurrency(Number(deposit.TotalAmt ?? 0)),
      depositToAccountRefValue: String(account?.value ?? ""),
      depositToAccountRefName: String(account?.name ?? ""),
      depositCleared: cleared.get(String(deposit.Id ?? "")) ?? "",
    }
    const paymentLinks = linksOf(deposit, "Payment")
    const lines = paymentLinks.length > 0 ? paymentLinks : [{ id: "", type: "", amount: "" }]
    for (const line of lines) {
      const payment = line.id ? payments.get(line.id) : undefined
      const paymentBase = paymentFields(payment)
      const invoiceLinks = payment ? linksOf(payment, "Invoice") : []
      const linked = invoiceLinks.length > 0 ? invoiceLinks : [{ id: "", type: "", amount: "" }]
      for (const invoiceLink of linked) {
        const invoice = invoiceLink.id ? invoices.get(invoiceLink.id) : undefined
        const invoiceBase = invoiceFields(invoice, line.id)
        if (customerId && invoiceBase.customerId !== customerId && String((payment?.CustomerRef as { value?: string } | undefined)?.value ?? "") !== customerId) continue
        rows.push({
          ...invoiceBase,
          ...paymentBase,
          ...depositBase,
          depositLineAmount: line.amount,
          depositLineLinkedTxnId: line.id,
          depositLineLinkedTxnType: line.type,
        })
      }
    }
  }
  return rows
}
