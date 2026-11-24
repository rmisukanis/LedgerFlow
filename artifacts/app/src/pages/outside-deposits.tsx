import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"
import { macroRange } from "@/pages/analysis"
import { formatCurrency } from "@/lib/utils"

const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "h-10 min-w-56 rounded-md border bg-background px-3 text-sm"
const filterCls = "h-9 w-full rounded-md border bg-background px-2 text-sm"

const VENMO_COLUMNS = [
  "transaction_id",
  "standard_transfer_id",
  "date",
  "time_utc",
  "type",
  "status",
  "from_party",
  "to_party",
  "note_invoice",
  "amount_total",
  "amount_fee",
  "amount_net",
  "funding_source",
  "destination",
] as const

const MONEY = new Set<string>(["amount_total", "amount_fee", "amount_net"])
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

const PRESET = presetPeriod()
const YEAR_OPTIONS = Array.from(new Set([PRESET.year, ...Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i)])).sort((a, b) => b - a)

type Mode = "" | "add" | "analysis"
type Template = "" | "new" | "venmo"
type Row = Record<(typeof VENMO_COLUMNS)[number], string>

interface TransferCheck {
  id: string
  date: string
  destination: string
  transferCents: number
  othersCents: number
  matched: boolean
  note: string
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cur)
      cur = ""
      if (row.some(cell => cell.trim() !== "")) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some(cell => cell.trim() !== "")) rows.push(row)
  return rows
}

function wholeId(value: string) {
  const text = value.trim()
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/)
  if (!match) return text
  const fraction = match[3] ?? ""
  const digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, "")
  const shift = Number(match[4]) - fraction.length
  if (shift >= 0) return `${match[1]}${digits}${"0".repeat(shift)}`
  const point = digits.length + shift
  if (point <= 0) return `${match[1]}0.${"0".repeat(-point)}${digits}`
  return `${match[1]}${digits.slice(0, point)}.${digits.slice(point)}`
}

function centsOf(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const amount = Number(text.replace(/[$,]/g, ""))
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100)
}

function money(cents: number) {
  return formatCurrency(cents / 100)
}

const MATCH_DAYS = 4

type QbOpenDeposit = {
  id: string
  txnDate: string
  amount: string
  accountName: string
  accountId: string
  memo: string
}

function isoOf(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`
}

function dayNumber(iso: string) {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000)
}

function matchDeposits(rows: Array<{ transaction_id: string; type: string; date: string; amount_net: string; amount_total: string }>, deposits: QbOpenDeposit[]) {
  const pairs: Array<{ transactionId: string; depositId: string; distance: number }> = []
  for (const row of rows) {
    if (row.type !== "Standard Transfer") continue
    const amount = centsOf(row.amount_net) ?? centsOf(row.amount_total)
    const iso = isoOf(row.date)
    if (amount == null || !iso) continue
    const day = dayNumber(iso)
    for (const deposit of deposits) {
      const depositAmount = centsOf(deposit.amount)
      const depositIso = isoOf(deposit.txnDate)
      if (depositAmount == null || !depositIso) continue
      const distance = Math.abs(day - dayNumber(depositIso))
      if (Math.abs(amount) === Math.abs(depositAmount) && distance <= MATCH_DAYS) {
        pairs.push({ transactionId: row.transaction_id, depositId: deposit.id, distance })
      }
    }
  }
  pairs.sort((a, b) => a.distance - b.distance || a.transactionId.localeCompare(b.transactionId) || a.depositId.localeCompare(b.depositId))
  const usedRows = new Set<string>()
  const usedDeposits = new Set<string>()
  const matched = new Map<string, string>()
  for (const pair of pairs) {
    if (usedRows.has(pair.transactionId) || usedDeposits.has(pair.depositId)) continue
    usedRows.add(pair.transactionId)
    usedDeposits.add(pair.depositId)
    matched.set(pair.transactionId, pair.depositId)
  }
  return matched
}

function readVenmo(text: string): { rows: Row[] } | { error: string } {
  const grid = parseCsv(text.replace(/^\uFEFF/, ""))
  if (grid.length < 2) return { error: "The file has no data rows." }
  const header = grid[0].map(cell => cell.trim())
  const missing = VENMO_COLUMNS.filter(name => !header.includes(name))
  if (missing.length > 0) return { error: `This Venmo file is missing ${missing.join(", ")}.` }
  const at = Object.fromEntries(VENMO_COLUMNS.map(name => [name, header.indexOf(name)])) as Record<(typeof VENMO_COLUMNS)[number], number>
  const rows = grid.slice(1).map(cells => {
    const row = Object.fromEntries(VENMO_COLUMNS.map(name => [name, String(cells[at[name]] ?? "").trim()])) as Row
    row.transaction_id = wholeId(row.transaction_id)
    row.standard_transfer_id = wholeId(row.standard_transfer_id)
    return row
  }).filter(row => row.transaction_id || row.type)
  if (rows.length === 0) return { error: "The file has no data rows." }
  return { rows }
}

function transferChecks(rows: Row[]): TransferCheck[] {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    if (!row.standard_transfer_id) continue
    groups.set(row.standard_transfer_id, [...(groups.get(row.standard_transfer_id) ?? []), row])
  }
  return [...groups.entries()].map(([id, group]) => {
    const transfers = group.filter(row => row.type === "Standard Transfer")
    const others = group.filter(row => row.type !== "Standard Transfer")
    const transfer = transfers[0]
    const transferCents = transfer ? centsOf(transfer.amount_net) : null
    const otherAmounts = others.map(row => centsOf(row.amount_net))
    const othersCents = otherAmounts.every(amount => amount != null) ? otherAmounts.reduce((sum, amount) => sum + (amount ?? 0), 0) : null
    const matched = transfers.length === 1 && transferCents != null && othersCents != null && transferCents + othersCents === 0
    const note = transfers.length === 0
      ? "No Standard Transfer uses this id."
      : transfers.length > 1
        ? "More than one Standard Transfer uses this id."
        : transferCents == null || othersCents == null
          ? "An amount_net cell is not a number."
          : matched
            ? "Standard Transfer amount_net matches the other rows."
            : `Off by ${money((transferCents ?? 0) + (othersCents ?? 0))}.`
    return {
      id,
      date: transfer?.date ?? "",
      destination: transfer?.destination ?? "",
      transferCents: transferCents ?? 0,
      othersCents: othersCents ?? 0,
      matched,
      note,
    }
  })
}

export default function OutsideDeposits() {
  const [mode, setMode] = useState<Mode>("")
  const [template, setTemplate] = useState<Template>("")
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [analysisTemplate, setAnalysisTemplate] = useState("all")
  const [analysisKind, setAnalysisKind] = useState("standard")
  const [analysisMatched, setAnalysisMatched] = useState("false")
  const [storedTemplates, setStoredTemplates] = useState<string[]>(["Venmo"])
  const [month, setMonth] = useState(PRESET.month)
  const [year, setYear] = useState(PRESET.year)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [macro, setMacro] = useState("")
  const [analysisRows, setAnalysisRows] = useState<Array<Row & { template: string; matched_in_quickbooks: string; deposit_id: string }> | null>(null)
  const [analysisRange, setAnalysisRange] = useState("")
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [qbDeposits, setQbDeposits] = useState<QbOpenDeposit[] | null>(null)
  const [qbWindow, setQbWindow] = useState("")
  const [chosenDeposit, setChosenDeposit] = useState<Record<string, string>>({})
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string[] | null>(null)
  const [sqlText, setSqlText] = useState("")
  const [sqlColumns, setSqlColumns] = useState<string[]>([])
  const [sqlRows, setSqlRows] = useState<Record<string, string>[] | null>(null)
  const period = useMemo(() => {
    if (macro) return macroRange(macro, new Date(), 1) ?? monthBounds(year, month)
    if (startDate || endDate) return { start: startDate, end: endDate }
    return monthBounds(year, month)
  }, [macro, startDate, endDate, year, month])
  const autoMatch = useMemo(() => matchDeposits(analysisRows ?? [], qbDeposits ?? []), [analysisRows, qbDeposits])
  const checks = useMemo(() => rows ? transferChecks(rows) : [], [rows])
  const ungrouped = rows?.filter(row => !row.standard_transfer_id).length ?? 0
  const matched = checks.filter(check => check.matched).length

  const chooseMode = (value: Mode) => {
    setMode(value)
    setTemplate("")
    setFileName("")
    setRows(null)
    setSaved(false)
    setError(null)
    setNotice(null)
  }

  useEffect(() => {
    if (mode !== "analysis") return
    const load = async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not load templates.")
      if (Array.isArray(body.templates) && body.templates.length > 0) setStoredTemplates(body.templates)
    }
    void load().catch(err => setError(err instanceof Error ? err.message : "Could not load templates."))
  }, [mode])

  const chooseTemplate = (value: Template) => {
    setTemplate(value)
    setFileName("")
    setRows(null)
    setError(null)
    setNotice(null)
  }

  const upload = async (file: File) => {
    setError(null)
    setNotice(null)
    setRows(null)
    setSaved(false)
    setFileName(file.name)
    const read = readVenmo(await file.text())
    if ("error" in read) {
      setError(read.error)
      return
    }
    setRows(read.rows)
  }

  const repeatedIds = () => {
    const counts = new Map<string, number>()
    for (const row of rows ?? []) counts.set(row.transaction_id, (counts.get(row.transaction_id) ?? 0) + 1)
    return [...counts.entries()].filter(([, count]) => count > 1)
  }

  const submit = async () => {
    if (!rows || rows.length === 0) return
    const repeated = repeatedIds()
    if (repeated.length > 0) {
      setNotice(null)
      setError(`These transaction ids are repeated, so nothing was saved: ${repeated.map(([id, count]) => `${id} (${count} rows)`).join(", ")}.`)
      return
    }
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "Venmo", rows }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not save the deposit file.")
      setSaved(true)
      const deposits = Number(body.deposits ?? 0)
      const transactions = Number(body.transactions ?? 0)
      setNotice(`Saved ${deposits} deposit${deposits === 1 ? "" : "s"} and ${transactions} linked transaction${transactions === 1 ? "" : "s"}. An id that is already stored is left as it is.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the deposit file.")
    } finally {
      setSubmitting(false)
    }
  }

  const pullStored = async () => {
    const statement = sqlText.trim()
    if (!statement && !period.start && !period.end) {
      setError("Choose a month, a start or end date, or a date macro.")
      return
    }
    setAnalysisBusy(true)
    setError(null)
    setNotice(null)
    setQbDeposits(null)
    setChosenDeposit({})
    try {
      if (statement) {
        const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: statement }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? "The statement could not be run.")
        setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({})
        setAnalysisRange("SQL")
        setSqlColumns(Array.isArray(body.columns) ? body.columns : [])
        setSqlRows(Array.isArray(body.rows) ? body.rows : [])
        return
      }
      setSqlRows(null)
      setSqlColumns([])
      setAnalysisRange([period.start, period.end].filter(Boolean).join(" to "))
      const params = new URLSearchParams()
      if (analysisTemplate && analysisTemplate !== "all") params.set("template", analysisTemplate)
      params.set("kind", analysisKind === "other" || analysisKind === "all" ? analysisKind : "standard")
      params.set("matched", analysisMatched === "true" || analysisMatched === "all" ? analysisMatched : "false")
      if (period.start) params.set("start", period.start)
      if (period.end) params.set("end", period.end)
      const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits?${params}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not read the saved deposits.")
      if (Array.isArray(body.templates) && body.templates.length > 0) setStoredTemplates(body.templates)
      setAnalysisRows(Array.isArray(body.rows) ? body.rows : [])
    } catch (err) {
      setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({})
      setSqlRows(null)
      setError(err instanceof Error ? err.message : "Could not read the saved deposits.")
    } finally {
      setAnalysisBusy(false)
    }
  }

  const shownDeposit = (row: { transaction_id: string; deposit_id: string }) => {
    if (Object.prototype.hasOwnProperty.call(chosenDeposit, row.transaction_id)) {
      return { id: chosenDeposit[row.transaction_id], fromAnalysis: chosenDeposit[row.transaction_id] !== "" }
    }
    const auto = autoMatch.get(row.transaction_id)
    if (auto) return { id: auto, fromAnalysis: true }
    return { id: row.deposit_id, fromAnalysis: false }
  }

  const analyze = async () => {
    if (!period.start && !period.end) {
      setError("Choose a month, a start or end date, or a date macro.")
      return
    }
    if (!analysisRows) {
      setError("Pull saved deposits before analyzing them.")
      return
    }
    setAnalyzeBusy(true)
    setError(null)
    setNotice(null)
    try {
      const params = new URLSearchParams()
      if (period.start) params.set("start", period.start)
      if (period.end) params.set("end", period.end)
      const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits/unlinked-deposits?${params}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not search QuickBooks deposits.")
      setChosenDeposit({})
      setQbDeposits(Array.isArray(body.deposits) ? body.deposits : [])
      setQbWindow([body.start, body.end].filter(Boolean).join(" to "))
    } catch (err) {
      setQbDeposits(null)
      setError(err instanceof Error ? err.message : "Could not search QuickBooks deposits.")
    } finally {
      setAnalyzeBusy(false)
    }
  }

  const submitLinks = async () => {
    const links = (analysisRows ?? []).flatMap(row => {
      const shown = shownDeposit(row)
      if (!shown.fromAnalysis || !shown.id) return []
      return [{ transactionId: row.transaction_id, depositId: shown.id }]
    })
    if (links.length === 0) {
      setLinkError(["Choose a QuickBooks deposit before submitting.", "Nothing was saved."])
      return
    }
    setLinkBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/outside-deposits/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      })
      const body = await response.json()
      if (!response.ok) {
        const lines = String(body.error ?? "Could not save the deposit links.").split("\n").filter(Boolean)
        setLinkError(lines)
        return
      }
      const savedIds = new Map(links.map(link => [link.transactionId, link.depositId]))
      setAnalysisRows(current => current?.map(row => {
        const depositId = savedIds.get(row.transaction_id)
        if (!depositId) return row
        return { ...row, matched_in_quickbooks: "true", deposit_id: depositId }
      }) ?? null)
      setChosenDeposit({})
      const transactions = Number(body.transactions ?? 0)
      setNotice(`Saved ${body.saved} linked deposit${body.saved === 1 ? "" : "s"} and ${transactions} linked transaction${transactions === 1 ? "" : "s"}.`)
    } catch (err) {
      setLinkError([err instanceof Error ? err.message : "Could not save the deposit links.", "Nothing was saved."])
    } finally {
      setLinkBusy(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outside Deposits</h1>
        <p className="text-muted-foreground mt-1">Upload a mapped deposit file and check each bank transfer against the transactions in it.</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5 w-40">
            <label className={label} htmlFor="outside-mode">Action</label>
            <select id="outside-mode" className={filterCls} value={mode} onChange={e => chooseMode(e.target.value as Mode)} data-testid="select-outside-mode">
              <option value="">Select</option>
              <option value="add">Add</option>
              <option value="analysis">Analysis</option>
            </select>
          </div>
          {mode === "analysis" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 w-36">
                  <label className={label} htmlFor="outside-analysis-template">Template</label>
                  <select id="outside-analysis-template" className={filterCls} value={analysisTemplate} onChange={e => { setAnalysisTemplate(e.target.value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="select-analysis-template">
                    <option value="all">All</option>
                    {storedTemplates.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 w-36">
                  <label className={label}>Month</label>
                  <select className={filterCls} value={month} onChange={e => { setMonth(Number(e.target.value)); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="select-outside-month">
                    {MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 w-24">
                  <label className={label}>Year</label>
                  <select className={filterCls} value={year} onChange={e => { setYear(Number(e.target.value)); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="select-outside-year">
                    {YEAR_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <Button type="button" className="ml-8" onClick={pullStored} disabled={analysisBusy || analyzeBusy} data-testid="button-pull-outside" style={{ backgroundColor: "#143DB8", color: "#FFFFFF", borderColor: "#143DB8" }}>
                  {analysisBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull saved deposits
                </Button>
                <Button type="button" onClick={analyze} disabled={analysisBusy || analyzeBusy || linkBusy} data-testid="button-analyze-outside" style={{ backgroundColor: "#143DB8", color: "#FFFFFF", borderColor: "#143DB8" }}>
                  {analyzeBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Analyze
                </Button>
                {qbDeposits && (
                  <Button type="button" onClick={submitLinks} disabled={analysisBusy || analyzeBusy || linkBusy} data-testid="button-submit-links" style={{ backgroundColor: "#16A34A", color: "#FFFFFF", borderColor: "#16A34A" }}>
                    {linkBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <div className="space-y-1.5 w-36"><label className={label}>start_date</label><DateField onIso={value => { setStartDate(value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} testId="outside-start_date" /></div>
                <div className="space-y-1.5 w-36"><label className={label}>end_date</label><DateField onIso={value => { setEndDate(value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} testId="outside-end_date" /></div>
                <div className="space-y-1.5 w-44">
                  <label className={label}>date_macro</label>
                  <select className={filterCls} value={macro} onChange={e => { setMacro(e.target.value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="outside-date_macro">
                    <option value="">— not set —</option>
                    {DATE_MACROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 w-44">
                  <label className={label} htmlFor="outside-analysis-type">Type</label>
                  <select id="outside-analysis-type" className={filterCls} value={analysisKind} onChange={e => { setAnalysisKind(e.target.value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="select-analysis-type">
                    <option value="standard">Standard Transfers</option>
                    <option value="other">Other</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="space-y-1.5 w-56">
                  <label className={label} htmlFor="outside-analysis-matched">Matched in QuickBooks</label>
                  <select id="outside-analysis-matched" className={filterCls} value={analysisMatched} onChange={e => { setAnalysisMatched(e.target.value); setAnalysisRows(null); setQbDeposits(null); setChosenDeposit({}) }} data-testid="select-analysis-matched">
                    <option value="false">False</option>
                    <option value="true">True</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">A date macro sets the range. Otherwise the start and end dates are used. With neither of those, the month and year are used. These rows come from the saved deposits, not QuickBooks.</p>
              <div className="space-y-1.5 max-w-3xl">
                <label className={label} htmlFor="outside-sql">SQL statement</label>
                <textarea
                  id="outside-sql"
                  rows={1}
                  value={sqlText}
                  onChange={e => setSqlText(e.target.value)}
                  placeholder="SELECT * FROM outside_deposits LIMIT 50"
                  className="w-full resize rounded-md border bg-background px-3 py-1.5 font-mono text-xs"
                  data-testid="input-outside-sql"
                />
                <p className="text-xs text-muted-foreground">Postgres. One SELECT, with a semicolon only at the end. Leave this blank and Pull saved deposits uses the filters above. A statement here is what gets run instead.</p>
              </div>
            </div>
          )}
          {mode === "add" && (
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className={label} htmlFor="outside-template">Template</label>
              <select id="outside-template" className={selectCls} value={template} onChange={e => chooseTemplate(e.target.value as Template)} data-testid="select-outside-template">
                <option value="">Select a template</option>
                <option value="new">New template</option>
                <option value="venmo">Venmo</option>
              </select>
            </div>
            {template === "venmo" && (
              <div className="space-y-1.5">
                <span className={label}>CSV file</span>
                <label htmlFor="outside-file" className="inline-flex h-10 cursor-pointer items-center rounded-md border border-gray-300 bg-gray-200 px-4 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300" data-testid="button-outside-file">
                  Choose file
                </label>
                <input
                  id="outside-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  data-testid="input-outside-file"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void upload(file)
                    e.target.value = ""
                  }}
                />
              </div>
            )}
            {template === "venmo" && rows && (
              <Button type="button" onClick={submit} disabled={submitting} data-testid="button-submit-outside" style={{ backgroundColor: "#16A34A", color: "#FFFFFF", borderColor: "#16A34A" }}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Submit
              </Button>
            )}
            {saved && (
              <Button type="button" onClick={() => chooseMode("analysis")} data-testid="button-outside-analysis" style={{ backgroundColor: "#143DB8", color: "#FFFFFF", borderColor: "#143DB8" }}>
                Analysis
              </Button>
            )}
            {template === "new" && <p className="text-sm text-muted-foreground pb-2">New template is not set up yet. Choose Venmo to upload a mapped file.</p>}
          </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={linkError != null} onOpenChange={open => { if (!open) setLinkError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Could not submit</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-rose-600">
                {linkError?.map(line => <p key={line}>{line}</p>)}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {mode === "analysis" && sqlRows && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold" data-testid="outside-sql-title">SQL result ({sqlRows.length}{sqlRows.length === 500 ? ", limited to 500" : ""})</div>
          <div className="overflow-auto max-h-[560px]">
            <table className="text-xs w-full" data-testid="table-outside-sql">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">{sqlColumns.map(name => <th key={name} className="px-3 py-2 font-medium whitespace-nowrap">{name}</th>)}</tr>
              </thead>
              <tbody>
                {sqlRows.length === 0 && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={Math.max(sqlColumns.length, 1)}>The statement returned no rows.</td></tr>}
                {sqlRows.map((row, index) => (
                  <tr key={index} className="border-t">
                    {sqlColumns.map(name => <td key={name} className="px-3 py-2 whitespace-nowrap">{row[name]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mode === "analysis" && analysisRows && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold" data-testid="outside-analysis-title">
            Saved deposits ({analysisRows.length}{analysisRange ? `, ${analysisRange}` : ""})
          </div>
          <div className="overflow-auto max-h-[560px]">
            <table className="text-xs w-full" data-testid="table-outside-analysis">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="w-0 px-2 py-2 font-medium whitespace-nowrap">QuickBooks deposit</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Matched in QuickBooks</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Deposit ID</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">template</th>
                  {VENMO_COLUMNS.map(name => <th key={name} className="px-3 py-2 font-medium whitespace-nowrap">{name}</th>)}
                </tr>
              </thead>
              <tbody>
                {analysisRows.length === 0 && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={VENMO_COLUMNS.length + 4}>No saved deposits in this period.</td></tr>}
                {analysisRows.map((row, index) => {
                  const shown = shownDeposit(row)
                  return (
                  <tr key={`${row.transaction_id}-${index}`} className="border-t" style={shown.fromAnalysis ? { backgroundColor: "#DCFCE7" } : row.type === "Standard Transfer" ? { backgroundColor: "#F3E8FF" } : undefined}>
                    <td className="w-0 px-2 py-2 whitespace-nowrap">
                      <select
                        className="h-8 w-[9.5rem] rounded-md border bg-background px-1.5 text-xs"
                        value={(qbDeposits ?? []).some(deposit => deposit.id === shown.id) ? shown.id : ""}
                        onChange={e => setChosenDeposit(current => ({ ...current, [row.transaction_id]: e.target.value }))}
                        disabled={!qbDeposits}
                        data-testid={`select-deposit-${row.transaction_id}`}
                      >
                        <option value="">—</option>
                        {(qbDeposits ?? []).map(deposit => (
                          <option key={deposit.id} value={deposit.id}>{deposit.id}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.matched_in_quickbooks}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{shown.id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.template}</td>
                    {VENMO_COLUMNS.map(name => {
                      const amount = MONEY.has(name) ? centsOf(row[name]) : null
                      return <td key={name} className={`px-3 py-2 whitespace-nowrap ${amount != null ? "text-right" : ""}`}>{amount != null ? money(amount) : row[name]}</td>
                    })}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mode === "analysis" && qbDeposits && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold" data-testid="outside-unlinked-title">
            Deposits with no payments ({qbDeposits.length}{qbWindow ? `, ${qbWindow}` : ""})
          </div>
          <p className="px-5 py-2 text-xs text-muted-foreground">These QuickBooks deposits have no payment attached, across bank accounts. A saved Standard Transfer turns light green when its amount matches and its date is within 4 days. Deposit ID is filled on screen only.</p>
          <div className="overflow-auto max-h-[560px]">
            <table className="text-xs w-full" data-testid="table-unlinked-deposits">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  {["Deposit ID", "Date", "Amount", "Bank account", "Memo"].map(name => (
                    <th key={name} className="px-3 py-2 font-medium whitespace-nowrap">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qbDeposits.length === 0 && <tr><td className="px-3 py-4 text-muted-foreground" colSpan={5}>No QuickBooks deposits without a payment in this range.</td></tr>}
                {qbDeposits.map(deposit => {
                  const used = (analysisRows ?? []).some(row => shownDeposit(row).fromAnalysis && shownDeposit(row).id === deposit.id)
                  const cents = centsOf(deposit.amount)
                  return (
                    <tr key={deposit.id} className="border-t" style={used ? { backgroundColor: "#DCFCE7" } : undefined}>
                      <td className="px-3 py-2 whitespace-nowrap">{deposit.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{deposit.txnDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">{cents == null ? deposit.amount : money(cents)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{deposit.accountName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{deposit.memo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mode === "add" && rows && (
        <>
          <Card>
            <div className="px-5 py-3 border-b text-sm font-semibold" data-testid="outside-summary-title">
              Transfer check ({matched} of {checks.length} match{fileName ? `, ${fileName}` : ""})
            </div>
            <div className="overflow-auto">
              <table className="text-xs w-full" data-testid="table-transfer-check">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    {["Standard transfer", "Date", "Destination", "Transfer amount_net", "Other amount_net", "Check"].map(name => (
                      <th key={name} className="px-3 py-2 font-medium whitespace-nowrap">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checks.map(check => (
                    <tr key={check.id} className="border-t" style={check.matched ? undefined : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      <td className="px-3 py-2 whitespace-nowrap">{check.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{check.date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{check.destination}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">{money(check.transferCents)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">{money(check.othersCents)}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {check.matched ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#16A34A" }} /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          {check.note}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {checks.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">No standard_transfer_id was filled in.</td></tr>}
                </tbody>
              </table>
            </div>
            {ungrouped > 0 && <p className="px-5 py-3 border-t text-xs text-muted-foreground">{ungrouped} transaction{ungrouped === 1 ? "" : "s"} ha{ungrouped === 1 ? "s" : "ve"} no standard_transfer_id, so {ungrouped === 1 ? "it is" : "they are"} left out of this check.</p>}
          </Card>

          <Card>
            <div className="px-5 py-3 border-b text-sm font-semibold">Uploaded rows ({rows.length})</div>
            <div className="overflow-auto max-h-[560px]">
              <table className="text-xs w-full" data-testid="table-outside-rows">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">template</th>
                    {VENMO_COLUMNS.map(name => <th key={name} className="px-3 py-2 font-medium whitespace-nowrap">{name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.transaction_id}-${index}`} className="border-t" style={row.type === "Standard Transfer" ? { backgroundColor: "#F3E8FF" } : undefined}>
                      <td className="px-3 py-2 whitespace-nowrap">Venmo</td>
                      {VENMO_COLUMNS.map(name => {
                        const amount = MONEY.has(name) ? centsOf(row[name]) : null
                        return (
                          <td key={name} className={`px-3 py-2 whitespace-nowrap ${amount != null ? "text-right" : ""}`}>
                            {amount != null ? money(amount) : row[name]}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
