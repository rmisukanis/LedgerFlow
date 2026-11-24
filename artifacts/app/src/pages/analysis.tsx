import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"
import { depositIdsOf, isPayment, loadDepositCleared, loadDeposits, loadPayments, paymentIdsOf, reviewRows, storeDocuments, type ReviewRow } from "@/lib/invoice-chain"
import { invoiceIdsOf, loadInvoices, paymentIdsOfDeposits, reviewDepositRows } from "@/lib/deposit-chain"
import { BANK_CHARGES_ACCOUNT, defaultFixMemo, depositLineSuggestions, invoicePaymentsAwaitingDeposit, matchUndepositedFunds, proposeChosenDeposits, proposeDirectPaymentFixes, stepOne, stepTwoMemo, stepTwoRows, STEP_ONE_DETAIL, STEP_ONE_NAME, STEP_TWO_DETAIL, STEP_TWO_NAME, undepositedPayments, unlinkedDeposits, type AnalysisStep, type OutsideDepositLine, type ProposedFix, type UnlinkedDeposit } from "@/lib/analysis"
import { qbList, qbQuery, qbQuote } from "@/lib/qb"
import { formatCurrency } from "@/lib/utils"

const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "w-full h-10 rounded-md border bg-background px-3 text-sm"

const TYPES = [
  { id: "invoice", label: "Invoice" },
  { id: "payment", label: "Payment" },
  { id: "deposit", label: "Deposit" },
] as const

type TxnKind = (typeof TYPES)[number]["id"]

interface Customer { id: string; name: string }

const INVOICE_COLUMNS = ["Id", "DocNumber", "TxnDate", "LinkedTxn Id", "LinkedTxn Type", "Customer Id", "Customer Name", "Total"]
const PAYMENT_COLUMNS = ["DepositToAccountRef", "TotalAmt", "Id", "TxnDate", "LinkedTxn Id", "LinkedTxn Type"]
const DEPOSIT_COLUMNS = ["Id", "TxnDate", "TotalAmt", "ToAccountRef", "ToAccountRef Name", "Line Amount", "LinkedTxn Id", "LinkedTxn Type", "Clr = is_cleared"]
const invoiceHead = { backgroundColor: "#DBEAFE", color: "#2563EB", boxShadow: "inset 0 -2px 0 #2563EB" }
const invoiceCell = { backgroundColor: "#DBEAFE" }
const paymentHead = { backgroundColor: "#DCFCE7", color: "#16A34A", boxShadow: "inset 0 -2px 0 #16A34A" }
const paymentCell = { backgroundColor: "#DCFCE7" }
const depositHead = { backgroundColor: "#F3E8FF", color: "#9333EA", boxShadow: "inset 0 -2px 0 #9333EA" }
const depositCell = { backgroundColor: "#F3E8FF" }
const matchHead = { backgroundColor: "#FEF2F2", color: "#DC2626", boxShadow: "inset 0 -2px 0 #DC2626" }
const matchCell = { backgroundColor: "#FEF2F2", color: "#DC2626" }

type ChainGroup = "invoice" | "payment" | "deposit"
const GROUP_TITLES: Record<ChainGroup, string> = { invoice: "Invoice", payment: "Payment", deposit: "Deposit" }

function groupColumns(group: ChainGroup) {
  if (group === "invoice") return INVOICE_COLUMNS
  if (group === "payment") return PAYMENT_COLUMNS
  return DEPOSIT_COLUMNS
}

function groupHead(group: ChainGroup) {
  if (group === "invoice") return invoiceHead
  if (group === "payment") return paymentHead
  return depositHead
}

function GroupCells({ group, row }: { group: ChainGroup; row: ReviewRow }) {
  if (group === "invoice") return (
    <>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.id}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.docNumber}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.txnDate}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.linkId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.linkType}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.customerId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{row.customerName}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={invoiceCell}>{row.total}</td>
    </>
  )
  if (group === "payment") return (
    <>
      <td className="px-3 py-1.5 whitespace-nowrap" style={paymentCell}>{row.depositAccount}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={paymentCell}>{row.paymentTotal}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={paymentCell}>{row.paymentId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={paymentCell}>{row.paymentTxnDate}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={paymentCell}>{row.paymentLinkId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={paymentCell}>{row.paymentLinkType}</td>
    </>
  )
  return (
    <>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositTxnDate}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={depositCell}>{row.depositTotal}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositToAccountRefValue}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositToAccountRefName}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={depositCell}>{row.depositLineAmount}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositLineLinkedTxnId}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositLineLinkedTxnType}</td>
      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{row.depositCleared}</td>
    </>
  )
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function presetPeriod(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { month: d.getMonth() + 1, year: d.getFullYear() }
}

function monthBounds(year: number, month: number) {
  const mm = String(month).padStart(2, "0")
  const last = new Date(year, month, 0).getDate()
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, "0")}` }
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const shift = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
const span = (start: Date, end: Date) => ({ start: iso(start), end: iso(end) })

// The case names are the QuickBooks date_macro values (the option value), not the shorter dropdown label. The Invoice query has no date_macro parameter, so these become TxnDate bounds.
export function macroRange(name: string, today: Date, fiscalStartMonth: number) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const weekStart = shift(day, -day.getDay())
  const prevMonth = new Date(day.getFullYear(), day.getMonth() - 1, 1)
  const nextMonth = new Date(day.getFullYear(), day.getMonth() + 1, 1)
  const fyMonth = fiscalStartMonth - 1
  const fy = new Date(day.getMonth() < fyMonth ? day.getFullYear() - 1 : day.getFullYear(), fyMonth, 1)
  const quarter = Math.floor(((day.getFullYear() - fy.getFullYear()) * 12 + (day.getMonth() - fy.getMonth())) / 3)
  const quarterStart = new Date(fy.getFullYear(), fy.getMonth() + quarter * 3, 1)
  const quarterEnd = shift(new Date(fy.getFullYear(), fy.getMonth() + (quarter + 1) * 3, 1), -1)
  const yearEnd = shift(new Date(fy.getFullYear() + 1, fy.getMonth(), 1), -1)
  switch (name) {
    case "Today": return span(day, day)
    case "Yesterday": return span(shift(day, -1), shift(day, -1))
    case "This Week": return span(weekStart, shift(weekStart, 6))
    case "Last Week": return span(shift(weekStart, -7), shift(weekStart, -1))
    case "This Week-to-date": return span(weekStart, day)
    case "Last Week-to-date": return span(shift(weekStart, -7), shift(day, -7))
    case "Next Week": return span(shift(weekStart, 7), shift(weekStart, 13))
    case "Next 4 Weeks": return span(shift(weekStart, 7), shift(weekStart, 34))
    case "This Month": return span(new Date(day.getFullYear(), day.getMonth(), 1), new Date(day.getFullYear(), day.getMonth() + 1, 0))
    case "Last Month": return span(prevMonth, new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0))
    case "This Month-to-date": return span(new Date(day.getFullYear(), day.getMonth(), 1), day)
    case "Last Month-to-date": return span(prevMonth, new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(day.getDate(), new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate())))
    case "Next Month": return span(nextMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0))
    case "This Fiscal Quarter": return span(quarterStart, quarterEnd)
    case "Last Fiscal Quarter": return span(new Date(fy.getFullYear(), fy.getMonth() + (quarter - 1) * 3, 1), shift(quarterStart, -1))
    case "This Fiscal Quarter-to-date": return span(quarterStart, day)
    case "Last Fiscal Quarter-to-date": {
      const start = new Date(fy.getFullYear(), fy.getMonth() + (quarter - 1) * 3, 1)
      const offset = Math.round((day.getTime() - quarterStart.getTime()) / 86400000)
      const end = shift(start, offset)
      const limit = shift(quarterStart, -1)
      return span(start, end > limit ? limit : end)
    }
    case "Next Fiscal Quarter": return span(shift(quarterEnd, 1), shift(new Date(fy.getFullYear(), fy.getMonth() + (quarter + 2) * 3, 1), -1))
    case "This Fiscal Year": return span(fy, yearEnd)
    case "Last Fiscal Year": return span(new Date(fy.getFullYear() - 1, fy.getMonth(), 1), shift(fy, -1))
    case "This Fiscal Year-to-date": return span(fy, day)
    case "Last Fiscal Year-to-date": {
      const start = new Date(fy.getFullYear() - 1, fy.getMonth(), 1)
      const end = new Date(day.getFullYear() - 1, day.getMonth(), day.getDate())
      const limit = shift(fy, -1)
      return span(start, end > limit ? limit : end)
    }
    case "Next Fiscal Year": {
      const start = new Date(fy.getFullYear() + 1, fy.getMonth(), 1)
      return span(start, shift(new Date(start.getFullYear() + 1, start.getMonth(), 1), -1))
    }
    default: return null
  }
}

const PRESET = presetPeriod()
const YEAR_OPTIONS = Array.from(new Set([PRESET.year, ...Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i)])).sort((a, b) => b - a)

export default function AnalysisPage() {
  const [kind, setKind] = useState<TxnKind | "">("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerIds, setCustomerIds] = useState<string[]>([])
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState("")
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([])
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountQuery, setAccountQuery] = useState("")
  const customerBox = useRef<HTMLDivElement>(null)
  const accountBox = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(PRESET.month)
  const [year, setYear] = useState(PRESET.year)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [macro, setMacro] = useState("")
  const [fiscalStart, setFiscalStart] = useState(1)
  const [usedRange, setUsedRange] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [missingOnly, setMissingOnly] = useState(false)
  const [chain, setChain] = useState<"invoice" | "deposit">("invoice")
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null)
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep | null>(null)
  const [openDeposits, setOpenDeposits] = useState<UnlinkedDeposit[] | null>(null)
  const [outsideLines, setOutsideLines] = useState<OutsideDepositLine[]>([])
  const [stepTwoBusy, setStepTwoBusy] = useState(false)
  const [fixMemo, setFixMemo] = useState(defaultFixMemo)
  const [proposals, setProposals] = useState<ProposedFix[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [chosenDeposit, setChosenDeposit] = useState<Record<string, string>>({})
  const [chargeAccounts, setChargeAccounts] = useState<Record<string, string>>({})

  useEffect(() => {
    qbQuery("SELECT Id, DisplayName FROM Customer MAXRESULTS 1000")
      .then(d => {
        const list = qbList<{ Id: string; DisplayName?: string }>(d, "Customer")
        setCustomers(list.map(c => ({ id: String(c.Id), name: String(c.DisplayName ?? c.Id) })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load customers"))
    qbQuery("SELECT Id, Name FROM Account MAXRESULTS 1000")
      .then(d => {
        const list = qbList<{ Id: string; Name?: string }>(d, "Account")
        setAccounts(list.map(a => ({ id: String(a.Id), name: String(a.Name ?? a.Id) })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load accounts"))
    qbQuery("SELECT * FROM CompanyInfo")
      .then(d => {
        const info = qbList<{ FiscalYearStartMonth?: string }>(d, "CompanyInfo")[0]
        const n = Number(info?.FiscalYearStartMonth)
        if (n >= 1 && n <= 12) setFiscalStart(n)
      })
      .catch(() => {})
  }, [])

  const customerReady = kind === "invoice" || kind === "payment" || kind === "deposit"
  const shownCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter(c => `${c.name} ${c.id}`.toLowerCase().includes(needle))
  }, [customers, customerQuery])
  const shownAccounts = useMemo(() => {
    const needle = accountQuery.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter(account => `${account.name} ${account.id}`.toLowerCase().includes(needle))
  }, [accounts, accountQuery])
  const pickedLabel = (ids: string[], items: { id: string; name: string }[], all: string) => {
    if (ids.length === 0) return all
    const first = items.find(item => item.id === ids[0])
    const name = first ? `${first.name} (${first.id})` : ids[0]
    return ids.length === 1 ? name : `${name} +${ids.length - 1}`
  }

  useEffect(() => {
    if (!customerOpen && !accountOpen) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (!customerBox.current?.contains(target)) setCustomerOpen(false)
      if (!accountBox.current?.contains(target)) setAccountOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [customerOpen, accountOpen])

  const showPayments = chain === "deposit" || (rows?.some(r => isPayment(r.linkType)) ?? false)
  const showDeposits = chain === "deposit" || analysisStep === 2 || (rows?.some(r => r.depositId) ?? false)
  const groups: ChainGroup[] = chain === "deposit" ? ["deposit", "payment", "invoice"] : ["invoice", "payment", "deposit"]
  const visibleGroups = groups.filter(group => group === "invoice" || (group === "payment" ? showPayments : showDeposits))
  const shownRows = useMemo(() => {
    if (!rows) return rows
    let list: ReviewRow[]
    if (analysisStep === 1) list = stepOne(rows)
    else if (analysisStep === 2) list = openDeposits ? stepTwoRows(rows, matchUndepositedFunds(undepositedPayments(rows), openDeposits)) : []
    else if (!missingOnly) list = rows
    else {
      const open = rows.filter(row => row.depositCleared.trim().toUpperCase() !== "R")
      list = chain === "deposit"
        ? open.filter(row => !row.paymentId || !row.id)
        : open.filter(row => row.paymentId && !row.depositId && row.paymentLinkType.replace(/\s/g, "").toLowerCase() !== "creditmemo")
    }
    if (accountIds.length === 0) return list
    return list.filter(row => accountIds.includes(row.depositAccount) || accountIds.includes(row.depositToAccountRefValue))
  }, [rows, missingOnly, chain, analysisStep, accountIds, openDeposits])
  const suggestions = useMemo(() => {
    if (analysisStep !== 2 || !rows || !openDeposits) return []
    const found = depositLineSuggestions(openDeposits, outsideLines, undepositedPayments(rows), invoicePaymentsAwaitingDeposit(rows))
    if (accountIds.length === 0) return found
    return found.filter(item => accountIds.includes(item.deposit.accountId) || (item.payment != null && accountIds.includes(item.payment.depositAccount)))
  }, [analysisStep, rows, openDeposits, outsideLines, accountIds])
  const suggestedDeposit = useMemo(() => {
    const matches = new Map<string, string>()
    for (const item of suggestions) {
      if (!item.payment || item.likelihood == null || matches.has(item.payment.paymentId)) continue
      matches.set(item.payment.paymentId, item.deposit.id)
    }
    return matches
  }, [suggestions])
  const proposedDeposit = (paymentId: string) => {
    if (Object.prototype.hasOwnProperty.call(chosenDeposit, paymentId)) return chosenDeposit[paymentId]
    return suggestedDeposit.get(paymentId) ?? ""
  }

  const loadOpenDeposits = async () => {
    if (!period.start && !period.end) return
    setStepTwoBusy(true)
    setError(null)
    try {
      const where: string[] = []
      if (period.start) where.push(`TxnDate >= '${qbQuote(period.start)}'`)
      if (period.end) where.push(`TxnDate <= '${qbQuote(period.end)}'`)
      const data = await qbQuery(`SELECT * FROM Deposit WHERE ${where.join(" AND ")} MAXRESULTS 1000`)
      const list = qbList<Record<string, unknown>>(data, "Deposit")
      const unlinked = unlinkedDeposits(list)
      setOpenDeposits(unlinked)
      const ids = unlinked.map(deposit => deposit.id)
      if (ids.length === 0) {
        setOutsideLines([])
      } else {
        const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits?depositIds=${encodeURIComponent(ids.join(","))}`)
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? "Could not read the saved transactions.")
        const saved = (Array.isArray(body.rows) ? body.rows : []) as Array<Record<string, string>>
        setOutsideLines(saved.map(row => ({
          depositId: row.deposit_id,
          transactionId: row.transaction_id,
          date: row.date,
          amountTotal: Number(String(row.amount_total).replace(/[^0-9.-]/g, "")),
          amountFee: row.amount_fee ? Number(String(row.amount_fee).replace(/[^0-9.-]/g, "")) : null,
          amountNet: row.amount_net ? Number(String(row.amount_net).replace(/[^0-9.-]/g, "")) : null,
        })).filter(row => row.depositId && Number.isFinite(row.amountTotal)))
      }
      if (list.length === 1000) setNotice("QuickBooks returned 1000 deposits, so later ones are not compared.")
    } catch (e) {
      setOpenDeposits([])
      setError(e instanceof Error ? e.message : "Could not load deposits")
    } finally {
      setStepTwoBusy(false)
    }
  }

  const chooseStep = (step: AnalysisStep) => {
    setError(null)
    setProposals(null)
    setAnalysisStep(step)
    setFixMemo(step === 2 ? stepTwoMemo() : defaultFixMemo())
    if (step === 2 && openDeposits == null) void loadOpenDeposits()
  }

  const analyze = () => {
    if (!rows || chain !== "invoice") {
      setError("Pull invoices before analyzing transactions.")
      return
    }
    chooseStep(1)
  }

  const propose = async () => {
    if (!rows || chain !== "invoice") {
      setError("Pull invoices before proposing a fix.")
      return
    }
    if (analysisStep === 2) {
      if (!openDeposits) {
        setError("Wait for the deposit lookup to finish.")
        return
      }
      const seen = new Set<string>()
      const choices: { paymentId: string; depositId: string }[] = []
      for (const row of shownRows ?? []) {
        if (!row.paymentId || seen.has(row.paymentId)) continue
        const depositId = proposedDeposit(row.paymentId)
        if (!depositId) continue
        seen.add(row.paymentId)
        choices.push({ paymentId: row.paymentId, depositId })
      }
      if (choices.length === 0) {
        setError("Choose a proposed deposit before proposing a fix.")
        setProposals(null)
        return
      }
      const fixes = proposeChosenDeposits(rows, choices, openDeposits, outsideLines)
      setError(null)
      setChargeAccounts(Object.fromEntries(fixes.filter(fix => fix.feeAmount).map(fix => [fix.paymentId, BANK_CHARGES_ACCOUNT])))
      setProposals(fixes)
      return
    }
    const flagged = stepOne(rows)
    if (flagged.length === 0) {
      setError("No payments are coded directly to a bank account.")
      setProposals(null)
      return
    }
    setError(null)
    const names = new Map<string, string>()
    const accountIds = [...new Set(flagged.map(row => row.depositAccount))]
    try {
      const data = await qbQuery(`SELECT Id, Name FROM Account WHERE Id IN (${accountIds.map(id => `'${qbQuote(id)}'`).join(",")}) MAXRESULTS 1000`)
      for (const account of qbList<{ Id?: string; Name?: string }>(data, "Account")) names.set(String(account.Id ?? ""), String(account.Name ?? ""))
    } catch {
      // The proposal can still show the account id when the name lookup fails.
    }
    setAnalysisStep(1)
    setProposals(proposeDirectPaymentFixes(rows, names))
  }

  const submit = async () => {
    if (!proposals || proposals.length === 0) {
      setError("Propose the fix before submitting it.")
      return
    }
    if (!fixMemo.trim()) {
      setError("Enter a memo before submitting.")
      return
    }
    const blocked = proposals.filter(fix => fix.feeError)
    if (blocked.length > 0) {
      setError(blocked.map(fix => fix.feeError).join(" "))
      return
    }
    const missingCharge = proposals.find(fix => fix.feeAmount && !chargeAccounts[fix.paymentId])
    if (missingCharge) {
      setError(`Choose the charge account for payment ${missingCharge.paymentId}.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/qb/audit/${analysisStep === 2 ? "submit-link" : "submit"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memo: fixMemo.trim(),
          fixes: proposals.map(fix => ({
            paymentId: fix.paymentId,
            depositId: fix.depositId,
            originalAccount: fix.originalAccount,
            accountName: fix.depositToAccountRefName,
            feeAmount: fix.feeAmount,
            feeAccountId: fix.feeAmount ? chargeAccounts[fix.paymentId] ?? "" : "",
          })),
        }),
      })
      const body = await response.json()
      const saved = new Set<string>((body.saved ?? []).map((item: { paymentId: string }) => item.paymentId))
      if (saved.size > 0) {
        const deposits = new Map<string, string>((body.saved ?? []).map((item: { paymentId: string; depositId: string }) => [item.paymentId, item.depositId]))
        setRows(current => current?.map(row => saved.has(row.paymentId) ? { ...row, depositAccount: "4", depositId: deposits.get(row.paymentId) ?? row.depositId } : row) ?? current)
        setOpenDeposits(current => current?.filter(deposit => ![...deposits.values()].includes(deposit.id)) ?? current)
        setProposals(current => current?.filter(fix => !saved.has(fix.paymentId)) ?? null)
        setNotice(`Saved ${saved.size} change${saved.size === 1 ? "" : "s"} to QuickBooks and the database.`)
      }
      if (!response.ok || body.error) throw new Error(body.error ?? "Could not submit the proposed changes")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the proposed changes")
    } finally {
      setSubmitting(false)
    }
  }

  const period = useMemo(() => {
    if (macro) return macroRange(macro, new Date(), fiscalStart) ?? monthBounds(year, month)
    if (startDate || endDate) return { start: startDate, end: endDate }
    return monthBounds(year, month)
  }, [macro, fiscalStart, startDate, endDate, year, month])

  const pull = async () => {
    if (!kind) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setRows(null)
    setChain("invoice")
    setInvoiceCount(null)
    setUsedRange("")
    setAnalysisStep(null)
    setOpenDeposits(null)
    setOutsideLines([])
    setProposals(null)
    setChosenDeposit({})
    setChargeAccounts({})
    try {
      if (kind === "payment") {
        setError("Payment results are not wired up yet.")
        return
      }
      const where: string[] = []
      if (period.start) where.push(`TxnDate >= '${qbQuote(period.start)}'`)
      if (period.end) where.push(`TxnDate <= '${qbQuote(period.end)}'`)
      if (where.length === 0) throw new Error("Choose a month, a start or end date, or a date macro.")
      setUsedRange([period.start, period.end].filter(Boolean).join(" to "))
      if (kind === "deposit") {
        const query = `SELECT * FROM Deposit WHERE ${where.join(" AND ")} ORDERBY TxnDate DESC MAXRESULTS 1000`
        const list = qbList<Record<string, unknown>>(await qbQuery(query), "Deposit")
        const deposits = await storeDocuments("Deposit", list)
        const storedDeposits = [...deposits.values()]
        const linkedPaymentIds = paymentIdsOfDeposits(storedDeposits)
        const payments = await loadPayments(linkedPaymentIds)
        const invoices = await loadInvoices(invoiceIdsOf(payments))
        const cleared = await loadDepositCleared(storedDeposits)
        setChain("deposit")
        setInvoiceCount(list.length)
        setRows(reviewDepositRows(storedDeposits, payments, invoices, customerIds, cleared))
        const notes = [
          list.length === 1000 ? "QuickBooks returned 1000 deposits, so later ones are not in this list." : "",
        ].filter(Boolean)
        if (notes.length > 0) setNotice(notes.join(" "))
        return
      }
      if (customerIds.length > 0) where.push(`CustomerRef IN (${customerIds.map(id => `'${qbQuote(id)}'`).join(",")})`)
      const query = `SELECT * FROM Invoice WHERE ${where.join(" AND ")} ORDERBY TxnDate DESC MAXRESULTS 1000`
      const list = qbList<Record<string, unknown>>(await qbQuery(query), "Invoice")
      const invoices = await storeDocuments("Invoice", list)
      const storedInvoices = [...invoices.values()]
      const paymentIds = paymentIdsOf(storedInvoices)
      const payments = await loadPayments(paymentIds)
      const deposits = await loadDeposits(depositIdsOf(payments))
      const cleared = await loadDepositCleared(deposits.values())
      setChain("invoice")
      setInvoiceCount(list.length)
      setRows(reviewRows(storedInvoices, payments, deposits, cleared))
      const missing = paymentIds.filter(id => !payments.has(id))
      const notes = [
        list.length === 1000 ? "QuickBooks returned 1000 invoices, so later ones are not in this list." : "",
        missing.length > 0 ? `No Payment was returned for ${missing.length} linked id${missing.length === 1 ? "" : "s"}.` : "",
      ].filter(Boolean)
      if (notes.length > 0) setNotice(notes.join(" "))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pull invoices")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis</h1>
        <p className="text-muted-foreground mt-1">Find invoices and the payments or deposits linked to them.</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={label}>Transaction</label>
              <select className={selectCls} value={kind} data-testid="select-txn-kind" onChange={e => { setKind(e.target.value as TxnKind | ""); setRows(null); setError(null) }}>
                <option value="">Select type</option>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Customer</label>
              <div className="relative" ref={customerBox}>
                <Button type="button" variant="outline" disabled={!customerReady} className="w-full justify-between font-normal" data-testid="select-customer" onClick={() => { setCustomerOpen(open => !open); setCustomerQuery("") }}>
                  <span className="truncate">{customerReady ? pickedLabel(customerIds, customers, "All customers") : "Select a transaction type first"}</span>
                  <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
                {customerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
                    <Input autoFocus placeholder="Search customers…" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} data-testid="input-customer-search" />
                    <div className="mt-2 max-h-64 overflow-auto">
                      {customers.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading customers…</p> : (
                        <>
                          <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setCustomerIds([]); setRows(null) }}>All customers</button>
                          {shownCustomers.map(c => (
                            <button type="button" key={c.id} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setCustomerIds(current => current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id]); setRows(null) }}>
                              <input type="checkbox" readOnly checked={customerIds.includes(c.id)} aria-label={c.name} />
                              <span>{c.name} <span className="text-muted-foreground">({c.id})</span></span>
                            </button>
                          ))}
                          {shownCustomers.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No customer found.</p>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Account</label>
              <div className="relative" ref={accountBox}>
                <Button type="button" variant="outline" className="w-full justify-between font-normal" data-testid="select-account" onClick={() => { setAccountOpen(open => !open); setAccountQuery("") }}>
                  <span className="truncate">{pickedLabel(accountIds, accounts, "All accounts")}</span>
                  <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
                {accountOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
                    <Input autoFocus placeholder="Search accounts…" value={accountQuery} onChange={e => setAccountQuery(e.target.value)} data-testid="input-account-search" />
                    <div className="mt-2 max-h-64 overflow-auto">
                      {accounts.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading accounts…</p> : (
                        <>
                          <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setAccountIds([])}>All accounts</button>
                          {shownAccounts.map(account => (
                            <button type="button" key={account.id} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setAccountIds(current => current.includes(account.id) ? current.filter(id => id !== account.id) : [...current, account.id])}>
                              <input type="checkbox" readOnly checked={accountIds.includes(account.id)} aria-label={account.name} />
                              <span>{account.name} <span className="text-muted-foreground">({account.id})</span></span>
                            </button>
                          ))}
                          {shownAccounts.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No account found.</p>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <label className={label}>Time frame</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <label className={label}>Month</label>
                <select className={selectCls} value={month} onChange={e => { setMonth(Number(e.target.value)); setRows(null) }} data-testid="select-month">
                  {MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Year</label>
                <select className={selectCls} value={year} onChange={e => { setYear(Number(e.target.value)); setRows(null) }} data-testid="select-year">
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className={label}>&nbsp;</label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={pull} disabled={!kind || busy} data-testid="button-pull">
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull QuickBooks Register
                  </Button>
                  <Button type="button" variant={missingOnly ? "default" : "outline"} disabled={!kind || kind === "payment"} aria-pressed={missingOnly} onClick={() => setMissingOnly(on => !on)} data-testid="button-missing-match">
                    Missing three way match
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
              <div className="space-y-1.5"><label className={label}>start_date</label><DateField onIso={x => { setStartDate(x); setRows(null) }} testId="analysis-start_date" /></div>
              <div className="space-y-1.5"><label className={label}>end_date</label><DateField onIso={x => { setEndDate(x); setRows(null) }} testId="analysis-end_date" /></div>
              <div className="space-y-1.5">
                <label className={label}>date_macro</label>
                <select className={selectCls} value={macro} onChange={e => { setMacro(e.target.value); setRows(null) }} data-testid="analysis-date_macro">
                  <option value="">— not set —</option>
                  {DATE_MACROS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A date macro is sent as the TxnDate range. Otherwise the start and end dates are used. With neither of those, the month and year are used.</p>
          </div>

          <div className="space-y-3 border-t border-gray-200 pt-4">
            <label className={label}>Analysis</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={analyze} data-testid="button-analyze">Analyze Transactions</Button>
              {analysisStep == null ? (
                <div className="flex h-9 min-w-28 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm" data-testid="analysis-step" />
              ) : (
                <select className="h-9 min-w-28 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm" value={analysisStep} onChange={e => chooseStep(Number(e.target.value) as AnalysisStep)} data-testid="analysis-step">
                  <option value={1}>{STEP_ONE_NAME}</option>
                  <option value={2}>{STEP_TWO_NAME}</option>
                </select>
              )}
              {analysisStep != null && <div className="flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm" data-testid="analysis-step-detail">{analysisStep === 2 ? STEP_TWO_DETAIL : STEP_ONE_DETAIL}{stepTwoBusy ? " — looking up deposits" : ""}</div>}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <Button type="button" onClick={propose} data-testid="button-propose-fix" style={{ backgroundColor: "#16A34A", color: "#FFFFFF", borderColor: "#16A34A" }}>Propose fix</Button>
                {analysisStep != null && (
                  <>
                    <div className="space-y-1.5 min-w-80 flex-1 max-w-xl">
                      <label className={label} htmlFor="fix-memo">Memo</label>
                      <Input id="fix-memo" value={fixMemo} onChange={e => setFixMemo(e.target.value)} data-testid="input-fix-memo" />
                    </div>
                    <Button type="button" onClick={submit} disabled={submitting || (proposals?.some(fix => fix.feeError) ?? false)} data-testid="button-submit-fixes" style={{ backgroundColor: "#EA580C", color: "#FFFFFF", borderColor: "#EA580C" }}>
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit Proposed Changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {rows && analysisStep === 2 && (
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-3 border-b text-sm font-semibold">Invoices ({shownRows?.length ?? 0} rows{usedRange ? `, ${usedRange}` : ""}, {STEP_TWO_DETAIL})</div>
            <div className="overflow-auto max-h-[500px]">
              <table className="text-xs w-full" data-testid="table-invoices">
                <thead className="sticky top-0">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-20 w-0 px-2 py-2 whitespace-nowrap border-r bg-white" style={depositHead}>Proposed deposit</th>
                    <th rowSpan={2} className="text-right px-3 py-2 whitespace-nowrap bg-white">#</th>
                    <th colSpan={INVOICE_COLUMNS.length} className="text-left px-3 py-2 whitespace-nowrap" style={invoiceHead}>Invoice</th>
                    <th colSpan={PAYMENT_COLUMNS.length} className="text-left px-3 py-2 whitespace-nowrap" style={paymentHead}>Payment</th>
                  </tr>
                  <tr>
                    {INVOICE_COLUMNS.map(heading => (
                      <th key={`invoice-${heading}`} className="text-left px-3 py-2 whitespace-nowrap" style={invoiceHead}>{heading}</th>
                    ))}
                    {PAYMENT_COLUMNS.map(heading => (
                      <th key={`payment-${heading}`} className="text-left px-3 py-2 whitespace-nowrap" style={paymentHead}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(shownRows?.length ?? 0) === 0 ? (
                    <tr><td className="px-3 py-4 text-muted-foreground" colSpan={INVOICE_COLUMNS.length + PAYMENT_COLUMNS.length + 2}>No payments in Undeposited Funds are missing a deposit.</td></tr>
                  ) : shownRows?.map((r, i) => {
                    const depositId = proposedDeposit(r.paymentId)
                    return (
                    <tr key={`${r.paymentId}-${r.id}-${r.linkId}-${i}`} className="border-t">
                      <td className="sticky left-0 z-10 w-0 px-2 py-1.5 whitespace-nowrap border-r" style={depositCell}>
                        <select
                          className="h-8 w-[9.5rem] rounded-md border bg-background px-1.5 text-xs"
                          value={(openDeposits ?? []).some(deposit => deposit.id === depositId) ? depositId : ""}
                          onChange={e => setChosenDeposit(current => ({ ...current, [r.paymentId]: e.target.value }))}
                          disabled={openDeposits == null}
                          data-testid={`select-proposed-deposit-${r.paymentId}`}
                        >
                          <option value="">—</option>
                          {(openDeposits ?? []).map(deposit => (
                            <option key={deposit.id} value={deposit.id}>{deposit.id}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums bg-white">{i + 1}</td>
                      <GroupCells group="invoice" row={r} />
                      <GroupCells group="payment" row={r} />
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="px-5 py-3 border-b text-sm font-semibold">Deposits without a payment ({stepTwoBusy || openDeposits == null ? "…" : new Set(suggestions.map(item => item.deposit.id)).size})</div>
            <div className="overflow-auto max-h-[500px]">
              <table className="text-xs w-full" data-testid="table-unlinked-deposits">
                <thead className="sticky top-0">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 z-20 text-right px-3 py-2 whitespace-nowrap border-r bg-white">#</th>
                    <th colSpan={7} className="text-left px-3 py-2 whitespace-nowrap" style={depositHead}>Deposit</th>
                    <th colSpan={5} className="text-left px-3 py-2 whitespace-nowrap" style={invoiceHead}>Saved transaction</th>
                    <th colSpan={6} className="text-left px-3 py-2 whitespace-nowrap" style={matchHead}>Potential payment match</th>
                  </tr>
                  <tr>
                    {["Id", "TxnDate", "TotalAmt", "ToAccountRef", "ToAccountRef Name", "Lines", "Customer"].map(heading => (
                      <th key={heading} className="text-left px-3 py-2 whitespace-nowrap" style={depositHead}>{heading}</th>
                    ))}
                    {["Deposit ID", "Date", "amount_total", "amount_fee", "amount_net"].map(heading => (
                      <th key={heading} className="text-left px-3 py-2 whitespace-nowrap" style={invoiceHead}>{heading}</th>
                    ))}
                    {["DepositToAccountRef", "TotalAmt", "Id", "TxnDate", "Why", "Likelihood"].map(heading => (
                      <th key={heading} className="text-left px-3 py-2 whitespace-nowrap" style={{ ...matchHead, width: heading === "DepositToAccountRef" || heading === "Why" ? "22ch" : undefined }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stepTwoBusy || openDeposits == null ? (
                    <tr><td className="px-3 py-4 text-muted-foreground" colSpan={19}>Looking up deposits…</td></tr>
                  ) : suggestions.length === 0 ? (
                    <tr><td className="px-3 py-4 text-muted-foreground" colSpan={19}>No deposits in this period are missing a payment.</td></tr>
                  ) : suggestions.map((item, index) => (
                    <tr key={`${item.deposit.id}-${item.outside?.transactionId ?? "none"}-${index}`} className="border-t" data-testid={`unlinked-deposit-${item.deposit.id}`}>
                      <td className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap text-right tabular-nums border-r bg-white">{index + 1}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.id}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.txnDate}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={depositCell}>{formatCurrency(item.deposit.total)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.accountId}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.accountName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.lineAmounts.map(amount => formatCurrency(amount)).join(", ")}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={depositCell}>{item.deposit.customerNames.join(", ")}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{item.outside?.depositId ?? ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={invoiceCell}>{item.outside?.date ?? ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={invoiceCell}>{item.outside ? formatCurrency(item.outside.amountTotal) : ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={invoiceCell}>{item.outside?.amountFee == null ? "" : formatCurrency(item.outside.amountFee)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={invoiceCell}>{item.outside?.amountNet == null ? "" : formatCurrency(item.outside.amountNet)}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...matchCell, width: "22ch", minWidth: "22ch" }}>{item.payment?.depositAccount ?? ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={matchCell}>{item.payment ? formatCurrency(item.payment.total) : ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={matchCell}>{item.payment?.paymentId ?? ""}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={matchCell}>{item.payment?.txnDate ?? ""}</td>
                      <td className="px-3 py-1.5 whitespace-normal" style={{ ...matchCell, width: "22ch", minWidth: "22ch" }}>{item.reason}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums" style={matchCell}>{item.likelihood == null ? "" : `${item.likelihood}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {rows && analysisStep !== 2 && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold">{chain === "deposit" ? "Deposits" : "Invoices"} ({shownRows?.length ?? 0} rows{usedRange ? `, ${usedRange}` : ""}{analysisStep === 1 ? `, ${STEP_ONE_DETAIL}` : missingOnly ? ", missing three way match" : ""})</div>
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full" data-testid="table-invoices">
              <thead className="sticky top-0">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 text-right px-3 py-2 whitespace-nowrap border-r bg-white">#</th>
                  {visibleGroups.map(group => (
                    <th key={group} colSpan={groupColumns(group).length} className="text-left px-3 py-2 whitespace-nowrap" style={groupHead(group)}>{GROUP_TITLES[group]}</th>
                  ))}
                </tr>
                <tr>
                  {visibleGroups.flatMap(group => groupColumns(group).map(h => (
                    <th key={`${group}-${h}`} className="text-left px-3 py-2 whitespace-nowrap" style={groupHead(group)}>{h}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {shownRows?.length === 0 ? (
                  <tr><td className="px-3 py-4 text-muted-foreground" colSpan={visibleGroups.reduce((count, group) => count + groupColumns(group).length, 1)}>{missingOnly ? "Every pulled row has its match." : `No ${chain === "deposit" ? "deposits" : "invoices"} in this period.`}</td></tr>
                ) : shownRows?.map((r, i) => (
                  <tr key={`${r.depositId}-${r.paymentId}-${r.id}-${r.linkId}-${i}`} className="border-t">
                    <td className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap text-right tabular-nums border-r bg-white">{i + 1}</td>
                    {visibleGroups.map(group => <GroupCells key={group} group={group} row={r} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t flex gap-8 text-sm" data-testid="duplicate-check">
            <span>{chain === "deposit" ? "Deposits" : "Invoices"} <span className="font-semibold tabular-nums">{invoiceCount ?? 0}</span></span>
            <span>Rows <span className="font-semibold tabular-nums">{rows.length}</span></span>
            <span>Difference <span className="font-semibold tabular-nums" style={{ color: rows.length - (invoiceCount ?? 0) === 0 ? "#FFFFFF" : "#FF0000", backgroundColor: rows.length - (invoiceCount ?? 0) === 0 ? "#111827" : "transparent", padding: "0 6px" }}>{rows.length - (invoiceCount ?? 0)}</span></span>
          </div>
        </Card>
      )}
      {proposals && (
        <Card className="border-4 border-[#C5D0E0]">
          <div className="overflow-auto" data-testid="proposed-fixes">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th rowSpan={2} className="w-0 px-2 py-2 whitespace-nowrap text-left" style={depositHead}>Charge account</th>
                  <th colSpan={5} className="text-left px-3 py-2 whitespace-nowrap" style={paymentHead}>Proposed Payment Update</th>
                  <th colSpan={8} className="text-left px-3 py-2 whitespace-nowrap" style={depositHead}>Proposed Updated Deposit</th>
                </tr>
                <tr>
                  {["Original DepositToAccountRef", "Proposed DepositToAccountRef", "TotalAmt", "Id", "TxnDate", "Id", "TxnDate", "TotalAmt", "ToAccountRef", "ToAccountRef Name", "Line Amount", "LinkedTxn Id", "LinkedTxn Type"].map((heading, index) => (
                    <th key={`${heading}-${index}`} className="text-left px-3 py-2 whitespace-nowrap" style={index < 5 ? paymentHead : depositHead}>{heading}</th>
                  ))}
                </tr>
              </thead>
              {proposals.map(fix => {
                const chargeAccount = chargeAccounts[fix.paymentId] || BANK_CHARGES_ACCOUNT
                const chargeName = accounts.find(account => account.id === chargeAccount)?.name ?? (chargeAccount === BANK_CHARGES_ACCOUNT ? "Bank Charges" : chargeAccount)
                const feeNumber = Number(fix.feeAmount.replace(/[^0-9.-]/g, ""))
                const grouped = Boolean(fix.feeAmount || fix.feeError)
                const edge = (edgeName: "top" | "bottom" | "left" | "right") => grouped ? { [`border${edgeName[0].toUpperCase()}${edgeName.slice(1)}`]: "2px solid #D1D5DB" } : {}
                return (
                  <Fragment key={fix.paymentId}>
                  <tbody data-testid={`proposal-group-${fix.paymentId}`}>
                    <tr>
                      <td className="w-0 px-2 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top"), ...edge("left") }} />
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...paymentCell, ...edge("top") }}>{fix.originalAccount}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...paymentCell, ...edge("top") }}>{fix.proposedAccount}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={{ ...paymentCell, ...edge("top") }}>{fix.totalAmt}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...paymentCell, ...edge("top") }}>{fix.paymentId}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...paymentCell, ...edge("top") }}>{fix.txnDate}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top") }}>{fix.depositId}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top") }}>{fix.txnDate}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={{ ...depositCell, ...edge("top") }}>{fix.depositTotal || fix.totalAmt}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top") }}>{fix.depositToAccountRef}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top") }}>{fix.depositToAccountRefName}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={{ ...depositCell, ...edge("top") }}>{fix.lineAmount}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top") }}>{fix.linkedTxnId}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("top"), ...edge("right"), ...(!fix.feeAmount && !fix.feeError ? edge("bottom") : {}) }}>{fix.linkedTxnType}</td>
                    </tr>
                    {fix.feeAmount && (
                      <tr>
                        <td className="w-0 px-2 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("left"), ...edge("bottom") }}>
                          <select
                            className="h-8 w-[11rem] rounded-md border bg-background px-1.5 text-xs"
                            value={accounts.some(account => account.id === chargeAccount) ? chargeAccount : BANK_CHARGES_ACCOUNT}
                            onChange={e => setChargeAccounts(current => ({ ...current, [fix.paymentId]: e.target.value }))}
                            data-testid={`select-charge-account-${fix.paymentId}`}
                          >
                            {accounts.length === 0 && <option value={BANK_CHARGES_ACCOUNT}>Bank Charges</option>}
                            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5" style={edge("bottom")} />
                        <td className="px-3 py-1.5" style={edge("bottom")} />
                        <td className="px-3 py-1.5" style={edge("bottom")} />
                        <td className="px-3 py-1.5" style={edge("bottom")} />
                        <td className="px-3 py-1.5" style={edge("bottom")} />
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom") }}>{fix.depositId}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom") }}>{fix.txnDate}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={{ ...depositCell, ...edge("bottom") }}>{fix.depositTotal}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom") }}>{chargeAccount}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom") }}>{chargeName}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={{ ...depositCell, ...edge("bottom") }}>{Number.isFinite(feeNumber) ? formatCurrency(-Math.abs(feeNumber)) : fix.feeAmount}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom") }} />
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ ...depositCell, ...edge("bottom"), ...edge("right") }}>Bank Charges</td>
                      </tr>
                    )}
                    {fix.feeError && (
                      <tr>
                        <td colSpan={14} className="px-3 py-1.5 text-rose-600" style={{ ...edge("bottom"), ...edge("left"), ...edge("right") }}>{fix.feeError}</td>
                      </tr>
                    )}
                  </tbody>
                  {grouped && <tbody aria-hidden="true"><tr><td colSpan={14} className="h-3 border-0 p-0" /></tr></tbody>}
                  </Fragment>
                )
              })}
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
