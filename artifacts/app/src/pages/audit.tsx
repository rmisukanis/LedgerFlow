import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DateField, DATE_MACROS } from "@/components/GeneralLedgerBuilder"
import { macroRange } from "@/pages/analysis"
import { qbList, qbQuery } from "@/lib/qb"

const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "w-full h-10 rounded-md border bg-background px-3 text-sm"
const READ = `${import.meta.env.BASE_URL}api/qb/audit/read`
const REVERSE = `${import.meta.env.BASE_URL}api/qb/audit/reverse`

interface AuditRow {
  id: number
  changedAt: string
  memo: string
  paymentId: string
  txnDate: string
  totalAmt: string
  originalDepositAccount: string
  updatedDepositAccount: string
  depositId: string
  depositToAccountRef: string
  depositToAccountRefName: string
  lineAmount: string
  linkedTxnId: string
  linkedTxnType: string
}

const originalHead = { backgroundColor: "#DBEAFE", color: "#2563EB", boxShadow: "inset 0 -2px 0 #2563EB" }
const originalCell = { backgroundColor: "#DBEAFE" }
const updateHead = { backgroundColor: "#DCFCE7", color: "#16A34A", boxShadow: "inset 0 -2px 0 #16A34A" }
const updateCell = { backgroundColor: "#DCFCE7" }

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function AuditPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [macro, setMacro] = useState("This Fiscal Year")
  const [fiscalStart, setFiscalStart] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [usedRange, setUsedRange] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [reversing, setReversing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    qbQuery("SELECT * FROM CompanyInfo")
      .then(data => {
        const info = qbList<{ FiscalYearStartMonth?: string }>(data, "CompanyInfo")[0]
        const month = Number(info?.FiscalYearStartMonth)
        if (month >= 1 && month <= 12) setFiscalStart(month)
      })
      .catch(() => {})
  }, [])

  const pull = async () => {
    const period = macro ? macroRange(macro, new Date(), fiscalStart) : { start: startDate, end: endDate }
    if (!period || (!period.start && !period.end)) {
      setError("Choose a start or end date, or a date macro.")
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    setRows(null)
    setSelected([])
    setUsedRange([period.start, period.end].filter(Boolean).join(" to "))
    try {
      const response = await fetch(READ, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: period.start, endDate: period.end }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not read the audit register")
      setRows(body.records ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the audit register")
    } finally {
      setBusy(false)
    }
  }

  const allSelected = rows !== null && rows.length > 0 && rows.every(row => selected.includes(row.id))

  const toggleAll = () => {
    if (!rows || rows.length === 0) return
    setSelected(allSelected ? [] : rows.map(row => row.id))
  }

  const toggleRow = (id: number) => {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const reverse = async () => {
    if (selected.length === 0) {
      setError("Select a change before reversing it.")
      return
    }
    setReversing(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(REVERSE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      })
      const body = await response.json()
      const done = new Set<number>(body.reversed ?? [])
      if (done.size > 0) {
        setRows(current => current?.filter(row => !done.has(row.id)) ?? current)
        setSelected(current => current.filter(id => !done.has(id)))
        setNotice(`Reversed ${done.size} change${done.size === 1 ? "" : "s"}. Each payment is back on its original account and its deposit was removed.`)
      }
      if (!response.ok || body.error) throw new Error(body.error ?? "Could not reverse the selected changes")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reverse the selected changes")
    } finally {
      setReversing(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit</h1>
        <p className="text-muted-foreground mt-1">Saved payment and deposit fixes, with the original value beside the update.</p>
      </div>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
            <div className="space-y-1.5"><label className={label}>start_date</label><DateField onIso={setStartDate} testId="audit-start_date" /></div>
            <div className="space-y-1.5"><label className={label}>end_date</label><DateField onIso={setEndDate} testId="audit-end_date" /></div>
            <div className="space-y-1.5">
              <label className={label}>date_macro</label>
              <select className={selectCls} value={macro} onChange={e => setMacro(e.target.value)} data-testid="audit-date_macro">
                <option value="">— not set —</option>
                {DATE_MACROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <Button variant="outline" onClick={pull} disabled={busy || reversing} data-testid="button-pull-audit">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Pull Database Register
            </Button>
            <Button type="button" variant="outline" onClick={toggleAll} disabled={!rows || rows.length === 0 || reversing} data-testid="button-select-all-audit">
              {allSelected ? "Clear selection" : "Select all"}
            </Button>
            <Button type="button" onClick={reverse} disabled={selected.length === 0 || reversing} data-testid="button-reverse-audit" style={{ backgroundColor: "#143DB8", color: "#FFFFFF", borderColor: "#143DB8" }}>
              {reversing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Reverse
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A date macro is used as the saved-change range. Otherwise the start and end dates are used. This Year is the default.</p>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {rows && (
        <Card>
          <div className="px-5 py-3 border-b text-sm font-semibold">Changes ({rows.length}{usedRange ? `, ${usedRange}` : ""})</div>
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full" data-testid="table-audit">
              <thead className="sticky top-0">
                <tr>
                  <th rowSpan={2} className="text-left px-3 py-2 whitespace-nowrap bg-white">
                    <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} disabled={!rows || rows.length === 0} data-testid="checkbox-select-all-audit" />
                  </th>
                  <th rowSpan={2} className="text-left px-3 py-2 whitespace-nowrap bg-white">Changed at</th>
                  <th colSpan={4} className="text-left px-3 py-2 whitespace-nowrap" style={originalHead}>Original payment</th>
                  <th colSpan={10} className="text-left px-3 py-2 whitespace-nowrap" style={updateHead}>Update</th>
                </tr>
                <tr>
                  {["DepositToAccountRef", "TotalAmt", "Id", "TxnDate"].map(heading => (
                    <th key={`original-${heading}`} className="text-left px-3 py-2 whitespace-nowrap" style={originalHead}>{heading}</th>
                  ))}
                  {["DepositToAccountRef", "Deposit Id", "TxnDate", "TotalAmt", "ToAccountRef", "ToAccountRef Name", "Line Amount", "LinkedTxn Id", "LinkedTxn Type", "Memo"].map(heading => (
                    <th key={`update-${heading}`} className="text-left px-3 py-2 whitespace-nowrap" style={updateHead}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="px-3 py-4 text-muted-foreground" colSpan={16}>No saved changes in this period.</td></tr>
                ) : rows.map(row => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <input type="checkbox" aria-label={`Select payment ${row.paymentId}`} checked={selected.includes(row.id)} onChange={() => toggleRow(row.id)} data-testid={`checkbox-audit-${row.id}`} />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{when(row.changedAt)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={originalCell}>{row.originalDepositAccount}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={originalCell}>{row.totalAmt}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={originalCell}>{row.paymentId}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={originalCell}>{row.txnDate}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.updatedDepositAccount}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.depositId}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.txnDate}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={updateCell}>{row.totalAmt}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.depositToAccountRef}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.depositToAccountRefName}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums" style={updateCell}>{row.lineAmount}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.linkedTxnId}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.linkedTxnType}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={updateCell}>{row.memo}</td>
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
