import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"
import { depositIdsOf, isPayment, loadDepositCleared, loadDeposits, loadPayments, paymentIdsOf, reviewRows, storeDocuments, type ReviewRow } from "@/lib/invoice-chain"
import { invoiceIdsOf, loadInvoices, paymentIdsOfDeposits, reviewDepositRows } from "@/lib/deposit-chain"
import { qbList, qbQuery, qbQuote } from "@/lib/qb"

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
function macroRange(name: string, today: Date, fiscalStartMonth: number) {
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
  const [customerId, setCustomerId] = useState("")
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState("")
  const customerBox = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    qbQuery("SELECT Id, DisplayName FROM Customer MAXRESULTS 1000")
      .then(d => {
        const list = qbList<{ Id: string; DisplayName?: string }>(d, "Customer")
        setCustomers(list.map(c => ({ id: String(c.Id), name: String(c.DisplayName ?? c.Id) })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load customers"))
    qbQuery("SELECT * FROM CompanyInfo")
      .then(d => {
        const info = qbList<{ FiscalYearStartMonth?: string }>(d, "CompanyInfo")[0]
        const n = Number(info?.FiscalYearStartMonth)
        if (n >= 1 && n <= 12) setFiscalStart(n)
      })
      .catch(() => {})
  }, [])

  const customer = customers.find(c => c.id === customerId)
  const customerReady = kind === "invoice" || kind === "payment" || kind === "deposit"
  const shownCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter(c => `${c.name} ${c.id}`.toLowerCase().includes(needle))
  }, [customers, customerQuery])

  useEffect(() => {
    if (!customerOpen) return
    const close = (event: MouseEvent) => {
      if (!customerBox.current?.contains(event.target as Node)) setCustomerOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [customerOpen])

  const showPayments = chain === "deposit" || (rows?.some(r => isPayment(r.linkType)) ?? false)
  const showDeposits = chain === "deposit" || (rows?.some(r => r.depositId) ?? false)
  const groups: ChainGroup[] = chain === "deposit" ? ["deposit", "payment", "invoice"] : ["invoice", "payment", "deposit"]
  const visibleGroups = groups.filter(group => group === "invoice" || (group === "payment" ? showPayments : showDeposits))
  const shownRows = useMemo(() => {
    if (!rows || !missingOnly) return rows
    const open = rows.filter(row => row.depositCleared.trim().toUpperCase() !== "R")
    if (chain === "deposit") return open.filter(row => !row.paymentId || !row.id)
    return open.filter(row => row.paymentId && !row.depositId)
  }, [rows, missingOnly, chain])

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
        setRows(reviewDepositRows(storedDeposits, payments, invoices, customerId, cleared))
        const notes = [
          list.length === 1000 ? "QuickBooks returned 1000 deposits, so later ones are not in this list." : "",
        ].filter(Boolean)
        if (notes.length > 0) setNotice(notes.join(" "))
        return
      }
      if (customerId) where.push(`CustomerRef = '${qbQuote(customerId)}'`)
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
          <div className="grid md:grid-cols-2 gap-4">
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
                  <span className="truncate">{customer ? `${customer.name} (${customer.id})` : customerReady ? "All customers" : "Select a transaction type first"}</span>
                  <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                </Button>
                {customerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-md">
                    <Input autoFocus placeholder="Search customers…" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} data-testid="input-customer-search" />
                    <div className="mt-2 max-h-64 overflow-auto">
                      {customers.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading customers…</p> : (
                        <>
                          <button type="button" className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setCustomerId(""); setCustomerOpen(false); setRows(null) }}>All customers</button>
                          {shownCustomers.map(c => (
                            <button type="button" key={c.id} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setCustomerId(c.id); setCustomerOpen(false); setRows(null) }}>
                              {c.name} <span className="text-muted-foreground">({c.id})</span>
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
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {rows && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold">{chain === "deposit" ? "Deposits" : "Invoices"} ({shownRows?.length ?? 0} rows{usedRange ? `, ${usedRange}` : ""}{missingOnly ? ", missing three way match" : ""})</div>
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
    </div>
  )
}
