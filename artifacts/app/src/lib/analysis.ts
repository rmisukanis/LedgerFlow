import type { ReviewRow } from "@/lib/invoice-chain"
import { formatCurrency } from "@/lib/utils"

// Account 4 is Undeposited Funds. A payment to any other account skipped that account and was coded straight to a bank.
const UNDEPOSITED_FUNDS = "4"

export type AnalysisStep = 1 | 2

export const STEP_ONE_NAME = "Step One"
export const STEP_ONE_DETAIL = "Invoices that have payments but are coded directly to deposits"
export const STEP_TWO_NAME = "Step Two"
export const STEP_TWO_DETAIL = "Undeposited funds without a connected deposit"

export const BANK_CHARGES_ACCOUNT = "8"

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
  depositId: string
  depositTotal: string
  feeAmount: string
  feeError: string
}

export interface UndepositedPayment {
  paymentId: string
  txnDate: string
  total: number
  customerId: string
  customerName: string
  depositAccount: string
}

export interface UnlinkedDeposit {
  id: string
  txnDate: string
  total: number
  accountId: string
  accountName: string
  customerIds: string[]
  customerNames: string[]
  lineAmounts: number[]
  lineAmount: string
}

export interface DepositSuggestion {
  deposit: UnlinkedDeposit
  payment: UndepositedPayment | null
  reason: string
  likelihood: number | null
}

export function stepOne(rows: ReviewRow[]) {
  return rows.filter(row => row.paymentId && row.depositAccount !== "" && row.depositAccount !== UNDEPOSITED_FUNDS)
}

export function defaultFixMemo(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `Updating direct payment to bank account without deposit ${month}/${now.getFullYear()}`
}

export function stepTwoMemo(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `Connecting undeposited funds to bank deposits without a payment ${month}/${now.getFullYear()}`
}

function money(value: string) {
  const amount = Number(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : Number.NaN
}

function amountKey(date: string, total: number) {
  return `${date}|${total.toFixed(2)}`
}

function isUndepositedWithoutDeposit(row: ReviewRow) {
  const link = row.paymentLinkType.replace(/\s/g, "").toLowerCase()
  return Boolean(row.paymentId) && row.depositAccount === UNDEPOSITED_FUNDS && !row.depositId && link !== "deposit" && link !== "creditmemo"
}

export function undepositedPayments(rows: ReviewRow[]): UndepositedPayment[] {
  const seen = new Set<string>()
  const payments: UndepositedPayment[] = []
  for (const row of rows) {
    if (!isUndepositedWithoutDeposit(row) || seen.has(row.paymentId)) continue
    seen.add(row.paymentId)
    payments.push({ paymentId: row.paymentId, txnDate: row.paymentTxnDate, total: money(row.paymentTotal), customerId: row.customerId, customerName: row.customerName, depositAccount: row.depositAccount })
  }
  return payments
}

function linkedTypes(value: unknown) {
  const list = Array.isArray(value) ? value : []
  return list.map(item => String((item as { TxnType?: string }).TxnType ?? "").toLowerCase())
}

function customersOf(deposit: Record<string, unknown>) {
  const ids = new Map<string, string>()
  for (const line of Array.isArray(deposit.Line) ? deposit.Line : []) {
    const detail = (line as { DepositLineDetail?: { Entity?: { value?: string; name?: string; type?: string; Type?: string; Name?: string; EntityRef?: { value?: string; name?: string } } } }).DepositLineDetail
    const entity = detail?.Entity
    const type = String(entity?.type ?? entity?.Type ?? "customer").toLowerCase()
    const id = String(entity?.EntityRef?.value ?? entity?.value ?? "")
    const name = String(entity?.name ?? entity?.Name ?? entity?.EntityRef?.name ?? "")
    if (id && type === "customer" && !ids.has(id)) ids.set(id, name)
  }
  return { customerIds: [...ids.keys()], customerNames: [...new Set([...ids.values()].filter(Boolean))] }
}

export function unlinkedDeposits(deposits: Record<string, unknown>[]): UnlinkedDeposit[] {
  return deposits.flatMap(deposit => {
    const lines = Array.isArray(deposit.Line) ? deposit.Line : []
    const linked = [
      ...linkedTypes(deposit.LinkedTxn),
      ...lines.flatMap(line => linkedTypes((line as { LinkedTxn?: unknown }).LinkedTxn)),
    ]
    if (linked.includes("payment")) return []
    const total = Math.round(Number(deposit.TotalAmt ?? 0) * 100) / 100
    const account = deposit.DepositToAccountRef as { value?: string; name?: string } | undefined
    const lineAmounts = lines
      .map(line => Math.round(Number((line as { Amount?: number }).Amount ?? Number.NaN) * 100) / 100)
      .filter(amount => !Number.isNaN(amount))
    return [{
      id: String(deposit.Id ?? ""),
      txnDate: String(deposit.TxnDate ?? ""),
      total,
      accountId: String(account?.value ?? ""),
      accountName: String(account?.name ?? ""),
      ...customersOf(deposit),
      lineAmounts,
      lineAmount: formatCurrency(total),
    }]
  }).filter(deposit => deposit.id)
}

interface ScoredPair {
  payment: UndepositedPayment
  deposit: UnlinkedDeposit
  reason: string
  likelihood: number
}

function explainPair(payment: UndepositedPayment, deposit: UnlinkedDeposit, unique: boolean): Pick<ScoredPair, "reason" | "likelihood"> {
  const likelihood = unique ? 85 : 70
  const listed = deposit.customerNames.length === 1 ? deposit.customerNames[0] : payment.customerName
  const onLine = listed ? ` ${listed} was listed on the deposit line.` : ""
  const reason = `Same date and amount.${onLine}`
  return { reason, likelihood }
}

function scoredPairs(payments: UndepositedPayment[], deposits: UnlinkedDeposit[]) {
  const pairs: ScoredPair[] = []
  const byKey = <T extends { txnDate: string; total: number }>(items: T[]) => {
    const groups = new Map<string, T[]>()
    for (const item of items) {
      if (!item.txnDate || Number.isNaN(item.total)) continue
      const key = amountKey(item.txnDate, item.total)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return groups
  }
  const paymentGroups = byKey(payments)
  const depositGroups = byKey(deposits)
  for (const [key, pay] of paymentGroups) {
    const dep = depositGroups.get(key)
    if (!dep) continue
    if (pay.length === 1 && dep.length === 1) {
      pairs.push({ payment: pay[0], deposit: dep[0], ...explainPair(pay[0], dep[0], true) })
      continue
    }
    const used = new Set<string>()
    for (const payment of pay) {
      const hits = dep.filter(deposit => !used.has(deposit.id) && payment.customerId && deposit.customerIds.includes(payment.customerId))
      if (hits.length !== 1) continue
      pairs.push({ payment, deposit: hits[0], ...explainPair(payment, hits[0], false) })
      used.add(hits[0].id)
    }
  }
  return pairs
}

// A date and amount that belongs to one payment and one deposit is the match. When several share that pair, the deposit's customer has to pick out one payment.
export function matchUndepositedFunds(payments: UndepositedPayment[], deposits: UnlinkedDeposit[]) {
  const matches = new Map<string, UnlinkedDeposit>()
  for (const pair of scoredPairs(payments, deposits)) matches.set(pair.payment.paymentId, pair.deposit)
  return matches
}

export function depositSuggestions(payments: UndepositedPayment[], deposits: UnlinkedDeposit[]): DepositSuggestion[] {
  const byDeposit = new Map(scoredPairs(payments, deposits).map(pair => [pair.deposit.id, pair]))
  return deposits.map(deposit => {
    const pair = byDeposit.get(deposit.id)
    if (!pair) return { deposit, payment: null, reason: "No payment has this date and total.", likelihood: null }
    return { deposit, payment: pair.payment, reason: pair.reason, likelihood: pair.likelihood }
  })
}

export interface OutsideDepositLine {
  depositId: string
  transactionId: string
  date: string
  amountTotal: number
  amountFee: number | null
  amountNet: number | null
}

export interface DepositLineSuggestion {
  deposit: UnlinkedDeposit
  outside: OutsideDepositLine | null
  payment: UndepositedPayment | null
  reason: string
  likelihood: number | null
}

interface AwaitingPayment extends UndepositedPayment {
  invoiceTotal: number
  invoiceLineAmounts: number[]
}

function amountBag(values: number[]) {
  return values.map(value => Math.round(Math.abs(value) * 100)).sort((left, right) => left - right).join(",")
}

function dayOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return ""
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
}

function sameMoney(left: number, right: number) {
  return !Number.isNaN(left) && !Number.isNaN(right) && Math.round(Math.abs(left) * 100) === Math.round(Math.abs(right) * 100)
}

export function invoicePaymentsAwaitingDeposit(rows: ReviewRow[]): AwaitingPayment[] {
  const seen = new Set<string>()
  const payments: AwaitingPayment[] = []
  for (const row of rows) {
    const link = row.paymentLinkType.replace(/\s/g, "").toLowerCase()
    if (!row.id || !row.paymentId || row.depositId || link === "creditmemo" || seen.has(row.paymentId)) continue
    seen.add(row.paymentId)
    payments.push({
      paymentId: row.paymentId,
      txnDate: row.paymentTxnDate,
      total: money(row.paymentTotal),
      customerId: row.customerId,
      customerName: row.customerName,
      depositAccount: row.depositAccount,
      invoiceTotal: money(row.total),
      invoiceLineAmounts: row.invoiceLineAmounts,
    })
  }
  return payments
}

export function depositLineSuggestions(deposits: UnlinkedDeposit[], lines: OutsideDepositLine[], payments: UndepositedPayment[], awaiting: AwaitingPayment[]): DepositLineSuggestion[] {
  const whole = new Map(depositSuggestions(payments, deposits).map(item => [item.deposit.id, item]))
  const byDeposit = new Map<string, OutsideDepositLine[]>()
  for (const line of lines) byDeposit.set(line.depositId, [...(byDeposit.get(line.depositId) ?? []), line])
  const used = new Set<string>()
  const claim = (line: OutsideDepositLine) => {
    const amount = line.amountTotal
    const day = dayOf(line.date)
    const hits = awaiting.filter(payment => !used.has(payment.paymentId) && (sameMoney(amount, payment.total) || sameMoney(amount, payment.invoiceTotal)))
    const sameDay = hits.filter(payment => day && dayOf(payment.txnDate) === day)
    const pool = sameDay.length > 0 ? sameDay : hits
    const paymentHits = pool.filter(payment => sameMoney(amount, payment.total))
    const chosen = (paymentHits.length > 0 ? paymentHits : pool)[0]
    if (!chosen || (pool.length > 1 && sameDay.length !== 1 && hits.length !== 1)) {
      return { payment: null, reason: "No invoice payment has this amount_total.", likelihood: null }
    }
    used.add(chosen.paymentId)
    const onPayment = sameMoney(amount, chosen.total)
    const dated = Boolean(day) && dayOf(chosen.txnDate) === day
    return {
      payment: chosen,
      reason: onPayment
        ? dated ? "amount_total matches the payment on the same date." : "amount_total matches the payment."
        : dated ? "amount_total matches the invoice on the same date." : "amount_total matches the invoice.",
      likelihood: hits.length === 1 ? 85 : 70,
    }
  }
  return deposits.flatMap(deposit => {
    const matched = byDeposit.get(deposit.id) ?? []
    if (matched.length === 0) {
      const suggestion = whole.get(deposit.id)
      return [{ deposit, outside: null, payment: suggestion?.payment ?? null, reason: suggestion?.reason ?? "No payment has this date and total.", likelihood: suggestion?.likelihood ?? null }]
    }
    const rows = matched.map(outside => ({ deposit, outside, ...claim(outside) }))
    const open = rows.filter(row => row.outside && !row.payment)
    if (open.length < 2) return rows
    const amounts = open.map(row => row.outside?.amountTotal ?? Number.NaN)
    const sum = Math.round(amounts.reduce((total, amount) => total + amount, 0) * 100) / 100
    const hits = awaiting.filter(payment => !used.has(payment.paymentId) && sameMoney(sum, payment.total) && amountBag(payment.invoiceLineAmounts) === amountBag(amounts))
    if (hits.length !== 1) return rows
    const chosen = hits[0]
    used.add(chosen.paymentId)
    const grouped = {
      payment: chosen,
      reason: "These lines total the payment, and each amount matches an invoice line.",
      likelihood: 85,
    }
    return rows.map(row => row.payment ? row : { ...row, ...grouped })
  })
}

export function stepTwoRows(rows: ReviewRow[], matches: Map<string, UnlinkedDeposit>) {
  const wanted = new Set(undepositedPayments(rows).map(payment => payment.paymentId))
  return rows.filter(row => wanted.has(row.paymentId)).map(row => {
    const deposit = matches.get(row.paymentId)
    if (!deposit) return row
    return {
      ...row,
      depositId: deposit.id,
      depositTxnDate: deposit.txnDate,
      depositTotal: formatCurrency(deposit.total),
      depositToAccountRefValue: deposit.accountId,
      depositToAccountRefName: deposit.accountName,
      depositLineAmount: deposit.lineAmount,
      depositLineLinkedTxnId: row.paymentId,
      depositLineLinkedTxnType: "Payment",
    }
  })
}

export function proposeUndepositedMatches(rows: ReviewRow[], matches: Map<string, UnlinkedDeposit>): ProposedFix[] {
  const seen = new Set<string>()
  const fixes: ProposedFix[] = []
  for (const row of stepTwoRows(rows, matches)) {
    const deposit = matches.get(row.paymentId)
    if (!deposit || seen.has(row.paymentId)) continue
    seen.add(row.paymentId)
    fixes.push({
      paymentId: row.paymentId,
      txnDate: row.paymentTxnDate,
      totalAmt: row.paymentTotal,
      originalAccount: row.depositAccount,
      proposedAccount: UNDEPOSITED_FUNDS,
      depositToAccountRef: deposit.accountId,
      depositToAccountRefName: deposit.accountName,
      lineAmount: deposit.lineAmount,
      linkedTxnId: row.paymentId,
      linkedTxnType: "Payment",
      depositId: deposit.id,
      depositTotal: formatCurrency(deposit.total),
      feeAmount: "",
      feeError: "",
    })
  }
  return fixes
}

function cents(value: number) {
  return Math.round(value * 100)
}

function parsedMoney(value: string) {
  const amount = Number(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isFinite(amount) ? amount : Number.NaN
}

function lineSubsets(lines: OutsideDepositLine[], target: number) {
  const targetCents = cents(target)
  const found: OutsideDepositLine[][] = []
  const chosen: OutsideDepositLine[] = []
  const walk = (start: number, sum: number) => {
    if (found.length > 12) return
    if (sum === targetCents && chosen.length > 0) {
      found.push(chosen.slice())
      return
    }
    if (sum > targetCents) return
    for (let index = start; index < lines.length; index++) {
      const amount = cents(lines[index].amountTotal)
      if (!Number.isFinite(amount)) continue
      chosen.push(lines[index])
      walk(index + 1, sum + amount)
      chosen.pop()
    }
  }
  if (Number.isFinite(targetCents)) walk(0, 0)
  return found
}

// One saved line can equal a payment. Otherwise the lines whose amounts add up to that payment belong to it, and their fees add up too.
function assignDepositLines(payments: { paymentId: string; amount: number }[], lines: OutsideDepositLine[]) {
  const remaining = lines.slice()
  const assigned = new Map<string, OutsideDepositLine[]>()
  const pending = payments.slice()
  let moved = true
  while (moved && pending.length > 0) {
    moved = false
    for (let index = 0; index < pending.length;) {
      const subsets = lineSubsets(remaining, pending[index].amount)
      const smallest = Math.min(...subsets.map(set => set.length))
      const tight = subsets.filter(set => set.length === smallest)
      if (tight.length !== 1) {
        index += 1
        continue
      }
      assigned.set(pending[index].paymentId, tight[0])
      const used = new Set(tight[0])
      for (let lineIndex = remaining.length - 1; lineIndex >= 0; lineIndex--) {
        if (used.has(remaining[lineIndex])) remaining.splice(lineIndex, 1)
      }
      pending.splice(index, 1)
      moved = true
    }
  }
  return assigned
}

function feeForLines(paymentId: string, payment: number, saved: OutsideDepositLine[], depositTotal: number) {
  if (saved.length === 0) {
    return { feeAmount: "", feeError: `Payment ${paymentId} is ${formatCurrency(payment)} and no saved lines total that amount. No amount_fee is stored, so this proposal cannot be submitted.` }
  }
  const singleWithoutNet = saved.length === 1 && saved[0].amountNet == null
  const portion = singleWithoutNet ? depositTotal : saved.reduce((sum, line) => sum + (line.amountNet ?? Number.NaN), 0)
  if (!Number.isFinite(portion)) {
    return { feeAmount: "", feeError: `Payment ${paymentId} is ${formatCurrency(payment)}. A saved line has no amount_net, so this proposal cannot be submitted.` }
  }
  const difference = cents(payment) - cents(portion)
  if (difference === 0) return { feeAmount: "", feeError: "" }
  const fee = saved.reduce((sum, line) => sum + (line.amountFee ?? 0), 0)
  if (saved.some(line => line.amountFee == null)) {
    return { feeAmount: "", feeError: `Payment ${paymentId} is ${formatCurrency(payment)} and the deposit lines total ${formatCurrency(portion)}. No amount_fee is stored, so this proposal cannot be submitted.` }
  }
  if (cents(fee) !== Math.abs(difference)) {
    return { feeAmount: "", feeError: `Payment ${paymentId} is ${formatCurrency(payment)} and the deposit lines total ${formatCurrency(portion)}. The stored amount_fee is ${formatCurrency(fee)}, so this proposal cannot be submitted.` }
  }
  return { feeAmount: formatCurrency(fee), feeError: "" }
}

// Links each chosen deposit to its payment. A difference has to be the saved amount_fee, summed when several lines make the payment.
export function proposeChosenDeposits(rows: ReviewRow[], choices: { paymentId: string; depositId: string }[], deposits: UnlinkedDeposit[], lines: OutsideDepositLine[]): ProposedFix[] {
  const byPayment = new Map<string, ReviewRow>()
  for (const row of rows) if (row.paymentId && !byPayment.has(row.paymentId)) byPayment.set(row.paymentId, row)
  const byDeposit = new Map(deposits.map(deposit => [deposit.id, deposit]))
  const ready = choices.flatMap(choice => {
    const row = byPayment.get(choice.paymentId)
    const deposit = byDeposit.get(choice.depositId)
    if (!row || !deposit) return []
    return [{ choice, row, deposit, payment: parsedMoney(row.paymentTotal) }]
  })
  const assigned = new Map<string, OutsideDepositLine[]>()
  const depositIds = [...new Set(ready.map(item => item.deposit.id))]
  for (const depositId of depositIds) {
    const group = ready.filter(item => item.deposit.id === depositId)
    const saved = assignDepositLines(group.map(item => ({ paymentId: item.choice.paymentId, amount: item.payment })), lines.filter(line => line.depositId === depositId))
    for (const [paymentId, savedLines] of saved) assigned.set(paymentId, savedLines)
  }
  const fixes: ProposedFix[] = []
  for (const item of ready) {
    const { feeAmount, feeError } = feeForLines(item.row.paymentId, item.payment, assigned.get(item.choice.paymentId) ?? [], item.deposit.total)
    fixes.push({
      paymentId: item.row.paymentId,
      txnDate: item.row.paymentTxnDate,
      totalAmt: item.row.paymentTotal,
      originalAccount: item.row.depositAccount,
      proposedAccount: UNDEPOSITED_FUNDS,
      depositToAccountRef: item.deposit.accountId,
      depositToAccountRefName: item.deposit.accountName,
      lineAmount: item.row.paymentTotal,
      linkedTxnId: item.row.paymentId,
      linkedTxnType: "Payment",
      depositId: item.deposit.id,
      depositTotal: formatCurrency(item.deposit.total),
      feeAmount,
      feeError,
    })
  }
  return fixes
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
      depositId: "",
      depositTotal: row.paymentTotal,
      feeAmount: "",
      feeError: "",
    })
  }
  return fixes
}
