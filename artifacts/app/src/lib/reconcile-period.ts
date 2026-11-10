// Period and cleared-status helpers for the bank reconciliation pull.
// QuickBooks marks a reconciled register line with is_cleared = "R".

export const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

// is_cleared is requested on the General Ledger so the Not Reconciled filter
// reads that column. General Ledger has no parameter for "is_cleared is not R".
export const LEDGER_COLUMNS = "tx_date,txn_type,doc_num,name,memo,split_acc,account_name,subt_nat_amount,rbal_nat_amount,is_cleared"

export interface Period {
  month: number
  year: number
}

// Last calendar month in the user's local timezone. January rolls the year back
// so the preset is December of the previous year, not month 0 of this year.
export function defaultPeriod(today: Date = new Date()): Period {
  const monthIndex = today.getMonth()
  if (monthIndex === 0) return { month: 12, year: today.getFullYear() - 1 }
  return { month: monthIndex, year: today.getFullYear() }
}

export function yearOptions(today: Date = new Date(), selected?: number): number[] {
  const current = today.getFullYear()
  const years: number[] = []
  for (let y = current; y >= current - 15; y--) years.push(y)
  if (selected !== undefined && !years.includes(selected)) years.push(selected)
  return years.sort((a, b) => b - a)
}

// First day through last day of the selected calendar month (local calendar).
export function monthWindow(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, "0")
  const last = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  }
}

export function ledgerQuery(accountId: string, year: number, month: number): URLSearchParams {
  const { start, end } = monthWindow(year, month)
  return new URLSearchParams({
    account: accountId,
    start_date: start,
    end_date: end,
    columns: LEDGER_COLUMNS,
    accounting_method: "Accrual",
  })
}

type ColData = { value?: string }
type RptRow = { type?: string; ColData?: ColData[]; Rows?: { Row?: RptRow[] } }

function clearedColumn(report: Record<string, unknown>): number {
  const columns = (report.Columns as { Column?: { MetaData?: { Name: string; Value: string }[] }[] } | undefined)?.Column ?? []
  return columns.findIndex(c => c.MetaData?.some(m => m.Name === "ColKey" && m.Value === "is_cleared"))
}

function dropReconciled(rows: RptRow[] | undefined, idx: number): RptRow[] | undefined {
  if (!rows) return rows
  const kept: RptRow[] = []
  for (const row of rows) {
    if (row.type === "Data" && row.ColData && (row.ColData[idx]?.value ?? "").trim() === "R") continue
    if (row.Rows?.Row) kept.push({ ...row, Rows: { ...row.Rows, Row: dropReconciled(row.Rows.Row, idx) } })
    else kept.push(row)
  }
  return kept
}

// When Not Reconciled is checked, drop register lines whose is_cleared is R.
// Other values (cleared "C", blank, anything else) stay. Unchecked returns the report unchanged.
export function omitReconciled<T extends Record<string, unknown>>(report: T, notReconciled: boolean): T {
  if (!notReconciled) return report
  const idx = clearedColumn(report)
  if (idx < 0) return report
  const rows = report.Rows as { Row?: RptRow[] } | undefined
  if (!rows) return report
  return { ...report, Rows: { ...rows, Row: dropReconciled(rows.Row, idx) } }
}
