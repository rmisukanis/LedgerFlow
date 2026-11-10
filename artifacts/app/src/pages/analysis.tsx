import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"

const RUN = `${import.meta.env.BASE_URL}api/qb/explorer/run`
const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "w-full h-10 rounded-md border bg-background px-3 text-sm"

const TYPES = [
  { id: "invoice", label: "Invoice" },
  { id: "payment", label: "Payment" },
  { id: "deposit", label: "Deposit" },
] as const

type TxnKind = (typeof TYPES)[number]["id"]

interface Customer { id: string; name: string }
interface Link { id: string; type: string }
interface InvoiceRow {
  id: string
  docNumber: string
  linkId: string
  linkType: string
  customerId: string
  customerName: string
  total: string
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

// QuickBooks report date_macro values, turned into TxnDate bounds. The Invoice query has no date_macro parameter.
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
const q = (s: string) => s.replace(/'/g, "\\'")

async function qbGet(path: string, query: string) {
  const r = await fetch(RUN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "GET", path, query }),
  })
  const j = await r.json()
  if (!r.ok || j.status >= 300) throw new Error(j.data?.Fault?.Error?.[0]?.Detail ?? j.data?.detail ?? j.error ?? "QuickBooks request failed")
  return j.data as Record<string, unknown>
}

function linksOf(inv: Record<string, unknown>): Link[] {
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
  add(inv.LinkedTxn)
  for (const line of Array.isArray(inv.Line) ? inv.Line : []) add((line as { LinkedTxn?: unknown }).LinkedTxn)
  return out
}

function invoiceRows(raw: Record<string, unknown>[]): InvoiceRow[] {
  const rows: InvoiceRow[] = []
  for (const inv of raw) {
    const customer = (inv.CustomerRef as { value?: string; name?: string } | undefined) ?? {}
    const total = formatCurrency(Number(inv.TotalAmt ?? 0))
    const base = {
      id: String(inv.Id ?? ""),
      docNumber: String(inv.DocNumber ?? ""),
      customerId: String(customer.value ?? ""),
      customerName: String(customer.name ?? ""),
      total,
    }
    const links = linksOf(inv)
    if (links.length === 0) rows.push({ ...base, linkId: "", linkType: "" })
    else for (const link of links) rows.push({ ...base, linkId: link.id, linkType: link.type })
  }
  return rows
}

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
  const [rows, setRows] = useState<InvoiceRow[] | null>(null)

  useEffect(() => {
    qbGet("/query", new URLSearchParams({ query: "SELECT Id, DisplayName FROM Customer MAXRESULTS 1000" }).toString())
      .then(d => {
        const list = ((d.QueryResponse as Record<string, unknown>)?.Customer as { Id: string; DisplayName?: string }[]) ?? []
        setCustomers(list.map(c => ({ id: String(c.Id), name: String(c.DisplayName ?? c.Id) })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load customers"))
    qbGet("/query", new URLSearchParams({ query: "SELECT * FROM CompanyInfo" }).toString())
      .then(d => {
        const info = ((d.QueryResponse as Record<string, unknown>)?.CompanyInfo as { FiscalYearStartMonth?: string }[])?.[0]
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
    setUsedRange("")
    try {
      if (kind !== "invoice") {
        setError(`${kind === "payment" ? "Payment" : "Deposit"} results are not wired up yet.`)
        return
      }
      const where: string[] = []
      if (period.start) where.push(`TxnDate >= '${q(period.start)}'`)
      if (period.end) where.push(`TxnDate <= '${q(period.end)}'`)
      if (where.length === 0) throw new Error("Choose a month, a start or end date, or a date macro.")
      setUsedRange([period.start, period.end].filter(Boolean).join(" to "))
      if (customerId) where.push(`CustomerRef = '${q(customerId)}'`)
      const query = `SELECT * FROM Invoice WHERE ${where.join(" AND ")} ORDERBY TxnDate DESC MAXRESULTS 1000`
      const data = await qbGet("/query", new URLSearchParams({ query }).toString())
      const list = ((data.QueryResponse as Record<string, unknown>)?.Invoice as Record<string, unknown>[]) ?? []
      setRows(invoiceRows(list))
      if (list.length === 1000) setNotice(prev => [prev, "QuickBooks returned 1000 invoices, so later ones are not in this list."].filter(Boolean).join(" "))
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
                <Button variant="outline" onClick={pull} disabled={!kind || busy} data-testid="button-pull">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull QuickBooks Register
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
              <div className="space-y-1.5"><label className={label}>start_date</label><DateField onIso={x => { setStartDate(x); setRows(null) }} testId="analysis-start_date" /></div>
              <div className="space-y-1.5"><label className={label}>end_date</label><DateField onIso={x => { setEndDate(x); setRows(null) }} testId="analysis-end_date" /></div>
              <div className="space-y-1.5">
                <label className={label}>date_macro</label>
                <select className={selectCls} value={macro} onChange={e => { setMacro(e.target.value); setRows(null) }} data-testid="analysis-date_macro">
                  <option value="">— not set —</option>
                  {DATE_MACROS.map(m => <option key={m} value={m}>{m}</option>)}
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
          <div className="px-5 py-3 border-b text-sm font-semibold">Invoices ({rows.length} rows{usedRange ? `, ${usedRange}` : ""})</div>
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full" data-testid="table-invoices">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {["Id", "DocNumber", "LinkedTxn Id", "LinkedTxn Type", "Customer Id", "Customer Name", "Total"].map(h => (
                    <th key={h} className="text-left px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="px-3 py-4 text-muted-foreground" colSpan={7}>No invoices in this period.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.id}-${r.linkType}-${r.linkId}-${i}`} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.id}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.docNumber}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.linkId}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.linkType}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.customerId}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.customerName}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
