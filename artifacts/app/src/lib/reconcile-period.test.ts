import assert from "node:assert/strict"
import test from "node:test"
import { defaultPeriod, ledgerQuery, monthWindow, omitReconciled } from "./reconcile-period.ts"

test("default period is last month of the current year", () => {
  const period = defaultPeriod(new Date(2026, 10, 10))
  assert.deepEqual(period, { month: 10, year: 2026 })
  assert.deepEqual(monthWindow(period.year, period.month), { start: "2026-10-01", end: "2026-10-31" })
})

test("December last-month rolls the year back to the previous year", () => {
  const period = defaultPeriod(new Date(2026, 0, 15))
  assert.deepEqual(period, { month: 12, year: 2025 })
  assert.deepEqual(monthWindow(period.year, period.month), { start: "2025-12-01", end: "2025-12-31" })
})

test("ledger query requests the month window and the is_cleared column", () => {
  const q = ledgerQuery("84", 2025, 12)
  assert.equal(q.get("start_date"), "2025-12-01")
  assert.equal(q.get("end_date"), "2025-12-31")
  assert.equal(q.get("account"), "84")
  assert.equal(q.get("accounting_method"), "Accrual")
  assert.ok(q.get("columns")?.split(",").includes("is_cleared"))
})

function sampleReport() {
  return {
    Columns: {
      Column: [
        { MetaData: [{ Name: "ColKey", Value: "tx_date" }] },
        { MetaData: [{ Name: "ColKey", Value: "memo" }] },
        { MetaData: [{ Name: "ColKey", Value: "is_cleared" }] },
      ],
    },
    Rows: {
      Row: [
        {
          type: "Section",
          Rows: {
            Row: [
              { type: "Data", ColData: [{ value: "2026-10-01" }, { value: "rent" }, { value: "R" }] },
              { type: "Data", ColData: [{ value: "2026-10-02" }, { value: "utilities" }, { value: "C" }] },
              { type: "Data", ColData: [{ value: "2026-10-03" }, { value: "deposit" }, { value: "" }] },
              { type: "Data", ColData: [{ value: "2026-10-04" }, { value: "fee" }, { value: " R " }] },
            ],
          },
        },
      ],
    },
  }
}

function clearedValues(report: ReturnType<typeof sampleReport>): string[] {
  const section = report.Rows.Row[0]
  return (section.Rows?.Row ?? []).map(r => r.ColData?.[2]?.value ?? "")
}

test("Not Reconciled excludes is_cleared R only when checked", () => {
  const report = sampleReport()
  const open = omitReconciled(report, false)
  assert.deepEqual(clearedValues(open), ["R", "C", "", " R "])
  assert.equal(open, report)

  const filtered = omitReconciled(report, true)
  assert.deepEqual(clearedValues(filtered), ["C", ""])
  assert.deepEqual(clearedValues(report), ["R", "C", "", " R "])
})
