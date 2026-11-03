import { fmtDate } from "@/lib/dates"

interface RepRow { type?: string; Header?: { ColData?: { value?: string }[] }; ColData?: { value?: string }[]; Rows?: { Row?: RepRow[] }; Summary?: { ColData?: { value?: string }[] } }

// Flattens a QuickBooks report into a plain table (null if the response isn't a report).
export function reportToTable(data: unknown, order: string[], only?: string[]): { head: string[]; rows: string[][] } | null {
  const d = data as { Columns?: { Column?: { ColTitle?: string; MetaData?: { Name: string; Value: string }[] }[] }; Rows?: { Row?: RepRow[] } } | undefined
  const cols = d?.Columns?.Column
  if (!cols || !d?.Rows) return null
  const rows: string[][] = []
  const walk = (list: RepRow[], section: string) => {
    for (const r of list) {
      if (r.ColData) rows.push([section, ...r.ColData.map(c => c.value ?? "")])
      if (r.Rows?.Row) walk(r.Rows.Row, r.Header?.ColData?.[0]?.value || section)
      if (r.Summary?.ColData) rows.push([r.Header?.ColData?.[0]?.value || section, ...r.Summary.ColData.map(c => c.value ?? "")])
    }
  }
  walk(d.Rows.Row ?? [], "")
  for (const r of rows) for (let i = 0; i < r.length; i++) r[i] = fmtDate(r[i])
  const head = ["Section", ...cols.map((c, i) => {
    const key = c.MetaData?.find(m => m.Name === "ColKey")?.Value
    const title = c.ColTitle || `Column ${i + 1}`
    return key && key !== title ? `${title} = ${key}` : title
  })]
  // QuickBooks ignores the order of the requested columns, so apply the user's order here.
  // Column positions: 0 = Section, then one per report column. Columns not in `order` go last.
  const keys = ["", ...cols.map(c => c.MetaData?.find(m => m.Name === "ColKey")?.Value ?? "")]
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? order.length : i }
  const idx = keys.map((_, i) => i).filter(i => i === 0 || !only || only.includes(keys[i])).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : rank(keys[a]) - rank(keys[b]) || a - b))
  return { head: idx.map(i => head[i]), rows: rows.map(r => idx.map(i => r[i] ?? "")) }
}

export function downloadCsv(t: { head: string[]; rows: string[][] }) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csv = [t.head, ...t.rows].map(r => r.map(esc).join(",")).join("\r\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.download = "report.csv"
  a.click()
}
