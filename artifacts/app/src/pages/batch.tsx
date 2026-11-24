import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Download, Upload, Send, Loader2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BATCH_SCHEMAS, type BatchField } from "@/data/batch-schemas"

const API = `${import.meta.env.BASE_URL}api/qb/explorer/run`
const AUDIT_BATCH = `${import.meta.env.BASE_URL}api/qb/audit/batch`
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
    if (get("Line.Qty")) d.Qty = num("Line.Qty")
    if (get("Line.UnitPrice")) d.UnitPrice = num("Line.UnitPrice")
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

function money(value: unknown) {
  if (value === undefined || value === null || value === "") return ""
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : ""
}

function accountOf(record: Obj | undefined) {
  const ref = record?.DepositToAccountRef as { value?: unknown; name?: unknown } | undefined
  return { value: String(ref?.value ?? ""), name: String(ref?.name ?? "") }
}

function auditEntry(action: string, entity: string, record: Obj | undefined, fallbackId: string, original?: Obj) {
  const account = accountOf(record)
  const previous = accountOf(original)
  return {
    action,
    entity,
    id: String(record?.Id ?? fallbackId),
    txnDate: String(record?.TxnDate ?? original?.TxnDate ?? ""),
    totalAmt: money(record?.TotalAmt ?? original?.TotalAmt),
    originalAccount: action === "Update" || action === "Delete" ? previous.value : "",
    updatedAccount: action === "Delete" ? "" : account.value,
    accountRef: action === "Delete" ? previous.value : account.value,
    accountName: action === "Delete" ? previous.name : account.name,
  }
}

async function saveBatchAudit(entries: ReturnType<typeof auditEntry>[]) {
  const ready = entries.filter(entry => entry.id)
  if (ready.length === 0) return
  const response = await fetch(AUDIT_BATCH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: ready }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "The QuickBooks change was saved, but it could not be added to the audit register.")
}

function describe(entity: string, o: Obj | undefined, bId: unknown): string {
  if (!o) return `Record ${bId}: created`
  const ref = (o.VendorRef ?? o.CustomerRef ?? o.EntityRef ?? o.DepositToAccountRef) as { name?: string } | undefined
  const name = ref?.name ?? (o.DisplayName as string | undefined)
  const amt = o.TotalAmt !== undefined ? ` = ${Number(o.TotalAmt).toLocaleString("en-US", { style: "currency", currency: "USD" })}` : ""
  return `${entity} ${o.Id}${amt}${name ? ` — ${name}` : ""}`
}

type BatchAction = "Create" | "Update" | "Delete" | "Copy"
const BATCH_ACTIONS: BatchAction[] = ["Create", "Update", "Delete", "Copy"]
const SYSTEM_KEYS = new Set(["Id", "SyncToken", "MetaData", "domain", "sparse"])

interface FieldRow { path: string; value: unknown }

function flattenFields(value: unknown, path = ""): FieldRow[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return path ? [{ path, value }] : []
    return value.flatMap((item, index) => flattenFields(item, `${path}[${index}]`))
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Obj)
    if (entries.length === 0) return path ? [{ path, value }] : []
    return entries.flatMap(([key, child]) => flattenFields(child, path ? `${path}.${key}` : key))
  }
  return path ? [{ path, value }] : []
}

function pathTokens(path: string): (string | number)[] {
  const tokens: (string | number)[] = []
  for (const part of path.split(".")) {
    const re = /([^[\]]+)|\[(\d+)\]/g
    let match: RegExpExecArray | null
    while ((match = re.exec(part))) tokens.push(match[1] !== undefined ? match[1] : Number(match[2]))
  }
  return tokens
}

function setPath(root: Obj, path: string, value: unknown) {
  const tokens = pathTokens(path)
  let cursor: unknown = root
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i]
    const parent = cursor as Obj
    const next = parent[key as keyof Obj]
    if (next == null || typeof next !== "object") parent[key as keyof Obj] = {}
    cursor = parent[key as keyof Obj]
  }
  const last = tokens[tokens.length - 1]
  ;(cursor as Obj)[last as keyof Obj] = value
}

function coerce(original: unknown, raw: string): unknown {
  if (typeof original === "number") {
    const n = Number(raw.replace(/[$,\s]/g, ""))
    if (Number.isNaN(n)) throw new Error("not a number")
    return n
  }
  if (typeof original === "boolean") {
    if (/^(true|1|yes)$/i.test(raw)) return true
    if (/^(false|0|no)$/i.test(raw)) return false
    throw new Error("must be true or false")
  }
  if (original !== null && typeof original === "object") {
    try { return JSON.parse(raw) } catch { throw new Error("not valid JSON") }
  }
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try { return JSON.parse(raw) } catch { /* a string that only looks like JSON stays a string */ }
  }
  return raw
}

function isMeasurePath(path: string): boolean {
  return /(?:^|\.)(Qty|UnitPrice|Amount)$/.test(path)
}

function applyEdits(source: Obj, edits: Record<string, string>): { next: Obj; errors: string[]; touched: Set<string> } {
  const next = JSON.parse(JSON.stringify(source)) as Obj
  const errors: string[] = []
  const touched = new Set<string>()
  const known = new Map(flattenFields(source).map(row => [row.path, row.value]))
  for (const [path, rawValue] of Object.entries(edits)) {
    const raw = (rawValue ?? "").trim()
    if (!raw) continue
    touched.add(path.split(/[.[]/)[0] ?? path)
    const original = known.has(path) ? known.get(path) : (isMeasurePath(path) ? 0 : "")
    try { setPath(next, path, coerce(original, raw)) }
    catch (e) { errors.push(`${path}: ${e instanceof Error ? e.message : "invalid value"}`) }
  }
  return { next, errors, touched }
}

function changedTopLevel(after: Obj, touched: Set<string>): Obj {
  const patch: Obj = {}
  for (const key of touched) {
    if (key === "Id" || key === "SyncToken" || key === "sparse") continue
    patch[key] = after[key]
  }
  return patch
}

function stripSystem(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSystem)
  if (value && typeof value === "object") {
    const out: Obj = {}
    for (const [key, child] of Object.entries(value as Obj)) {
      if (SYSTEM_KEYS.has(key)) continue
      out[key] = stripSystem(child)
    }
    return out
  }
  return value
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

// Billing and shipping address blocks are never shown or offered.
const ADDRESS_BLOCKS = new Set(["BillAddr", "ShipAddr", "ShipFromAddr"])

function isAddressPath(path: string): boolean {
  return path.split(/[.[]/).some(part => ADDRESS_BLOCKS.has(part))
}

interface PartyFields { namePath?: string; idPath?: string; kind: "customer" | "vendor" }

function partyFields(rows: FieldRow[], entity: string): PartyFields | undefined {
  const paths = new Set(rows.map(row => row.path))
  const pair = (name: string, id: string, kind: "customer" | "vendor"): PartyFields | undefined => {
    if (!paths.has(name) && !paths.has(id)) return undefined
    return { namePath: paths.has(name) ? name : undefined, idPath: paths.has(id) ? id : undefined, kind }
  }
  return pair("CustomerRef.name", "CustomerRef.value", "customer")
    ?? pair("VendorRef.name", "VendorRef.value", "vendor")
    ?? pair("EntityRef.name", "EntityRef.value", String(fieldAt(rows, "EntityRef.type") ?? "").toLowerCase() === "customer" ? "customer" : "vendor")
    ?? (paths.has("DisplayName") ? { namePath: "DisplayName", idPath: paths.has("Id") ? "Id" : undefined, kind: entity === "Vendor" ? "vendor" : "customer" } : undefined)
}

function fieldAt(rows: FieldRow[], path: string): unknown {
  return rows.find(row => row.path === path)?.value
}

function isTaxAmountPath(path: string): boolean {
  return /TaxLine\[\d+\]\.Amount$/.test(path)
}

interface LineAmountRow { path: string; label: string; detail?: string }

const SERVICE_DETAILS = new Set(["SalesItemLineDetail", "ItemBasedExpenseLineDetail", "AccountBasedExpenseLineDetail"])
const LINE_ALWAYS = new Set(["Line.UnitPrice", "Line.Qty", "Line.Description"])

function lineInputLabel(name: string): string {
  if (name === "Line.UnitPrice") return "Unit price"
  if (name === "Line.Qty") return "Quantity"
  if (name === "Line.Amount") return "Amount"
  if (name === "Line.Description") return "Description"
  return name.replace("Line.", "")
}

function lineAmountRows(rows: FieldRow[]): LineAmountRow[] {
  const indexes = [...new Set(rows.flatMap(row => {
    const match = row.path.match(/^Line\[(\d+)\]\.Amount$/)
    return match ? [Number(match[1])] : []
  }))].sort((a, b) => a - b)
  const out: LineAmountRow[] = []
  let service = 0
  for (const index of indexes) {
    const detailType = String(fieldAt(rows, `Line[${index}].DetailType`) ?? "")
    if (detailType === "TaxLineDetail") continue
    const path = `Line[${index}].Amount`
    if (detailType === "SubTotalLineDetail") {
      out.push({ path, label: "SubTotalLineDetail" })
      continue
    }
    service += 1
    const description = fieldAt(rows, `Line[${index}].Description`)
    const text = typeof description === "string" ? description.trim() : ""
    if (detailType === "DepositLineDetail") {
      out.push({ path, label: `Line ${service} amount` })
      out.push({ path: `Line[${index}].Description`, label: `Line ${service} description` })
      continue
    }
    if (SERVICE_DETAILS.has(detailType)) {
      const prefix = `Line[${index}].${detailType}`
      out.push({ path: `${prefix}.UnitPrice`, label: `Line ${service} unit price` })
      out.push({ path: `${prefix}.Qty`, label: `Line ${service} qty` })
      out.push({ path, label: `Line ${service} amount`, detail: text || undefined })
    } else {
      out.push({ path, label: `Line ${service}`, detail: text || undefined })
    }
  }
  return out
}

function hiddenAmountPaths(rows: FieldRow[]): Set<string> {
  const hidden = new Set(rows.filter(row => isTaxAmountPath(row.path)).map(row => row.path))
  for (const row of rows) {
    const match = row.path.match(/^Line\[(\d+)\]\.Amount$/)
    if (!match) continue
    if (String(fieldAt(rows, `Line[${match[1]}].DetailType`) ?? "") === "TaxLineDetail") hidden.add(row.path)
  }
  return hidden
}

function defaultFieldPaths(rows: FieldRow[], entity: string): string[] {
  const chosen: string[] = []
  const add = (path: string | undefined) => {
    if (path && !chosen.includes(path) && !isAddressPath(path) && !isTaxAmountPath(path)) chosen.push(path)
  }
  const party = partyFields(rows, entity)
  add(rows.find(row => row.path === "TxnDate")?.path)
  add(rows.find(row => row.path === "TotalAmt")?.path)
  add(party?.namePath)
  add(party?.idPath)
  for (const line of lineAmountRows(rows)) add(line.path)
  return chosen
}

function fieldLabel(path: string, entity: string, rows: FieldRow[]): string {
  if (path === "TxnDate") return "Date"
  if (path === "TotalAmt") return "Total amount"
  const line = lineAmountRows(rows).find(item => item.path === path)
  if (line) return line.label
  const party = partyFields(rows, entity)
  const partyName = party?.kind === "vendor" ? "Vendor" : "Customer"
  if (party?.namePath === path) return partyName
  if (party?.idPath === path) return `${partyName} ID`
  return path
}

function faultMessage(data: unknown): string | null {
  const fault = (data as Obj | null)?.Fault as { Error?: { Message?: string; Detail?: string }[] } | undefined
  if (!fault?.Error?.length) return null
  return `${fault.Error[0]?.Message ?? "Request failed"} ${fault.Error[0]?.Detail ?? ""}`.trim()
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
  const [action, setAction] = useState<BatchAction>("Create")
  const [recordEntity, setRecordEntity] = useState("Bill")
  const [recordId, setRecordId] = useState("")
  const [loaded, setLoaded] = useState<Obj | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [extraFields, setExtraFields] = useState<string[]>([])
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [applying, setApplying] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [lines, setLines] = useState<Record<string, string>[]>([])
  const [added, setAdded] = useState<Record<string, { header: Record<string, string>; lines: Record<string, string>[] }[]>>({})
  const [options, setOptions] = useState<Record<string, Opt[] | "loading" | "error">>({})
  const addedRows = added[entity] ?? []

  const lineAlways = (name: string) =>
    ((entity === "Bill" || entity === "Purchase" || entity === "Invoice") && LINE_ALWAYS.has(name))
    || (entity === "Deposit" && name === "Line.Description")
  const selected = useMemo(
    () => all.filter(f => f.required || lineAlways(f.name) || picked.has(f.name)),
    [all, picked, entity],
  )
  const fieldRows = useMemo(() => (loaded ? flattenFields(loaded) : []), [loaded])
  const visibleRows = useMemo(() => {
    const lines = lineAmountRows(fieldRows)
    const order = defaultFieldPaths(fieldRows, recordEntity)
    const hidden = hiddenAmountPaths(fieldRows)
    const allowed = new Set(fieldRows.filter(row => !isAddressPath(row.path) && !hidden.has(row.path)).map(row => row.path))
    for (const path of extraFields) if (allowed.has(path) && !order.includes(path)) order.push(path)
    const byPath = new Map(fieldRows.map(row => [row.path, row]))
    const lineByPath = new Map(lines.map(line => [line.path, line]))
    const party = partyFields(fieldRows, recordEntity)
    return order.flatMap(path => {
      const row = byPath.get(path)
      const line = lineByPath.get(path)
      if (!row && !line) return []
      return [{
        path,
        value: row?.value ?? "",
        label: line?.label ?? fieldLabel(path, recordEntity, fieldRows),
        detail: line?.detail,
        readOnly: party?.namePath === path,
        inputType: path === "TxnDate" ? "date" as const : "text" as const,
      }]
    })
  }, [fieldRows, extraFields, recordEntity])
  const addableFields = useMemo(
    () => fieldRows.filter(row => !isAddressPath(row.path) && !hiddenAmountPaths(fieldRows).has(row.path) && !visibleRows.some(shown => shown.path === row.path)),
    [fieldRows, visibleRows],
  )
  const canEdit = action === "Update" || action === "Copy"

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
  const clearLoaded = () => { setLoaded(null); setEdits({}); setExtraFields([]); setActionError(null); setActionResult(null); setConfirmDelete(false) }
  const changeEntity = (e: string) => { setEntity(e); setPicked(new Set()); setDraft({}); setLines([]); reset() }
  const changeRecordEntity = (e: string) => { setRecordEntity(e); setRecordId(""); clearLoaded() }
  const onAction = (next: string) => { setAction(next as BatchAction); clearLoaded() }
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
    const audited: ReturnType<typeof auditEntry>[] = []
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
          const saved = it[entity] as Obj | undefined
          if (fault) out.push(`Record ${it.bId}: FAILED — ${fault.Error?.[0]?.Message ?? ""} ${fault.Error?.[0]?.Detail ?? ""}`)
          else {
            out.push(describe(entity, saved, it.bId))
            audited.push(auditEntry("Create", entity, saved, ""))
          }
        }
      }
      if (audited.length > 0) {
        try { await saveBatchAudit(audited) }
        catch (e) { out.push(`Audit: ${e instanceof Error ? e.message : "could not save the audit register"}`) }
      }
    } catch (e) {
      out.push(`Error: ${e instanceof Error ? e.message : "request failed"}`)
    } finally {
      setResults(out)
      setSending(false)
    }
  }

  const runExplorer = async (request: { method: "GET" | "POST"; path: string; query: string; body: string }) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, contentType: request.method === "POST" ? "application/json" : "" }),
    })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload.error ?? "Request failed")
    const fault = faultMessage(payload.data)
    if (payload.status >= 300 || fault) throw new Error(fault ?? `Request failed (${payload.status})`)
    return payload as { data?: Obj }
  }

  const loadRecord = async () => {
    const id = recordId.trim()
    if (!id) return
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      setActionError("Id can only contain letters, numbers, _ and -")
      setLoaded(null)
      setExtraFields([])
      return
    }
    setLoadingRecord(true)
    setActionError(null)
    setActionResult(null)
    setLoaded(null)
    setEdits({})
    setExtraFields([])
    try {
      const payload = await runExplorer({ method: "GET", path: `/${recordEntity.toLowerCase()}/${id}`, query: "", body: "" })
      const record = payload.data?.[recordEntity]
      if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`No ${recordEntity} returned for that Id`)
      setLoaded(record as Obj)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setLoadingRecord(false)
    }
  }

  const postRecord = async (query: string, body: Obj, mode: "update" | "copy" | "delete") => {
    setApplying(true)
    setActionError(null)
    setActionResult(null)
    try {
      const payload = await runExplorer({
        method: "POST",
        path: `/${recordEntity.toLowerCase()}`,
        query,
        body: JSON.stringify(body),
      })
      const record = payload.data?.[recordEntity]
      const saved = record && typeof record === "object" && !Array.isArray(record) ? record as Obj : undefined
      const action = mode === "delete" ? "Delete" : mode === "copy" ? "Copy" : "Update"
      const source = mode === "delete" ? loaded ?? undefined : saved
      try {
        await saveBatchAudit([auditEntry(action, recordEntity, source, String(body.Id ?? ""), loaded ?? undefined)])
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "The QuickBooks change was saved, but it could not be added to the audit register.")
      }
      if (mode === "delete") {
        setLoaded(null)
        setEdits({})
        setActionResult(`Deleted ${recordEntity} ${body.Id}`)
      } else if (mode === "copy") {
        setEdits({})
        setActionResult(`Copied as ${describe(recordEntity, saved, saved?.Id ?? "new")}`)
      } else {
        if (saved) setLoaded(saved)
        setEdits({})
        setActionResult(`Updated ${describe(recordEntity, saved, saved?.Id ?? body.Id)}`)
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setApplying(false)
    }
  }

  const applyRecord = async () => {
    if (!loaded) return
    const { next, errors, touched } = applyEdits(loaded, edits)
    if (errors.length) {
      setActionError(errors.join("; "))
      return
    }
    if (action === "Copy") {
      await postRecord("", stripSystem(next) as Obj, "copy")
      return
    }
    const patch = changedTopLevel(next, touched)
    const idChanged = String(next.Id ?? "") !== String(loaded.Id ?? "")
    const tokenChanged = String(next.SyncToken ?? "") !== String(loaded.SyncToken ?? "")
    if (Object.keys(patch).length === 0 && !idChanged && !tokenChanged) {
      setActionError("Type a new value for at least one field. A blank cell does not change that field.")
      return
    }
    // QuickBooks still requires the entity's required fields on a sparse update.
    for (const field of BATCH_SCHEMAS[recordEntity]?.fields ?? []) {
      if (field.required && next[field.name] !== undefined) patch[field.name] = next[field.name]
    }
    await postRecord("", {
      ...patch,
      sparse: true,
      Id: String(next.Id ?? loaded.Id),
      SyncToken: String(next.SyncToken ?? loaded.SyncToken ?? "0"),
    }, "update")
  }

  const deleteRecord = async () => {
    if (!loaded) return
    await postRecord("operation=delete", {
      Id: String(loaded.Id),
      SyncToken: String(loaded.SyncToken ?? "0"),
    }, "delete")
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Batch Builder</h1>
        <p className="text-muted-foreground mt-1">
          {action === "Create"
            ? "Choose an entity and fields, download an Excel template, fill it in, upload it, preview, then send."
            : "Choose an entity and Id, load the record, then update, delete, or copy it."}
        </p>
      </div>

      <div className="space-y-1.5 w-[220px]">
        <label className={label}>Action</label>
        <Select value={action} onValueChange={onAction}>
          <SelectTrigger data-testid="select-batch-action"><SelectValue /></SelectTrigger>
          <SelectContent>{BATCH_ACTIONS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {action === "Create" ? (<>
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
                    checked={!!f.required || lineAlways(f.name) || picked.has(f.name)}
                    disabled={!!f.required || lineAlways(f.name)}
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
                    <span className="text-sm">{lineInputLabel(f.name)}{f.required && <span className="text-rose-600"> *</span>}
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
                            return v ? `${lineInputLabel(f.name)} ${REF_SOURCES[f.name] ? optName(f.name, v) : v}` : null
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
      </>) : (
      <>
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 w-[220px]">
              <label className={label}>Entity</label>
              <Select value={recordEntity} onValueChange={changeRecordEntity}>
                <SelectTrigger data-testid="select-record-entity"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(BATCH_SCHEMAS).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-[220px]">
              <label className={label}>Id</label>
              <Input
                value={recordId}
                onChange={e => { setRecordId(e.target.value); setLoaded(null); setEdits({}); setExtraFields([]); setActionError(null); setActionResult(null) }}
                placeholder="QuickBooks Id"
                data-testid="input-record-id"
              />
            </div>
            <Button onClick={() => void loadRecord()} disabled={loadingRecord || recordId.trim() === ""} data-testid="button-load-record">
              {loadingRecord ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {actionError && !loaded && <p className="text-sm text-rose-600" data-testid="record-error">{actionError}</p>}

      {loaded && (
        <Card>
          <div className="px-5 py-3 border-b flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{recordEntity} {String(loaded.Id ?? recordId)} — {visibleRows.length} field{visibleRows.length === 1 ? "" : "s"}</div>
              {canEdit && <p className="text-xs text-muted-foreground mt-1">A blank cell does not change that field.</p>}
            </div>
            <div className="space-y-1.5 w-[260px]">
              <label className={label}>Add field</label>
              <Select key={extraFields.length} disabled={addableFields.length === 0} onValueChange={path => setExtraFields(current => current.includes(path) ? current : [...current, path])}>
                <SelectTrigger data-testid="select-add-field"><SelectValue placeholder={addableFields.length === 0 ? "No more fields" : "Add a field"} /></SelectTrigger>
                <SelectContent>
                  {addableFields.map(row => <SelectItem key={row.path} value={row.path}>{row.path}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full" data-testid="table-record-fields">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Field</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Value</th>
                  {canEdit && <th className="text-left px-3 py-2 whitespace-nowrap">New value</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.path} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap align-middle">
                      <span>{row.label}</span>
                      {row.label !== row.path && !row.path.startsWith("Line[") && <span className="ml-2 font-mono text-muted-foreground">{row.path}</span>}
                    </td>
                    <td className="px-3 py-1.5 break-all align-middle">
                      {row.detail && <span className="mr-3">{row.detail}</span>}
                      <span className="font-mono">{displayValue(row.value)}</span>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-1.5 align-middle">
                        {!row.readOnly && (
                          <Input
                            type={row.inputType}
                            value={edits[row.path] ?? ""}
                            onChange={e => setEdits(current => ({ ...current, [row.path]: e.target.value }))}
                            placeholder={row.inputType === "date" ? undefined : "Leave blank to keep"}
                            className="h-8 font-mono text-xs"
                            aria-label={`New value for ${row.path}`}
                            data-testid={`edit-${row.path}`}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t space-y-3">
            {actionError && <p className="text-sm text-rose-600" data-testid="record-error">{actionError}</p>}
            {action === "Delete" ? (
              <Button
                type="button"
                variant="outline"
                className="font-bold text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setConfirmDelete(true)}
                disabled={applying}
                data-testid="button-delete-record"
              >
                {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Delete
              </Button>
            ) : (
              <Button onClick={() => void applyRecord()} disabled={applying} data-testid="button-apply-record">
                {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {action}
              </Button>
            )}
          </div>
        </Card>
      )}

      {actionResult && (
        <Card><CardContent className="p-4 text-sm font-mono text-emerald-700" data-testid="record-result">{actionResult}</CardContent></Card>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">Are you sure you want to delete</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { window.setTimeout(() => void deleteRecord(), 250) }}
              data-testid="button-delete-confirm"
            >OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </div>
  )
}
