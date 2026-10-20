import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Download, Upload, Send, Loader2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BATCH_SCHEMAS, type BatchField } from "@/data/batch-schemas"

const API = `${import.meta.env.BASE_URL}api/qb/explorer/run`
const label = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"

type Obj = Record<string, unknown>

// Which QuickBooks list feeds each reference field: [entity to query, name column]
const REF_SOURCES: Record<string, [string, string]> = {
  VendorRef: ["Vendor", "DisplayName"],
  CustomerRef: ["Customer", "DisplayName"],
  ParentRef: ["Customer", "DisplayName"],
  APAccountRef: ["Account", "Name"],
  "Line.AccountRef": ["Account", "Name"],
  "Line.ItemRef": ["Item", "Name"],
  DepartmentRef: ["Department", "Name"],
  SalesTermRef: ["Term", "Name"],
  TermRef: ["Term", "Name"],
  PaymentMethodRef: ["PaymentMethod", "Name"],
}
interface Opt { id: string; name: string }

function convert(f: BatchField, raw: string): unknown {
  const v = raw.trim()
  switch (f.kind) {
    case "number": return Number(v)
    case "bool": return /^(true|1|yes)$/i.test(v)
    case "ref": return { value: v }
    case "email": return { Address: v }
    case "phone": return { FreeFormNumber: v }
    case "json": return JSON.parse(v)
    default: return v
  }
}

function buildLine(entity: string, row: Record<string, string>): Obj | null {
  const get = (k: string) => (row[k] ?? "").toString().trim()
  if (!get("Line.Amount")) return null
  const line: Obj = { Amount: Number(get("Line.Amount")) }
  if (get("Line.Description")) line.Description = get("Line.Description")
  if (entity === "Bill") {
    line.DetailType = "AccountBasedExpenseLine"
    line.AccountBasedExpenseLineDetail = { AccountRef: { value: get("Line.AccountRef") } }
  } else {
    line.DetailType = "SalesItemLineDetail"
    const d: Obj = { ItemRef: { value: get("Line.ItemRef") } }
    if (get("Line.Qty")) d.Qty = Number(get("Line.Qty"))
    if (get("Line.UnitPrice")) d.UnitPrice = Number(get("Line.UnitPrice"))
    line.SalesItemLineDetail = d
  }
  return line
}

export default function BatchBuilderPage() {
  const [entity, setEntity] = useState("Bill")
  const schema = BATCH_SCHEMAS[entity]
  const all = useMemo(() => [...schema.fields, ...(schema.lineFields ?? [])], [schema])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [records, setRecords] = useState<Obj[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [results, setResults] = useState<string[] | null>(null)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [added, setAdded] = useState<Record<string, Record<string, string>[]>>({})
  const [options, setOptions] = useState<Record<string, Opt[] | "loading" | "error">>({})
  const addedRows = added[entity] ?? []

  const selected = useMemo(
    () => all.filter(f => f.required || picked.has(f.name)),
    [all, picked],
  )

  useEffect(() => {
    for (const f of selected) {
      const src = REF_SOURCES[f.name]
      if (!src || options[f.name]) continue
      setOptions(o => ({ ...o, [f.name]: "loading" }))
      const q = `SELECT Id, ${src[1]} FROM ${src[0]} MAXRESULTS 1000`
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "GET", path: "/query", query: new URLSearchParams({ query: q }).toString() }),
      })
        .then(r => r.json())
        .then(j => {
          const rows = (j.data?.QueryResponse?.[src[0]] as Obj[] | undefined) ?? []
          if (j.status >= 300) throw new Error("query failed")
          setOptions(o => ({ ...o, [f.name]: rows.map(r => ({ id: String(r.Id), name: String(r[src[1]] ?? "") })) }))
        })
        .catch(() => setOptions(o => ({ ...o, [f.name]: "error" })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const addRecord = () => {
    setAdded(a => ({ ...a, [entity]: [...(a[entity] ?? []), { ...draft }] }))
    setDraft({})
  }
  const clearAdded = () => setAdded(a => ({ ...a, [entity]: [] }))

  const reset = () => { setRecords([]); setProblems([]); setResults(null) }
  const changeEntity = (e: string) => { setEntity(e); setPicked(new Set()); setDraft({}); reset() }
  const toggle = (n: string) => {
    setPicked(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
    reset()
  }

  const download = () => {
    const cols = [...(schema.lineFields ? ["Group"] : []), ...selected.map(f => f.name)]
    const ws = XLSX.utils.aoa_to_sheet([cols, ...addedRows.map(r => cols.map(c => r[c] ?? ""))])
    const help = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ...(schema.lineFields ? [["Group", "No", "Rows with the same Group value become ONE record with several lines. Leave blank for one record per row."]] : []),
      ...selected.map(f => [f.name, f.required ? "Yes" : "No", f.hint ?? ""]),
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.utils.book_append_sheet(wb, help, "Help")
    XLSX.writeFile(wb, `${entity}-batch-template.xlsx`)
  }

  const upload = async (file: File) => {
    reset()
    const wb = XLSX.read(await file.arrayBuffer())
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false })
    const errs: string[] = []
    const recs: Obj[] = []
    const groups = new Map<string, Obj>()
    const lineNames = new Set((schema.lineFields ?? []).map(f => f.name))
    rows.forEach((row, i) => {
      const n = i + 2
      const group = (row["Group"] ?? "").toString().trim()
      let rec = group ? groups.get(group) : undefined
      if (!rec) {
        rec = {}
        for (const f of schema.fields) {
          const v = (row[f.name] ?? "").toString()
          if (v.trim() === "") {
            if (f.required) errs.push(`Row ${n}: ${f.name} is required`)
            continue
          }
          try { rec[f.name] = convert(f, v) } catch { errs.push(`Row ${n}: ${f.name} is not valid`) }
        }
        recs.push(rec)
        if (group) groups.set(group, rec)
      }
      if (schema.lineFields) {
        for (const f of schema.lineFields) {
          if (f.required && !(row[f.name] ?? "").toString().trim()) errs.push(`Row ${n}: ${f.name} is required`)
        }
        const line = buildLine(entity, row)
        if (line) ((rec.Line as Obj[]) ??= []).push(line)
      }
    })
    void lineNames
    setRecords(recs)
    setProblems(errs)
  }

  const send = async () => {
    setSending(true)
    const out: string[] = []
    try {
      for (let i = 0; i < records.length; i += 30) {
        const chunk = records.slice(i, i + 30)
        const body = JSON.stringify({
          BatchItemRequest: chunk.map((r, j) => ({ bId: String(i + j + 1), operation: "create", [entity]: r })),
        })
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "POST", path: "/batch", query: "", body, contentType: "application/json" }),
        })
        const j = await res.json()
        const items = (j.data?.BatchItemResponse as Obj[] | undefined) ?? []
        if (items.length === 0) out.push(`Batch ${i / 30 + 1}: failed — ${JSON.stringify(j.data)}`)
        for (const it of items) {
          const fault = it.Fault as { Error?: { Message?: string; Detail?: string }[] } | undefined
          out.push(
            fault
              ? `Record ${it.bId}: FAILED — ${fault.Error?.[0]?.Message ?? ""} ${fault.Error?.[0]?.Detail ?? ""}`
              : `Record ${it.bId}: created (Id ${(it[entity] as Obj | undefined)?.Id})`,
          )
        }
      }
    } catch (e) {
      out.push(`Error: ${e instanceof Error ? e.message : "request failed"}`)
    } finally {
      setResults(out)
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Builder</h1>
        <p className="text-muted-foreground mt-1">Choose an entity and fields, download an Excel template, fill it in, upload it, preview, then send.</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-2 text-sm" data-testid="added-counter">
            <span><strong>{addedRows.length}</strong> {entity} record{addedRows.length === 1 ? "" : "s"} added to the batch</span>
            {addedRows.length > 0 && <Button variant="ghost" size="sm" onClick={clearAdded}>Clear</Button>}
          </div>
          <div className="space-y-1.5 w-[220px]">
            <label className={label}>1. Entity</label>
            <Select value={entity} onValueChange={changeEntity}>
              <SelectTrigger data-testid="select-batch-entity"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(BATCH_SCHEMAS).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={label}>2. Fields (required fields are always included)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
              {all.map(f => (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!f.required || picked.has(f.name)}
                    disabled={f.required}
                    onChange={() => toggle(f.name)}
                    data-testid={`field-${f.name}`}
                  />
                  <span>{f.name}</span>
                  {f.required && <Badge variant="outline" className="text-[10px] text-rose-700 border-rose-200">required</Badge>}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <label className={label}>3. Fill in a record (leave anything blank to complete in Excel)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {schema.lineFields && (
                <div className="space-y-1">
                  <span className="text-sm">Group <span className="text-xs text-muted-foreground">(same value = one record with several lines)</span></span>
                  <Input value={draft["Group"] ?? ""} onChange={e => setDraft(d => ({ ...d, Group: e.target.value }))} />
                </div>
              )}
              {selected.map(f => {
                const val = draft[f.name] ?? ""
                const set = (v: string) => setDraft(d => ({ ...d, [f.name]: v }))
                const opts = options[f.name]
                return (
                  <div key={f.name} className="space-y-1">
                    <span className="text-sm">{f.name}{f.required && <span className="text-rose-600"> *</span>}
                      {f.hint && <span className="text-xs text-muted-foreground"> — {f.hint}</span>}</span>
                    {REF_SOURCES[f.name] ? (
                      opts === "error" ? <p className="text-xs text-rose-600">Could not load list from QuickBooks</p> : (
                        <select value={val} onChange={e => set(e.target.value)} disabled={opts === undefined || opts === "loading"}
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm" data-testid={`draft-${f.name}`}>
                          <option value="">{opts === "loading" || opts === undefined ? "Loading…" : "— leave blank —"}</option>
                          {Array.isArray(opts) && opts.map(o => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
                        </select>
                      )
                    ) : f.kind === "bool" ? (
                      <select value={val} onChange={e => set(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                        <option value="">— leave blank —</option><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option>
                      </select>
                    ) : (
                      <Input value={val} onChange={e => set(e.target.value)} type={f.hint?.startsWith("YYYY") ? "date" : f.kind === "number" ? "number" : "text"}
                        placeholder={f.kind === "number" ? "Amount — or leave blank" : ""} data-testid={`draft-${f.name}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <Button onClick={addRecord} data-testid="button-add-record"><Plus className="w-4 h-4 mr-2" />Add to batch</Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={download} data-testid="button-download">
              <Download className="w-4 h-4 mr-2" />4. Download Excel template
            </Button>
            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-md border text-sm font-medium cursor-pointer hover:bg-muted">
              <Upload className="w-4 h-4" />5. Upload filled file
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" data-testid="input-upload"
                onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = "" }} />
            </label>
          </div>
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <Card className="border-rose-200"><CardContent className="p-4 text-sm text-rose-700 space-y-1">
          {problems.slice(0, 20).map((p, i) => <div key={i}>{p}</div>)}
          {problems.length > 20 && <div>…and {problems.length - 20} more</div>}
        </CardContent></Card>
      )}

      {records.length > 0 && (
        <Card>
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Preview — {records.length} {entity} record{records.length === 1 ? "" : "s"}</span>
            <Button onClick={send} disabled={sending || problems.length > 0} data-testid="button-send-batch">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to QuickBooks
            </Button>
          </div>
          <pre className="p-5 text-xs font-mono overflow-auto max-h-[400px]">{JSON.stringify(records, null, 2)}</pre>
        </Card>
      )}

      {results && (
        <Card><CardContent className="p-4 text-sm font-mono space-y-1" data-testid="batch-results">
          {results.map((r, i) => <div key={i} className={r.includes("FAILED") || r.includes("failed") ? "text-rose-700" : "text-emerald-700"}>{r}</div>)}
        </CardContent></Card>
      )}
    </div>
  )
}
