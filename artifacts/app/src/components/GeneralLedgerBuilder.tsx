import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { parseUsDate } from "@/lib/dates"

const RUN = `${import.meta.env.BASE_URL}api/qb/explorer/run`
const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const selectCls = "w-full h-10 rounded-md border bg-background px-3 text-sm"

// Parameters from https://developer.intuit.com/app/developer/qbo/docs/api/accounting/report-entities/generalledger
const DATE_MACROS = ["Today", "Yesterday", "This Week", "Last Week", "This Week-to-date", "Last Week-to-date", "Next Week", "Next 4 Weeks", "This Month", "Last Month", "This Month-to-date", "Last Month-to-date", "Next Month", "This Fiscal Quarter", "Last Fiscal Quarter", "This Fiscal Quarter-to-date", "Last Fiscal Quarter-to-date", "Next Fiscal Quarter", "This Fiscal Year", "Last Fiscal Year", "This Fiscal Year-to-date", "Last Fiscal Year-to-date", "Next Fiscal Year"]
const ACCOUNT_TYPES = ["AccountsPayable", "AccountsReceivable", "Bank", "CostOfGoodsSold", "CreditCard", "Equity", "Expense", "FixedAsset", "Income", "LongTermLiability", "NonPosting", "OtherAsset", "OtherCurrentAsset", "OtherCurrentLiability", "OtherExpense", "OtherIncome"]
const SUMMARIZE = ["Total", "Month", "Week", "Days", "Quarter", "Year", "Customers", "Vendors", "Classes", "Departments", "Employees", "ProductsAndServices"]
const COLUMNS = ["account_name", "chk_print_state", "create_by", "create_date", "cust_name", "doc_num", "emp_name", "inv_date", "is_adj", "is_ap_paid", "is_ar_paid", "is_cleared", "item_name", "last_mod_by", "last_mod_date", "memo", "name", "quantity", "rate", "split_acc", "tx_date", "txn_type", "vend_name", "subt_nat_amount", "rbal_nat_amount", "net_amount", "tax_amount", "tax_code", "account_num", "klass_name", "dept_name"]

// Title QuickBooks shows for each column key (checked against the API response)
const COL_TITLES: Record<string, string> = {
  tx_date: "Date", txn_type: "Transaction Type", doc_num: "Num", is_adj: "Adj", create_date: "Create Date", create_by: "Created By",
  last_mod_date: "Last Modified", last_mod_by: "Last Modified By", name: "Name", cust_name: "Customer", vend_name: "Vendor",
  emp_name: "Employee", item_name: "Product/Service", memo: "Memo/Description", quantity: "Qty", rate: "Rate", account_name: "Account",
  split_acc: "Split", inv_date: "Invoice Date", is_ar_paid: "A/R Paid", is_ap_paid: "A/P Paid", is_cleared: "Clr",
  chk_print_state: "Check Printed", subt_nat_amount: "Amount", rbal_nat_amount: "Balance", tax_code: "Tax Name",
  tax_amount: "Tax Amount", net_amount: "Taxable Amount", account_num: "Account #", klass_name: "Class", dept_name: "Location",
}

interface Opt { id: string; name: string }
type Values = Record<string, string | string[]>

function useLookup(entity: string, nameCol: string) {
  const [state, setState] = useState<Opt[] | "loading" | "error">("loading")
  useEffect(() => {
    fetch(RUN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", path: "/query", query: new URLSearchParams({ query: `SELECT Id, ${nameCol} FROM ${entity} MAXRESULTS 1000` }).toString() }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.status >= 300) throw new Error()
        const rows = (j.data?.QueryResponse?.[entity] as Record<string, string>[] | undefined) ?? []
        setState(rows.map(r => ({ id: String(r.Id), name: String(r[nameCol] ?? "") })))
      })
      .catch(() => setState("error"))
  }, [entity, nameCol])
  return state
}

function Check({ title, options, value, onChange, search }: { title: string; options: string[] | Opt[]; value: string[]; onChange: (v: string[]) => void; search?: boolean }) {
  const [q, setQ] = useState("")
  const items = (options as (string | Opt)[]).map(o => (typeof o === "string" ? { id: o, name: o } : o))
  const shown = q ? items.filter(o => o.name.toLowerCase().includes(q.toLowerCase())) : items
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <label className={label}>{title}{value.length > 0 && ` (${value.length} selected)`}</label>
        <button type="button" className="text-xs text-primary underline" onClick={() => onChange(items.map(i => i.id))} data-testid={`select-all-${title}`}>Select all</button>
        <button type="button" className="text-xs text-primary underline" onClick={() => onChange([])} data-testid={`clear-${title}`}>Clear</button>
      </div>
      {search && <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="h-8 text-sm" />}
      <div className={`${search ? "max-h-28" : "max-h-40"} overflow-auto rounded-md border bg-background p-2 space-y-1`}>
        {shown.map(o => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
            {o.name}{o.name !== o.id && !o.name.endsWith(` = ${o.id}`) && <span className="text-xs text-muted-foreground">({o.id})</span>}
          </label>
        ))}
      </div>
    </div>
  )
}

function Lookup({ title, entity, nameCol, value, onChange }: { title: string; entity: string; nameCol: string; value: string[]; onChange: (v: string[]) => void }) {
  const opts = useLookup(entity, nameCol)
  if (opts === "loading") return <div className="space-y-1.5"><label className={label}>{title}</label><p className="text-xs text-muted-foreground">Loading…</p></div>
  if (opts === "error") {
    return (
      <div className="space-y-1.5">
        <label className={label}>{title} (comma-separated Ids)</label>
        <Input value={value.join(",")} onChange={e => onChange(e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
      </div>
    )
  }
  if (opts.length === 0) return <div className="space-y-1.5"><label className={label}>{title}</label><p className="text-xs text-muted-foreground">None found in QuickBooks.</p></div>
  return <Check title={title} options={opts} value={value} onChange={onChange} search />
}

// Text box that takes MM/DD/YYYY and passes YYYY-MM-DD (what QuickBooks wants) up; "" while invalid.
function DateField({ onIso, testId }: { onIso: (iso: string) => void; testId: string }) {
  const [text, setText] = useState("")
  const bad = text !== "" && !parseUsDate(text)
  return (
    <>
      <Input
        value={text}
        placeholder="MM/DD/YYYY"
        className={bad ? "border-rose-400" : ""}
        onChange={e => { setText(e.target.value); onIso(parseUsDate(e.target.value)) }}
        data-testid={testId}
      />
      {bad && <p className="text-xs text-rose-600">Use MM/DD/YYYY</p>}
    </>
  )
}

// Selected columns, shown as a list you can drag to set the left-to-right order of the results table.
function ColumnOrder({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [from, setFrom] = useState<number | null>(null)
  if (value.length < 2) return null
  const drop = (to: number) => {
    if (from === null || from === to) return
    const next = [...value]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }
  return (
    <div className="space-y-1.5" data-testid="gl-column-order">
      <label className={label}>Column order (drag to rearrange, first = leftmost)</label>
      <div className="flex flex-wrap gap-2">
        {value.map((k, i) => (
          <div
            key={k}
            draggable
            onDragStart={() => setFrom(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { drop(i); setFrom(null) }}
            onDragEnd={() => setFrom(null)}
            className={`cursor-grab select-none rounded-md border bg-background px-2.5 py-1 text-sm ${from === i ? "opacity-40" : ""}`}
          >
            <span className="text-muted-foreground mr-1">⋮⋮</span>{COL_TITLES[k] ?? k}
          </div>
        ))}
      </div>
    </div>
  )
}

export function GeneralLedgerBuilder({ onChange, onColumnOrder }: { onChange: (query: string) => void; onColumnOrder: (keys: string[]) => void }) {
  const [v, setV] = useState<Values>({})
  const get = (k: string) => (v[k] as string) ?? ""
  const arr = (k: string) => (v[k] as string[]) ?? []
  const set = (k: string, val: string | string[]) => setV(p => ({ ...p, [k]: val }))

  useEffect(() => {
    const qs = new URLSearchParams()
    for (const k of ["start_date", "end_date", "date_macro", "accounting_method", "account", "source_account", "account_type", "customer", "vendor", "class", "department", "columns", "sort_by", "sort_order", "summarize_column_by"]) {
      const val = v[k]
      const s = Array.isArray(val) ? val.join(",") : val
      if (s) qs.set(k, s)
    }
    onChange(qs.toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v])

  const simpleSelect = (k: string, title: string, opts: string[]) => (
    <div className="space-y-1.5">
      <label className={label}>{title}</label>
      <select className={selectCls} value={get(k)} onChange={e => set(k, e.target.value)} data-testid={`gl-${k}`}>
        <option value="">— not set —</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-4" data-testid="gl-builder">
      <p className="text-xs text-muted-foreground">All of these are optional. Only the ones you set are added to the request.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5"><label className={label}>start_date</label><DateField onIso={x => set("start_date", x)} testId="gl-start_date" /></div>
        <div className="space-y-1.5"><label className={label}>end_date</label><DateField onIso={x => set("end_date", x)} testId="gl-end_date" /></div>
        {simpleSelect("date_macro", "date_macro", DATE_MACROS)}
        {simpleSelect("accounting_method", "accounting_method", ["Cash", "Accrual"])}
        {simpleSelect("account_type", "account_type", ACCOUNT_TYPES)}
        {simpleSelect("summarize_column_by", "summarize_column_by", SUMMARIZE)}
        {simpleSelect("sort_by", "sort_by", COLUMNS)}
        {simpleSelect("sort_order", "sort_order", ["ascend", "descend"])}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Lookup title="account" entity="Account" nameCol="Name" value={arr("account")} onChange={x => set("account", x)} />
        <Lookup title="source_account" entity="Account" nameCol="Name" value={arr("source_account")} onChange={x => set("source_account", x)} />
        <Lookup title="customer" entity="Customer" nameCol="DisplayName" value={arr("customer")} onChange={x => set("customer", x)} />
        <Lookup title="vendor" entity="Vendor" nameCol="DisplayName" value={arr("vendor")} onChange={x => set("vendor", x)} />
        <Lookup title="class" entity="Class" nameCol="Name" value={arr("class")} onChange={x => set("class", x)} />
        <Lookup title="department" entity="Department" nameCol="Name" value={arr("department")} onChange={x => set("department", x)} />
      </div>
      <Check title="columns" options={COLUMNS.map(c => ({ id: c, name: COL_TITLES[c] ? `${COL_TITLES[c]} = ${c}` : c }))} value={arr("columns")} onChange={x => set("columns", x)} />
      <p className="text-xs text-muted-foreground">For the transaction amount and running balance, tick <b>subt_nat_amount</b> (Amount) and <b>rbal_nat_amount</b> (Balance). <b>net_amount</b> is only the taxable amount, which is usually blank or zero.</p>
      <p className="text-xs text-muted-foreground">Some columns (tax, account number, class, location) only work if that feature is turned on in the company.</p>
    </div>
  )
}
