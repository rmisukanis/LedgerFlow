import { useEffect, useMemo, useState } from "react"
import { Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { fmtDate } from "@/lib/dates"
import { reportToTable, downloadCsv } from "@/lib/report"
import { MONTHS, defaultPeriod, ledgerQuery, monthWindow, omitReconciled, yearOptions } from "@/lib/reconcile-period"

const RUN = `${import.meta.env.BASE_URL}api/qb/explorer/run`
const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "w-full h-10 rounded-md border bg-background px-3 text-sm"

interface Account { id: string; name: string; type: string }
interface Line { date: string; desc: string; cents: number; ref?: string }

// ---- parsing helpers ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cur); cur = ""
      if (row.some(v => v.trim() !== "")) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some(v => v.trim() !== "")) rows.push(row)
  return rows
}

function parseDate(s: string): string | null {
  const t = s.trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function parseCents(s: string): number | null {
  let t = s.trim()
  if (!t) return null
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-") || /DR$/i.test(t)
  t = t.replace(/[^0-9.]/g, "")
  if (!t) return null
  const n = Math.round(Number(t) * 100)
  return Number.isNaN(n) ? null : neg ? -n : n
}

const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000
const money = (cents: number) => formatCurrency(cents / 100)

interface Result {
  matched: { s: Line; r: Line }[]
  stmtOnly: Line[]
  booksOnly: Line[]
  stmtTotal: number
  booksTotal: number
}

function reconcile(stmt: Line[], books: Line[], tol: number, from: string, to: string): Result {
  const free = books.map(b => ({ b, used: false }))
  const matched: Result["matched"] = []
  const stmtOnly: Line[] = []
  for (const s of [...stmt].sort((a, b) => a.date.localeCompare(b.date))) {
    let best = -1, bestDiff = Infinity
    free.forEach((f, i) => {
      if (f.used || f.b.cents !== s.cents) return
      const diff = Math.abs(dayNum(f.b.date) - dayNum(s.date))
      if (diff <= tol && diff < bestDiff) { best = i; bestDiff = diff }
    })
    if (best >= 0) { free[best].used = true; matched.push({ s, r: free[best].b }) } else stmtOnly.push(s)
  }
  const booksOnly = free.filter(f => !f.used && f.b.date >= from && f.b.date <= to).map(f => f.b)
  return {
    matched, stmtOnly, booksOnly,
    stmtTotal: stmt.reduce((a, l) => a + l.cents, 0),
    // QuickBooks side = every line matched to the statement (even if dated slightly outside the statement's range) + unmatched lines inside the range
    booksTotal: matched.reduce((a, m) => a + m.r.cents, 0) + booksOnly.reduce((a, l) => a + l.cents, 0),
  }
}

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

type RptRow = { type?: string; ColData?: { value: string }[]; Rows?: { Row?: RptRow[] } }
// Reads rows by column key (QuickBooks returns columns in its own fixed order, not the order requested).
function collect(rows: RptRow[] | undefined, keys: string[], out: Line[]) {
  const at = (c: string[], k: string) => c[keys.indexOf(k)] ?? ""
  for (const r of rows ?? []) {
    if (r.type === "Data" && r.ColData) {
      const c = r.ColData.map(x => x.value)
      const raw = at(c, "tx_date")
      const date = parseDate(raw)
      const cents = parseCents(at(c, "subt_nat_amount"))
      if (date && /^\d{4}-/.test(raw) && cents !== null) {
        out.push({ date, desc: [at(c, "txn_type"), at(c, "name"), at(c, "memo")].filter(Boolean).join(" · "), cents, ref: at(c, "doc_num") || undefined })
      }
    }
    collect(r.Rows?.Row, keys, out)
  }
}

const REGISTER_KEYS = ["tx_date", "txn_type", "split_acc", "account_name", "subt_nat_amount", "rbal_nat_amount", "is_cleared"]

export default function ReconcilePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState("")
  const [table, setTable] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState("")
  const [cols, setCols] = useState({ date: -1, desc: -1, amount: -1, debit: -1, credit: -1 })
  const [flip, setFlip] = useState(false)
  const [tol, setTol] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [month, setMonth] = useState(() => defaultPeriod().month)
  const [year, setYear] = useState(() => defaultPeriod().year)
  const [notReconciled, setNotReconciled] = useState(false)
  const [register, setRegister] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    qbGet("/query", new URLSearchParams({ query: "SELECT Id, Name, AccountType FROM Account WHERE AccountType IN ('Bank', 'Credit Card') MAXRESULTS 200" }).toString())
      .then(d => {
        const rows = ((d.QueryResponse as Record<string, unknown>)?.Account as Record<string, string>[]) ?? []
        setAccounts(rows.map(r => ({ id: r.Id, name: r.Name, type: r.AccountType })))
      })
      .catch(e => setError(e.message))
  }, [])

  const headers = table?.[0] ?? []

  const onFile = async (f: File) => {
    setResult(null); setError(null)
    const rows = parseCsv(await f.text())
    if (rows.length < 2) { setError("The CSV needs a header row and at least one data row."); return }
    setTable(rows)
    setFileName(f.name)
    const find = (re: RegExp) => rows[0].findIndex(h => re.test(h))
    setCols({
      date: find(/date/i),
      desc: find(/desc|memo|payee|detail|narrat|name/i),
      amount: find(/^amount$|amount/i),
      debit: find(/debit|withdraw|paid out|money out/i),
      credit: find(/credit|deposit|paid in|money in/i),
    })
  }

  const stmtLines = useMemo(() => {
    if (!table || cols.date < 0) return { lines: [] as Line[], skipped: 0 }
    const lines: Line[] = []
    let skipped = 0
    for (const r of table.slice(1)) {
      const date = parseDate(r[cols.date] ?? "")
      let cents: number | null = null
      if (cols.amount >= 0) cents = parseCents(r[cols.amount] ?? "")
      else {
        const d = cols.debit >= 0 ? parseCents(r[cols.debit] ?? "") : null
        const c = cols.credit >= 0 ? parseCents(r[cols.credit] ?? "") : null
        if (d !== null || c !== null) cents = Math.abs(c ?? 0) - Math.abs(d ?? 0)
      }
      if (!date || cents === null) { skipped++; continue }
      lines.push({ date, desc: cols.desc >= 0 ? (r[cols.desc] ?? "").trim() : "", cents: flip ? -cents : cents })
    }
    return { lines, skipped }
  }, [table, cols, flip])

  // The selected month is the register window: first day through last day. is_cleared is on the query.
  const fetchGl = async () => qbGet("/reports/GeneralLedger", ledgerQuery(accountId, year, month).toString())

  const pull = async () => {
    if (!accountId) return
    setBusy(true); setError(null); setRegister(null)
    try {
      setRegister(await fetchGl())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not pull the register")
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    const { lines } = stmtLines
    if (!accountId || lines.length === 0) return
    setBusy(true); setError(null); setResult(null)
    try {
      const { start, end } = monthWindow(year, month)
      const d = await fetchGl()
      setRegister(d)
      const view = omitReconciled(d, notReconciled)
      const keys = ((view.Columns as { Column?: { MetaData?: { Name: string; Value: string }[] }[] } | undefined)?.Column ?? [])
        .map(c => c.MetaData?.find(m => m.Name === "ColKey")?.Value ?? "")
      const books: Line[] = []
      collect((view.Rows as { Row?: RptRow[] } | undefined)?.Row, keys, books)
      setResult(reconcile(lines, books, tol, start, end))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconciliation failed")
    } finally {
      setBusy(false)
    }
  }

  const visibleRegister = useMemo(() => (register ? omitReconciled(register, notReconciled) : null), [register, notReconciled])
  const regTable = useMemo(() => (visibleRegister ? reportToTable(visibleRegister, REGISTER_KEYS, REGISTER_KEYS) : null), [visibleRegister])
  const years = yearOptions(new Date(), year)

  const colSelect = (key: keyof typeof cols, text: string) => (
    <div className="space-y-1.5">
      <label className={label}>{text}</label>
      <select className={selectCls} value={cols[key]} onChange={e => { setCols(c => ({ ...c, [key]: Number(e.target.value) })); setResult(null) }}>
        <option value={-1}>— none —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  )

  const diff = result ? result.stmtTotal - result.booksTotal : 0
  const clean = result && result.stmtOnly.length === 0 && result.booksOnly.length === 0

  const lineTable = (title: string, lines: Line[], empty: string) => (
    <Card>
      <div className="px-5 py-3 border-b text-sm font-semibold">{title} ({lines.length})</div>
      {lines.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{empty}</p> : (
        <table className="w-full text-sm">
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-5 py-2 font-mono text-xs w-[110px]">{fmtDate(l.date)}</td>
                <td className="px-2 py-2">{l.desc}{l.ref && <span className="text-muted-foreground"> #{l.ref}</span>}</td>
                <td className={`px-5 py-2 text-right tabular-nums ${l.cents < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(l.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h1>
        <p className="text-muted-foreground mt-1">Upload a CSV bank statement, pick the QuickBooks bank account, and check that the two agree.</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={label}>1. Bank account (QuickBooks register)</label>
              <select className={selectCls} value={accountId} onChange={e => { setAccountId(e.target.value); setResult(null) }} data-testid="select-bank-account">
                <option value="">{accounts.length ? "Select account" : "Loading…"}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) · {a.type}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={label}>2. Bank statement (CSV)</label>
              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-md border text-sm font-medium cursor-pointer hover:bg-muted">
                <Upload className="w-4 h-4" />{fileName || "Choose CSV file"}
                <input type="file" accept=".csv,text/csv" className="hidden" data-testid="input-statement"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = "" }} />
              </label>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <label className={label}>Statement period</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
              <div className="space-y-1.5">
                <label className={label}>Month</label>
                <select className={selectCls} value={month} data-testid="select-month" onChange={e => { setMonth(Number(e.target.value)); setResult(null); setRegister(null) }}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Year</label>
                <select className={selectCls} value={year} data-testid="select-year" onChange={e => { setYear(Number(e.target.value)); setResult(null); setRegister(null) }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>&nbsp;</label>
                <label className="flex items-center gap-2 h-10 text-sm">
                  <input type="checkbox" checked={notReconciled} data-testid="checkbox-not-reconciled" onChange={e => { setNotReconciled(e.target.checked); setResult(null) }} />
                  Not Reconciled
                </label>
              </div>
              <div className="space-y-1.5">
                <label className={label}>&nbsp;</label>
                <Button variant="outline" onClick={pull} disabled={!accountId || busy} data-testid="button-pull">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull QuickBooks Register
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The pull covers the first day through the last day of the selected month. Not Reconciled leaves out transactions whose QuickBooks is_cleared value is R. Statement lines still match register lines by amount and date tolerance inside that month.</p>
          </div>

          {table && (
            <div className="space-y-3 border-t pt-4">
              <label className={label}>3. Match the statement columns</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {colSelect("date", "Date")}
                {colSelect("desc", "Description")}
                {colSelect("amount", "Amount (signed)")}
                {colSelect("debit", "Money out (debit)")}
                {colSelect("credit", "Money in (credit)")}
              </div>
              <p className="text-xs text-muted-foreground">
                Use either one Amount column (withdrawals negative) or separate money out / money in columns.
                {" "}{stmtLines.lines.length} lines read{stmtLines.skipped > 0 && `, ${stmtLines.skipped} skipped (no valid date or amount)`}.
              </p>
              <div className="flex flex-wrap items-center gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={flip} onChange={e => { setFlip(e.target.checked); setResult(null) }} />Flip signs (statement shows withdrawals as positive)</label>
                <label className="flex items-center gap-2">Date tolerance
                  <Input type="number" min={0} max={30} value={tol} className="w-20 h-9"
                    onChange={e => { setTol(Math.max(0, Math.min(30, Number(e.target.value) || 0))); setResult(null) }} /> days
                </label>
              </div>
              <Button onClick={run} disabled={!accountId || stmtLines.lines.length === 0 || busy} data-testid="button-reconcile">
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Reconcile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {regTable && (
        <Card>
          <div className="px-5 py-3 border-b flex items-center gap-3">
            <span className="text-sm font-semibold">QuickBooks register ({regTable.rows.length} rows)</span>
            <Button size="sm" onClick={() => downloadCsv(regTable)} data-testid="button-export-register">Export CSV</Button>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full" data-testid="table-register">
              <thead className="sticky top-0 bg-muted"><tr>{regTable.head.map((h, i) => <th key={i} className="text-left px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>{regTable.rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {result && (
        <>
          <Card className={clean && diff === 0 ? "border-emerald-300" : "border-amber-300"}>
            <CardContent className="p-5 space-y-3" data-testid="reconcile-summary">
              <div className="flex items-center gap-2">
                {clean && diff === 0
                  ? <Badge className="bg-emerald-600"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Reconciled</Badge>
                  : <Badge className="bg-amber-500"><AlertTriangle className="w-3.5 h-3.5 mr-1" />Differences found</Badge>}
                <span className="text-sm text-muted-foreground">{result.matched.length} matched</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><div className={label}>Statement net</div><div className="text-lg font-semibold tabular-nums">{money(result.stmtTotal)}</div></div>
                <div><div className={label}>QuickBooks net</div><div className="text-lg font-semibold tabular-nums">{money(result.booksTotal)}</div></div>
                <div><div className={label}>Difference</div><div className={`text-lg font-semibold tabular-nums ${diff === 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(diff)}</div></div>
                <div><div className={label}>Unmatched</div><div className="text-lg font-semibold">{result.stmtOnly.length} stmt · {result.booksOnly.length} books</div></div>
              </div>
            </CardContent>
          </Card>
          {lineTable("On the statement, not in QuickBooks", result.stmtOnly, "Every statement line was found in QuickBooks.")}
          {lineTable("In QuickBooks, not on the statement", result.booksOnly, "Every QuickBooks transaction in this period is on the statement.")}
          {lineTable("Matched", result.matched.map(m => ({ ...m.s, desc: `${m.s.desc}  ↔  ${m.r.desc} (${fmtDate(m.r.date)})` })), "Nothing matched.")}
        </>
      )}
    </div>
  )
}
