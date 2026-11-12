import type { ReviewRow } from "@/lib/invoice-chain"

// Account 4 is Undeposited Funds. A payment to any other account skipped that account and was coded straight to a bank.
const UNDEPOSITED_FUNDS = "4"

export type AnalysisStep = 1

export const STEP_ONE_NAME = "Step One"
export const STEP_ONE_DETAIL = "Invoices that have payments but are coded directly to deposits"

export interface ProposedFix {
  paymentId: string
  txnDate: string
  totalAmt: string
  originalAccount: string
  proposedAccount: string
  depositToAccountRef: string
  depositToAccountRefName: string
  lineAmount: string
  linkedTxnId: string
  linkedTxnType: string
}

export function stepOne(rows: ReviewRow[]) {
  return rows.filter(row => row.paymentId && row.depositAccount !== "" && row.depositAccount !== UNDEPOSITED_FUNDS)
}

export function defaultFixMemo(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `Updating direct payment to bank account without deposit ${month}/${now.getFullYear()}`
}

// One proposal per payment. The payment moves to Undeposited Funds, and a new deposit debits the old bank account and credits Undeposited Funds by linking the payment.
export function proposeDirectPaymentFixes(rows: ReviewRow[], accountNames: Map<string, string> = new Map()): ProposedFix[] {
  const seen = new Set<string>()
  const fixes: ProposedFix[] = []
  for (const row of stepOne(rows)) {
    if (seen.has(row.paymentId)) continue
    seen.add(row.paymentId)
    fixes.push({
      paymentId: row.paymentId,
      txnDate: row.paymentTxnDate,
      totalAmt: row.paymentTotal,
      originalAccount: row.depositAccount,
      proposedAccount: UNDEPOSITED_FUNDS,
      depositToAccountRef: row.depositAccount,
      depositToAccountRefName: accountNames.get(row.depositAccount) ?? "",
      lineAmount: row.paymentTotal,
      linkedTxnId: row.paymentId,
      linkedTxnType: "Payment",
    })
  }
  return fixes
}
