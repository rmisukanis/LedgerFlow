import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"
import { macroRange } from "@/pages/analysis"
import { qbList, qbQuery } from "@/lib/qb"
import { formatCurrency } from "@/lib/utils"

const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "h-10 min-w-56 rounded-md border bg-background px-3 text-sm"
const FEED = `${import.meta.env.BASE_URL}api/banking-feed`

interface BankAccount { id: string; name: string }
interface FeedLine {
  id: number
  bankAccountId: string
  bankAccountName: string
  date: string
  description: string
  amount: string
  status: string
  action: string
  qbEntity: string
  qbId: string
  reason: string
}
interface ParsedLine { date: string; description: string; amount: string }

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
  if (cur !== "" || row.length > 0) {
    row.push(cur)
    if (row.some(cell => cell.trim() !== "")) rows.push(row)
  }
  return rows
}

function money(value: string) {
  const text = value.trim().replace(/[$,]/g, "")
  if (!text) return ""
  const amount = Number(text)
  return Number.isFinite(amount) ? amount.toFixed(2) : ""
}

function readFile(grid: string[][]): ParsedLine[] {
  if (grid.length < 2) throw new Error("The file needs a header row and one statement line.")
  const header = grid[0].map(cell => cell.trim().toLowerCase())
  const at = (name: string) => header.indexOf(name)
  const dateAt = at("date")
  const descriptionAt = at("description")
  const amountAt = at("amount")
  const debitAt = at("debit")
  const creditAt = at("credit")
  if (dateAt < 0 || descriptionAt < 0 || (amountAt < 0 && debitAt < 0 && creditAt < 0)) {
    throw new Error("The header needs date, description, and amount. Debit and credit can replace amount.")
  }
  return grid.slice(1).map(cells => {
    const debit = debitAt >= 0 ? money(cells[debitAt] ?? "") : ""
    const credit = creditAt >= 0 ? money(cells[creditAt] ?? "") : ""
    let amount = amountAt >= 0 ? money(cells[amountAt] ?? "") : ""
    if (!amount && (debit || credit)) {
      const signed = Number(credit || "0") - Number(debit || "0")
      amount = signed === 0 ? "" : signed.toFixed(2)
    }
    return { date: (cells[dateAt] ?? "").trim(), description: (cells[descriptionAt] ?? "").trim(), amount }
  }).filter(line => line.date || line.description || line.amount)
}

const ACTION_LABEL: Record<string, string> = {
  already_on_register: "Already on the register",
  link_payment: "Link the undeposited payment",
  bill_payment: "Pay the open bill",
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

const PRESET = presetPeriod()
const YEAR_OPTIONS = Array.from(new Set([PRESET.year, ...Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i)])).sort((a, b) => b - a)

export default function BankingFeed() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [bankAccountId, setBankAccountId] = useState("")
  const [preview, setPreview] = useState<ParsedLine[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<FeedLine[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [month, setMonth] = useState(PRESET.month)
  const [year, setYear] = useState(PRESET.year)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [macro, setMacro] = useState("This Fiscal Year")
  const [fiscalStart, setFiscalStart] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [pulling, setPulling] = useState(false)

  useEffect(() => {
    void qbQuery("SELECT Id, Name FROM Account WHERE AccountType = 'Bank' MAXRESULTS 1000")
      .then(data => {
        const list = qbList<{ Id?: string; Name?: string }>(data, "Account")
          .map(account => ({ id: String(account.Id ?? ""), name: String(account.Name ?? "") }))
          .filter(account => account.id)
          .sort((a, b) => a.name.localeCompare(b.name))
        setAccounts(list)
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load bank accounts"))
    qbQuery("SELECT * FROM CompanyInfo")
      .then(data => {
        const info = qbList<{ FiscalYearStartMonth?: string }>(data, "CompanyInfo")[0]
        const startMonth = Number(info?.FiscalYearStartMonth)
        if (startMonth >= 1 && startMonth <= 12) setFiscalStart(startMonth)
      })
      .catch(() => {})
  }, [])

  const period = useMemo(() => {
    if (macro) return macroRange(macro, new Date(), fiscalStart) ?? monthBounds(year, month)
    if (startDate || endDate) return { start: startDate, end: endDate }
    return monthBounds(year, month)
  }, [macro, fiscalStart, startDate, endDate, year, month])

  const pull = async () => {
    const params = new URLSearchParams()
    if (bankAccountId) params.set("bankAccountId", bankAccountId)
    if (period.start) params.set("start", period.start)
    if (period.end) params.set("end", period.end)
    const response = await fetch(`${FEED}?${params.toString()}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? "Could not read the saved lines")
    setRows(body.rows ?? [])
    setSelected([])
  }

  const chooseAccount = (accountId: string) => {
    setBankAccountId(accountId)
    setError(null)
    setNotice(null)
    setRows(null)
    setSelected([])
  }

  const onFile = async (file: File) => {
    setError(null)
    setNotice(null)
    try {
      const lines = readFile(parseCsv(await file.text()))
      if (lines.length === 0) throw new Error("The file has no statement lines.")
      setPreview(lines)
      setFileName(file.name)
    } catch (e) {
      setPreview(null)
      setFileName("")
      setError(e instanceof Error ? e.message : "Could not read the file")
    }
  }

  const save = async () => {
    if (!preview || !bankAccountId) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const account = accounts.find(item => item.id === bankAccountId)
      const response = await fetch(FEED, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId, bankAccountName: account?.name ?? "", rows: preview }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not save the statement")
      setPreview(null)
      setFileName("")
      setNotice(`Saved ${body.rows?.length ?? 0} lines. Nothing was posted to QuickBooks.`)
      await pull()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the statement")
    } finally {
      setSaving(false)
    }
  }

  const match = async () => {
    setMatching(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${FEED}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not search QuickBooks")
      await pull()
      const list = (body.rows ?? []) as FeedLine[]
      const matched = list.filter(line => line.status === "matched").length
      const review = list.filter(line => line.status === "needs_review").length
      setNotice(`Rules matched ${matched}. ${review} still need a person.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not search QuickBooks")
    } finally {
      setMatching(false)
    }
  }

  const review = async () => {
    setReviewing(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${FEED}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Grok could not review the leftovers")
      await pull()
      setNotice(`Grok identified ${body.identified ?? 0}. ${body.still ?? 0} still need a person. Nothing was posted to QuickBooks.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grok could not review the leftovers")
    } finally {
      setReviewing(false)
    }
  }

  const setStatus = async (id: number, status: "accepted" | "excluded") => {
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`${FEED}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not update the line")
      setRows(current => current?.map(line => line.id === id ? body.row : line) ?? current)
      if (status === "accepted") setNotice("Accepted in this app. Nothing was posted to QuickBooks.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the line")
    }
  }

  const needsReview = rows?.some(line => line.status === "needs_review") ?? false
  const allSelected = rows != null && rows.length > 0 && rows.every(line => selected.includes(line.id))

  const runPull = async () => {
    setPulling(true)
    setError(null)
    setNotice(null)
    try {
      await pull()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the saved lines")
    } finally {
      setPulling(false)
    }
  }

  const toggleLine = (id: number) => {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const removeSelected = async () => {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`${FEED}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not delete the lines")
      setConfirmOpen(false)
      setNotice(`Deleted ${body.deleted?.length ?? 0} line${body.deleted?.length === 1 ? "" : "s"}.`)
      await pull()
    } catch (e) {
      setConfirmOpen(false)
      setError(e instanceof Error ? e.message : "Could not delete the lines")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Banking Feed</h1>
        <p className="text-muted-foreground mt-1">Upload a bank statement, then match each line to a QuickBooks record. Accepting a line does not post it.</p>
      </div>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className={label} htmlFor="banking-account">Bank account</label>
              <select id="banking-account" className={selectCls} value={bankAccountId} onChange={e => chooseAccount(e.target.value)} data-testid="select-banking-account">
                <option value="">Select a bank</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <span className={label}>CSV file</span>
              <label htmlFor="banking-file" className="inline-flex h-10 cursor-pointer items-center rounded-md border border-gray-300 bg-gray-200 px-4 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300" data-testid="button-banking-file">
                Choose file
              </label>
              <input id="banking-file" type="file" accept=".csv,text/csv" className="hidden" data-testid="input-banking-file" onChange={e => { const file = e.target.files?.[0]; if (file) void onFile(file); e.target.value = "" }} />
            </div>
            {preview && (
              <Button type="button" onClick={() => void save()} disabled={saving || !bankAccountId} data-testid="button-save-banking" style={{ backgroundColor: "#16A34A", color: "#FFFFFF", borderColor: "#16A34A" }}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save statement
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Columns are date, description, and amount. A positive amount is money in. A negative amount is money out. Debit and credit can replace amount. {fileName}</p>
          <div className="space-y-3 border-t pt-4">
            <label className={label}>Time frame</label>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5 w-40">
                <label className={label}>Month</label>
                <select className={selectCls} value={month} onChange={e => setMonth(Number(e.target.value))} data-testid="banking-month">
                  {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 w-28">
                <label className={label}>Year</label>
                <select className={selectCls} value={year} onChange={e => setYear(Number(e.target.value))} data-testid="banking-year">
                  {YEAR_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 w-40"><label className={label}>start_date</label><DateField onIso={setStartDate} testId="banking-start_date" /></div>
              <div className="space-y-1.5 w-40"><label className={label}>end_date</label><DateField onIso={setEndDate} testId="banking-end_date" /></div>
              <div className="space-y-1.5 w-52">
                <label className={label}>date_macro</label>
                <select className={selectCls} value={macro} onChange={e => setMacro(e.target.value)} data-testid="banking-date_macro">
                  <option value="">— not set —</option>
                  {DATE_MACROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <Button type="button" variant="outline" onClick={() => void runPull()} disabled={pulling} data-testid="button-pull-banking">
                {pulling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull statement lines
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">A date macro is used as the range. Otherwise the start and end dates are used. With neither of those, the month and year are used. This Year is the default. Pull reads the saved statement lines{bankAccountId ? " for the selected bank" : ""}.</p>
          </div>
          {error && <p className="text-sm text-rose-600" data-testid="banking-error">{error}</p>}
          {notice && <p className="text-sm text-emerald-700" data-testid="banking-notice">{notice}</p>}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold">File check ({preview.length})</div>
          <div className="overflow-auto max-h-[320px]">
            <table className="text-xs w-full" data-testid="table-banking-preview">
              <thead className="sticky top-0 bg-white">
                <tr>{["Date", "Description", "Amount"].map(heading => <th key={heading} className="text-left px-3 py-2 whitespace-nowrap">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((line, index) => (
                  <tr key={`${line.date}-${line.description}-${index}`} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.date}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.description}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums">{line.amount ? formatCurrency(Number(line.amount)) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rows !== null && (
        <Card>
          <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} disabled={selected.length === 0 || deleting} data-testid="button-delete-banking">
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Delete
            </Button>
            <span className="text-sm font-semibold">Statement lines ({rows.length})</span>
            <Button type="button" onClick={() => void match()} disabled={matching || reviewing || rows.length === 0 || !bankAccountId} data-testid="button-match-banking" style={{ backgroundColor: "#143DB8", color: "#FFFFFF", borderColor: "#143DB8" }}>
              {matching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Find matches
            </Button>
            {needsReview && (
              <Button type="button" variant="outline" onClick={() => void review()} disabled={matching || reviewing} data-testid="button-review-banking">
                {reviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Ask Grok
              </Button>
            )}
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="text-xs w-full" data-testid="table-banking-lines">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="sticky left-0 z-20 w-0 px-3 py-2 bg-white">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected || !rows ? [] : rows.map(line => line.id))} aria-label="Select all lines" data-testid="checkbox-banking-all" />
                  </th>
                  {["Date", "Description", "Amount", "Status", "Suggestion", "QuickBooks", "Why", ""].map(heading => <th key={heading || "actions"} className="text-left px-3 py-2 whitespace-nowrap">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="px-3 py-4 text-muted-foreground" colSpan={9}>No statement lines in this range.</td></tr>
                ) : rows.map(line => (
                  <tr key={line.id} className="border-t" data-testid={`banking-line-${line.id}`}>
                    <td className="sticky left-0 z-10 w-0 px-3 py-1.5 bg-white">
                      <input type="checkbox" checked={selected.includes(line.id)} onChange={() => toggleLine(line.id)} aria-label={`Select ${line.description}`} data-testid={`checkbox-banking-${line.id}`} />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.date}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.description}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums">{formatCurrency(Number(line.amount))}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.status.replace(/_/g, " ")}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{ACTION_LABEL[line.action] ?? ""}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{line.qbId ? `${line.qbEntity} ${line.qbId}` : ""}</td>
                    <td className="px-3 py-1.5 whitespace-normal min-w-64">{line.reason}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="flex gap-2">
                        {line.status === "matched" && <Button type="button" size="sm" onClick={() => void setStatus(line.id, "accepted")} data-testid={`button-accept-${line.id}`}>Accept</Button>}
                        {line.status !== "excluded" && line.status !== "accepted" && <Button type="button" size="sm" variant="outline" onClick={() => void setStatus(line.id, "excluded")} data-testid={`button-exclude-${line.id}`}>Exclude</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-banking">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm delete</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeSelected()} data-testid="button-confirm-delete-banking">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
