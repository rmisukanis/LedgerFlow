import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "h-10 min-w-56 rounded-md border bg-background px-3 text-sm"

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
  const [template, setTemplate] = useState<Template>("")
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const checks = useMemo(() => rows ? transferChecks(rows) : [], [rows])
  const ungrouped = rows?.filter(row => !row.standard_transfer_id).length ?? 0
  const matched = checks.filter(check => check.matched).length

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
      setNotice(`Saved ${body.saved} transaction${body.saved === 1 ? "" : "s"} to the database. Uploading the same transaction id again replaces that row.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the deposit file.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outside Deposits</h1>
        <p className="text-muted-foreground mt-1">Upload a mapped deposit file and check each bank transfer against the transactions in it.</p>
      </div>

      <Card>
        <CardContent className="p-5">
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
            {template === "new" && <p className="text-sm text-muted-foreground pb-2">New template is not set up yet. Choose Venmo to upload a mapped file.</p>}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      {rows && (
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
