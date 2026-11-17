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
const REF_SOURCES: Record<string, [string, string, string?]> = {
  VendorRef: ["Vendor", "DisplayName"],
  CustomerRef: ["Customer", "DisplayName"],
  ParentRef: ["Customer", "DisplayName"],
  APAccountRef: ["Account", "Name"],
  AccountRef: ["Account", "Name", "WHERE AccountType IN ('Bank', 'Credit Card')"],
  DepositToAccountRef: ["Account", "Name", "WHERE AccountType = 'Bank'"],
  EntityRef: ["Vendor", "DisplayName"],
  "Line.AccountRef": ["Account", "Name"],
  "Line.EntityRef": ["Customer", "DisplayName"],
  "Line.PaymentMethodRef": ["PaymentMethod", "Name"],
  "Line.CustomerRef": ["Customer", "DisplayName"],
  "Line.ItemRef": ["Item", "Name"],
  DepartmentRef: ["Department", "Name"],
  SalesTermRef: ["Term", "Name"],
  TermRef: ["Term", "Name"],
  PaymentMethodRef: ["PaymentMethod", "Name"],
}

function refSource(entity: string, field: string): [string, string, string?] | undefined {
  if (entity === "Payment" && field === "DepositToAccountRef") return ["Account", "Name"]
  return REF_SOURCES[field]
}

const optionKey = (entity: string, field: string) => `${entity}:${field}`
const STATIC_OPTIONS: Record<string, string[]> = {
  PaymentType: ["Cash", "Check", "CreditCard"],
  "Line.TxnType": ["Invoice", "CreditMemo"],
}
interface Opt { id: string; name: string; type?: string }

function convert(f: BatchField, raw: string): unknown {
  const v = raw.trim()
  if (f.name === "PaymentType") {
    const m = { cash: "Cash", check: "Check", cheque: "Check", creditcard: "CreditCard" }[v.toLowerCase().replace(/[\s_-]/g, "")]
    if (!m) throw new Error("must be Cash, Check or CreditCard")
    return m
  }
  switch (f.kind) {
    case "number": {
      const n = Number(v.replace(/[$,\s]/g, ""))
      if (Number.isNaN(n)) throw new Error("not a number")
      return n
    }
    case "bool": return /^(true|1|yes)$/i.test(v)
    case "ref": return f.name === "EntityRef" ? { value: v, type: "Vendor" } : { value: v }
    case "email": return { Address: v }
    case "phone": return { FreeFormNumber: v }
    case "json": return JSON.parse(v)
    default: return v
  }
}

function buildLine(entity: string, row: Record<string, string>): Obj | null {
  const get = (k: string) => (row[k] ?? "").toString().trim()
  const num = (k: string) => {
    const n = Number(get(k).replace(/[$,\s]/g, ""))
    if (Number.isNaN(n)) throw new Error(k + " is not a number")
    return n
  }
  if (entity === "Payment") {
    const txnId = get("Line.TxnId")
    if (!get("Line.Amount") && !txnId) return null
    if (!txnId) throw new Error("Line.TxnId is required when a payment line has an amount")
    if (!get("Line.Amount")) throw new Error("Line.Amount is required when a payment line has a transaction id")
    const rawType = get("Line.TxnType").replace(/\s/g, "")
    const txnType = rawType.toLowerCase() === "creditmemo" ? "CreditMemo" : (rawType || "Invoice")
    return { Amount: num("Line.Amount"), LinkedTxn: [{ TxnId: txnId, TxnType: txnType }] }
  }
  if (!get("Line.Amount")) return null
  const line: Obj = { Amount: num("Line.Amount") }
  if (get("Line.Description")) line.Description = get("Line.Description")
  if (entity === "Deposit") {
    line.DetailType = "DepositLineDetail"
    const d: Obj = { AccountRef: { value: get("Line.AccountRef") } }
    if (get("Line.EntityRef")) d.Entity = { value: get("Line.EntityRef"), type: "Customer" }
    if (get("Line.PaymentMethodRef")) d.PaymentMethodRef = { value: get("Line.PaymentMethodRef") }
    if (get("Line.CheckNum")) d.CheckNum = get("Line.CheckNum")
    line.DepositLineDetail = d
  } else if (entity === "Bill" || entity === "Purchase") {
    line.DetailType = "AccountBasedExpenseLineDetail"
    const d: Obj = { AccountRef: { value: get("Line.AccountRef") } }
    if (get("Line.CustomerRef")) d.CustomerRef = { value: get("Line.CustomerRef") }
    line.AccountBasedExpenseLineDetail = d
  } else {
    line.DetailType = "SalesItemLineDetail"
    const d: Obj = { ItemRef: { value: get("Line.ItemRef") } }
    if (get("Line.Qty")) d.Qty = num("Line.Qty")
    if (get("Line.UnitPrice")) d.UnitPrice = num("Line.UnitPrice")
    line.SalesItemLineDetail = d
  }
  return line
}

function textValue(value: unknown): string {
  if (value == null || value === "") return ""
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value === "object") {
    const item = value as { value?: unknown; Address?: unknown; FreeFormNumber?: unknown }
    if (item.value != null) return String(item.value)
    if (item.Address != null) return String(item.Address)
    if (item.FreeFormNumber != null) return String(item.FreeFormNumber)
    return JSON.stringify(value)
  }
  return String(value)
}

function lineObjectToDraft(entity: string, line: Obj): Record<string, string> {
  const out: Record<string, string> = {}
  if (line.Amount != null) out["Line.Amount"] = String(line.Amount)
  if (line.Description != null) out["Line.Description"] = String(line.Description)
  if (entity === "Payment") {
    const link = (Array.isArray(line.LinkedTxn) ? line.LinkedTxn[0] : undefined) as { TxnId?: unknown; TxnType?: unknown } | undefined
    if (link?.TxnId != null) out["Line.TxnId"] = String(link.TxnId)
    if (link?.TxnType != null) out["Line.TxnType"] = String(link.TxnType)
    return out
  }
  const detail = (line.DepositLineDetail ?? line.AccountBasedExpenseLineDetail ?? line.SalesItemLineDetail) as Obj | undefined
  if (!detail) return out
  const account = detail.AccountRef as { value?: unknown } | undefined
  const item = detail.ItemRef as { value?: unknown } | undefined
  const customer = detail.CustomerRef as { value?: unknown } | undefined
  const party = detail.Entity as { value?: unknown } | undefined
  const method = detail.PaymentMethodRef as { value?: unknown } | undefined
  if (account?.value != null) out["Line.AccountRef"] = String(account.value)
  if (item?.value != null) out["Line.ItemRef"] = String(item.value)
  if (customer?.value != null) out["Line.CustomerRef"] = String(customer.value)
  if (party?.value != null) out["Line.EntityRef"] = String(party.value)
  if (method?.value != null) out["Line.PaymentMethodRef"] = String(method.value)
  if (detail.CheckNum != null) out["Line.CheckNum"] = String(detail.CheckNum)
  if (detail.Qty != null) out["Line.Qty"] = String(detail.Qty)
  if (detail.UnitPrice != null) out["Line.UnitPrice"] = String(detail.UnitPrice)
  return out
}

function describe(entity: string, o: Obj | undefined, bId: unknown): string {
  if (!o) return `Record ${bId}: created`
  const ref = (o.VendorRef ?? o.CustomerRef ?? o.EntityRef ?? o.DepositToAccountRef) as { name?: string } | undefined
  const name = ref?.name ?? (o.DisplayName as string | undefined)
  const amt = o.TotalAmt !== undefined ? ` = ${Number(o.TotalAmt).toLocaleString("en-US", { style: "currency", currency: "USD" })}` : ""
  return `${entity} ${o.Id}${amt}${name ? ` — ${name}` : ""}`
}

export default function BatchBuilderPage() {
  const [entity, setEntity] = useState("Bill")
  const schema = BATCH_SCHEMAS[entity]
  const all = useMemo(() => [...schema.fields, ...(schema.lineFields ?? [])], [schema])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [records, setRecords] = useState<Obj[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [results, setResults] = useState<string[] | null>(null)
  const [editingBid, setEditingBid] = useState<number | null>(null)
  const [checkedBids, setCheckedBids] = useState<number[]>([])
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [lines, setLines] = useState<Record<string, string>[]>([])
  const [added, setAdded] = useState<Record<string, { header: Record<string, string>; lines: Record<string, string>[] }[]>>({})
  const [options, setOptions] = useState<Record<string, Opt[] | "loading" | "error">>({})
  const addedRows = added[entity] ?? []

  const selected = useMemo(
    () => all.filter(f => f.required || picked.has(f.name)),
    [all, picked],
  )

  useEffect(() => {
    for (const f of selected) {
      const src = refSource(entity, f.name)
      const key = optionKey(entity, f.name)
      if (!src || options[key]) continue
      setOptions(o => ({ ...o, [key]: "loading" }))
      const accountColumns = src[0] === "Account" ? ", AccountType, AccountSubType" : ""
      const q = `SELECT Id, ${src[1]}${accountColumns} FROM ${src[0]}${src[2] ? " " + src[2] : ""} MAXRESULTS 1000`
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "GET", path: "/query", query: new URLSearchParams({ query: q }).toString() }),
      })
        .then(r => r.json())
        .then(j => {
          const rows = ((j.data?.QueryResponse?.[src[0]] as Obj[] | undefined) ?? []).filter(r => {
            if (entity !== "Payment" || f.name !== "DepositToAccountRef") return true
            return r.AccountType === "Bank" || r.AccountSubType === "UndepositedFunds"
          })
          if (j.status >= 300) throw new Error("query failed")
          setOptions(o => ({ ...o, [key]: rows.map(r => ({ id: String(r.Id), name: String(r[src[1]] ?? ""), type: r.AccountType ? String(r.AccountType) : undefined })) }))
        })
        .catch(() => setOptions(o => ({ ...o, [key]: "error" })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, selected])

  const split = () => {
    const header: Record<string, string> = {}
    const line: Record<string, string> = {}
    for (const [k, v] of Object.entries(draft)) (k.startsWith("Line.") ? line : header)[k] = v
    return { header, line, hasLine: Object.values(line).some(v => v !== "") }
  }
  const addLine = () => {
    const { line, hasLine } = split()
    if (!hasLine) return
    setLines(l => [...l, line])
    setDraft(d => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith("Line."))))
  }
  const [copies, setCopies] = useState(2)
  const addRecord = (count = 1) => {
    const { header, line, hasLine } = split()
    const all = hasLine ? [...lines, line] : lines
    setAdded(a => ({ ...a, [entity]: [...(a[entity] ?? []), ...Array.from({ length: count }, () => ({ header: { ...header }, lines: all.map(l => ({ ...l })) }))] }))
    setDraft({})
    setLines([])
  }
  const optName = (field: string, id: string) => {
    const o = options[optionKey(entity, field)]
    return (Array.isArray(o) && o.find(x => x.id === id)?.name) || id
  }
  const clearAdded = () => setAdded(a => ({ ...a, [entity]: [] }))

  const reset = () => { setRecords([]); setProblems([]); setResults(null); setEditingBid(null); setCheckedBids([]) }
  const changeEntity = (e: string) => { setEntity(e); setPicked(new Set()); setDraft({}); setLines([]); reset() }
  const toggle = (n: string) => {
    setPicked(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
    if (editingBid == null) reset()
  }

  const addedRowObjects = () => {
    const out: Record<string, string>[] = []
    addedRows.forEach((rec, i) => {
      const n = Math.max(1, rec.lines.length)
      for (let k = 0; k < n; k++) {
        const vals: Record<string, string> = { ...rec.header, ...(rec.lines[k] ?? {}) }
        if (schema.lineFields) vals["Group"] = String(i + 1)
        out.push(vals)
      }
    })
    return out
  }

  const download = () => {
    const cols = [...(schema.lineFields ? ["Group"] : []), ...selected.map(f => f.name)]
    const rows = addedRowObjects().map(v => cols.map(c => v[c] ?? ""))
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows])
    const help = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ...(schema.lineFields ? [["Group", "No", "Rows with the same Group number are ONE record with several lines. Header fields (like the vendor) are repeated on every row."]] : []),
      ...selected.map(f => [f.name, f.required ? "Yes" : "No", f.hint ?? ""]),
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.utils.book_append_sheet(wb, help, "Help")
    XLSX.writeFile(wb, `${entity}-batch-template.xlsx`)
  }

  const upload = async (file: File) => {
    reset()
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true })
    const cell = (v: unknown): string => {
      if (v instanceof Date) return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10)
      const t = String(v ?? "").trim()
      const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
      if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
      return t
    }
    processRows(
      raw
        .map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), cell(v)])))
        .filter(r => Object.values(r).some(v => v !== "")),
    )
  }

  const processRows = (rows: Record<string, string>[]) => {
    reset()
    const errs: string[] = []
    const recs: Obj[] = []
    const groups = new Map<string, Obj>()
    const lineNames = new Set((schema.lineFields ?? []).map(f => f.name))
    rows.forEach((row, i) => {
      const n = i + 2
      const group = (row["Group"] ?? "").toString().trim()
      let rec = group ? groups.get(group) : undefined
      // A row with no Group and no header values is another line of the previous record
      const headerBlank = schema.fields.every(f => (row[f.name] ?? "").toString().trim() === "")
      if (!rec && !group && headerBlank && schema.lineFields && recs.length > 0) rec = recs[recs.length - 1]
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
        try {
          const line = buildLine(entity, row)
          if (line) ((rec.Line as Obj[]) ??= []).push(line)
        } catch (e) { errs.push(`Row ${n}: ${e instanceof Error ? e.message : "invalid line"}`) }
      }
    })
    void lineNames
    setRecords(recs)
    setProblems(errs)
  }

  const assemble = (header: Record<string, string>, lineRows: Record<string, string>[]) => {
    const errs: string[] = []
    const rec: Obj = {}
    for (const field of schema.fields) {
      const value = (header[field.name] ?? "").trim()
      if (!value) {
        if (field.required) errs.push(`${field.name} is required`)
        continue
      }
      try { rec[field.name] = convert(field, value) } catch { errs.push(`${field.name} is not valid`) }
    }
    for (const row of lineRows) {
      for (const field of schema.lineFields ?? []) {
        if (field.required && !(row[field.name] ?? "").trim()) errs.push(`${field.name} is required`)
      }
      try {
        const line = buildLine(entity, row)
        if (line) ((rec.Line as Obj[]) ??= []).push(line)
      } catch (e) { errs.push(e instanceof Error ? e.message : "invalid line") }
    }
    return { rec, errs }
  }

  const loadBid = (index: number) => {
    const record = records[index]
    const stored = added[entity]?.[index]
    if (!record && !stored) return
    const header: Record<string, string> = stored ? { ...stored.header } : {}
    if (!stored && record) {
      for (const field of schema.fields) {
        const text = textValue(record[field.name])
        if (text) header[field.name] = text
      }
    }
    const parsed = stored
      ? stored.lines.map(line => ({ ...line }))
      : (Array.isArray(record?.Line) ? record.Line : []).map(line => lineObjectToDraft(entity, line as Obj))
    const savedLines = parsed.slice(0, -1)
    const openLine = parsed[parsed.length - 1] ?? {}
    setPicked(current => {
      const next = new Set(current)
      for (const field of all) {
        if (header[field.name] || parsed.some(line => line[field.name])) next.add(field.name)
      }
      return next
    })
    setDraft({ ...header, ...openLine })
    setLines(savedLines)
    setEditingBid(index)
    setCheckedBids(current => current.includes(index) ? current : [...current, index])
  }

  const updateBid = () => {
    if (editingBid == null) return
    const { header, line, hasLine } = split()
    const lineRows = hasLine ? [...lines, line] : lines
    const { rec, errs } = assemble(header, lineRows)
    setRecords(current => current.map((item, index) => index === editingBid ? rec : item))
    setAdded(current => {
      const list = current[entity]
      if (!list?.[editingBid]) return current
      const next = list.slice()
      next[editingBid] = { header: { ...header }, lines: lineRows.map(row => ({ ...row })) }
      return { ...current, [entity]: next }
    })
    setProblems(current => [
      ...current.filter(problem => !problem.startsWith(`Row ${editingBid + 2}:`) && !problem.startsWith(`bId ${editingBid + 1}:`)),
      ...errs.map(err => `bId ${editingBid + 1}: ${err}`),
    ])
    setEditingBid(null)
    setDraft({})
    setLines([])
  }

  const allBidsChecked = records.length > 0 && records.every((_, index) => checkedBids.includes(index))
  const toggleBid = (index: number) => setCheckedBids(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index])
  const toggleAllBids = () => setCheckedBids(allBidsChecked ? [] : records.map((_, index) => index))

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
              : describe(entity, it[entity] as Obj | undefined, it.bId),
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
            {(() => {
              const renderField = (f: BatchField) => {
                const val = draft[f.name] ?? ""
                const set = (v: string) => setDraft(d => ({ ...d, [f.name]: v }))
                const opts = options[optionKey(entity, f.name)]
                return (
                  <div key={f.name} className="space-y-1">
                    <span className="text-sm">{f.name.replace("Line.", "")}{f.required && <span className="text-rose-600"> *</span>}
                      {f.hint && <span className="text-xs text-muted-foreground"> — {f.hint}</span>}</span>
                    {STATIC_OPTIONS[f.name] ? (
                      <select value={val} onChange={e => set(e.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-sm" data-testid={`draft-${f.name}`}>
                        <option value="">— leave blank —</option>
                        {STATIC_OPTIONS[f.name].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : REF_SOURCES[f.name] ? (
                      opts === "error" ? <p className="text-xs text-rose-600">Could not load list from QuickBooks</p> : (
                        <select value={val} onChange={e => set(e.target.value)} disabled={opts === undefined || opts === "loading"}
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm" data-testid={`draft-${f.name}`}>
                          <option value="">{opts === "loading" || opts === undefined ? "Loading…" : "— leave blank —"}</option>
                          {Array.isArray(opts) && opts.map(o => <option key={o.id} value={o.id}>{o.name} ({o.id}){o.type ? ` · ${o.type}` : ""}</option>)}
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
              }
              const headerFs = selected.filter(f => !f.name.startsWith("Line."))
              const lineFs = selected.filter(f => f.name.startsWith("Line."))
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{headerFs.map(renderField)}</div>
                  {lineFs.length > 0 && (
                    <div className="rounded-md border p-4 space-y-3 bg-muted/10">
                      <div className="text-sm font-semibold">Lines on this {entity.toLowerCase()} ({lines.length} added)</div>
                      {lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-xs rounded bg-muted/40 px-3 py-1.5">
                          <span>Line {i + 1}: {lineFs.map(f => {
                            const v = l[f.name]
                            return v ? `${f.name.replace("Line.", "")} ${REF_SOURCES[f.name] ? optName(f.name, v) : v}` : null
                          }).filter(Boolean).join(" · ")}</span>
                          <button className="text-rose-600" onClick={() => setLines(x => x.filter((_, j) => j !== i))}>Remove</button>
                        </div>
                      ))}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{lineFs.map(renderField)}</div>
                      <Button variant="outline" size="sm" onClick={addLine} data-testid="button-add-line"><Plus className="w-4 h-4 mr-1" />Add another line</Button>
                    </div>
                  )}
                </>
              )
            })()}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => addRecord(1)} data-testid="button-add-record"><Plus className="w-4 h-4 mr-2" />Add {entity} to batch</Button>
              {editingBid != null && (
                <Button type="button" onClick={updateBid} data-testid="button-update-bid">Update bid {editingBid + 1}</Button>
              )}
              <div className="flex items-center gap-2 rounded-md bg-primary pl-3 pr-1 h-10 text-primary-foreground text-sm">
                <Plus className="w-4 h-4" />Add
                <input type="number" min={2} max={500} value={copies}
                  onChange={e => setCopies(Math.max(2, Math.min(500, Number(e.target.value) || 2)))}
                  className="w-16 h-8 rounded bg-background text-foreground px-2 text-center" data-testid="input-copies" />
                {entity} to batch
                <Button variant="secondary" size="sm" className="h-8" onClick={() => addRecord(copies)} data-testid="button-add-copies">Add</Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={download} data-testid="button-download">
              <Download className="w-4 h-4 mr-2" />4. Download Excel template
            </Button>
            <Button variant="outline" disabled={addedRows.length === 0} onClick={() => processRows(addedRowObjects())} data-testid="button-submit-added">
              <Send className="w-4 h-4 mr-2" />Submit added records ({addedRows.length})
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
          <div className="px-5 py-3 border-b space-y-2" data-testid="bid-list">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={allBidsChecked} onChange={toggleAllBids} aria-label="Select all bids" data-testid="checkbox-select-all-bids" />
                Bids
              </label>
              {editingBid != null && (
                <Button type="button" onClick={updateBid} data-testid="button-update-bid-list">Update bid {editingBid + 1}</Button>
              )}
            </div>
            {records.map((_, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 text-sm">
                <input type="checkbox" checked={checkedBids.includes(index)} onChange={() => { const turningOn = !checkedBids.includes(index); toggleBid(index); if (turningOn) loadBid(index) }} aria-label={`Select bId ${index + 1}`} data-testid={`checkbox-bid-${index + 1}`} />
                <span className="font-mono min-w-16">bId {index + 1}</span>
                <span>{entity}</span>
                {records[index].TotalAmt != null && records[index].TotalAmt !== "" && (
                  <span className="tabular-nums">{Number(records[index].TotalAmt).toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => loadBid(index)} data-testid={`button-edit-bid-${index + 1}`}>Edit</Button>
                {editingBid === index && (
                  <Button type="button" size="sm" onClick={updateBid} data-testid={`button-update-bid-row-${index + 1}`}>Update bid</Button>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">Batch JSON preview — {records.length} {entity} record{records.length === 1 ? "" : "s"} (sent 30 per request)</span>
            <Button onClick={send} disabled={sending || problems.length > 0} data-testid="button-send-batch">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to QuickBooks
            </Button>
          </div>
          <pre className="p-5 text-xs font-mono overflow-auto max-h-[400px]">{JSON.stringify(
            { BatchItemRequest: records.map((r, j) => ({ bId: String(j + 1), operation: "create", [entity]: r })) },
            null,
            2,
          )}</pre>
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
