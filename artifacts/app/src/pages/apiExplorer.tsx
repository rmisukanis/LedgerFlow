import { useEffect, useMemo, useState } from "react"
import { Loader2, Send, AlertCircle, ChevronsUpDown } from "lucide-react"
import { reportToTable, downloadCsv } from "@/lib/report"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { GeneralLedgerBuilder } from "@/components/GeneralLedgerBuilder"
import { useGetQbStatus } from "@workspace/api-client-react"

interface Entry {
  folder: string
  name: string
  method: string
  path: string
  query: string
  body: string
  contentType: string
  description: string
}

interface RunResult {
  status: number
  ms: number
  url: string
  data: unknown
}

const storeKey = (e: Entry) => `qb-body:${e.method}:${e.folder}:${e.name}`
const API = `${import.meta.env.BASE_URL}api/qb/explorer`

export default function ApiExplorerPage() {
  const { data: qbStatus } = useGetQbStatus()
  const qbConnected = qbStatus?.connected ?? false

  const [catalog, setCatalog] = useState<Entry[]>([])
  const [method, setMethod] = useState("GET")
  const [folder, setFolder] = useState("")
  const [opKey, setOpKey] = useState("")
  const [id, setId] = useState("")
  const [query, setQuery] = useState("")
  const [body, setBody] = useState("")
  const [saveBody, setSaveBody] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const [entityOpen, setEntityOpen] = useState(false)
  const [colOrder, setColOrder] = useState<string[]>([])
  const table = useMemo(() => reportToTable(result?.data, colOrder), [result, colOrder])

  useEffect(() => {
    fetch(`${API}/catalog`).then(r => r.json()).then((c: Entry[]) => {
      c.push({ folder: "GeneralLedger", name: "Read", method: "GET", path: "/reports/GeneralLedger", query: "", body: "", contentType: "", description: "General Ledger report: every transaction in each account over a period." })
      setCatalog(c)
      const e = c.find(x => x.method === "GET" && x.folder === "Invoice") ?? c[0]
      if (e) { setMethod(e.method); setFolder(e.folder); loadEntry(e) }
    }).catch(() => setError("Could not load the QuickBooks catalog."))
  }, [])

  const methods = useMemo(() => [...new Set(catalog.map(e => e.method))], [catalog])
  const folders = useMemo(
    () => [...new Set(catalog.filter(e => e.method === method).map(e => e.folder))].sort((a, b) => a.localeCompare(b)),
    [catalog, method],
  )
  const ops = useMemo(() => catalog.filter(e => e.method === method && e.folder === folder), [catalog, method, folder])
  const entry = ops.find(o => o.name === opKey)
  const needsId = entry?.path.includes("{id}") ?? false
  const resolvedPath = entry ? entry.path.replace("{id}", id || "{id}") : ""

  const loadEntry = (e: Entry | undefined) => {
    const saved = e ? localStorage.getItem(storeKey(e)) : null
    setOpKey(e?.name ?? "")
    setQuery(e?.query ?? "")
    setBody(saved ?? e?.body ?? "")
    setSaveBody(saved !== null)
  }
  const pick = (e: Entry | undefined) => {
    loadEntry(e)
    setId("")
    setResult(null)
  }

  const onMethod = (m: string) => {
    setMethod(m)
    const f = catalog.find(e => e.method === m && e.folder === folder)?.folder ?? ""
    setFolder(f)
    pick(undefined)
  }
  const onFolder = (f: string) => {
    setFolder(f)
    pick(catalog.find(e => e.method === method && e.folder === f))
  }

  const run = async () => {
    if (!entry) return
    setRunning(true)
    setError(null)
    try {
      const r = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: entry.method, path: resolvedPath, query, body, contentType: entry.contentType }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? "Request failed")
      setResult(j)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setRunning(false)
    }
  }

  const label = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Explorer</h1>
          <p className="text-muted-foreground mt-1">Pick a method, entity and operation from your QuickBooks Postman collection.</p>
        </div>
        {qbConnected && (
          <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">QuickBooks connected</Badge>
        )}
      </div>

      {!qbConnected && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-800">QuickBooks is not connected.</p>
            <Button asChild className="ml-auto">
              <a href={`${import.meta.env.BASE_URL}api/qb/auth/connect`}>Connect QuickBooks</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 w-[110px]">
              <label className={label}>Method</label>
              <Select value={method} onValueChange={onMethod}>
                <SelectTrigger data-testid="select-method"><SelectValue /></SelectTrigger>
                <SelectContent>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-[200px]">
              <label className={label}>Entity</label>
              <Popover open={entityOpen} onOpenChange={setEntityOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" data-testid="select-entity">
                    <span className="truncate">{folder || "Select entity"}</span>
                    <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type to search…" />
                    <CommandList>
                      <CommandEmpty>No entity found.</CommandEmpty>
                      <CommandGroup>
                        {folders.map(f => (
                          <CommandItem key={f} value={f} onSelect={() => { onFolder(f); setEntityOpen(false) }}>{f}</CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5 w-[200px]">
              <label className={label}>Operation</label>
              <Select value={opKey} onValueChange={v => pick(ops.find(o => o.name === v))} disabled={!folder}>
                <SelectTrigger data-testid="select-operation"><SelectValue placeholder="Select operation" /></SelectTrigger>
                <SelectContent>{ops.map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {needsId && (
              <div className="space-y-1.5 w-[160px]">
                <label className={label}>Id</label>
                <Input value={id} onChange={e => setId(e.target.value)} placeholder="QuickBooks Id" data-testid="input-id" />
              </div>
            )}
            <Button className="ml-auto" onClick={run} disabled={!qbConnected || !entry || running || (needsId && !id)} data-testid="button-send">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </div>

          {entry && (
            <div className="rounded-md border bg-muted/20 p-4 space-y-4" data-testid="request-preview">
              <div className={label}>Request preview</div>
              <div className="flex items-start gap-2 font-mono text-sm break-all">
                <Badge className="shrink-0">{entry.method}</Badge>
                <span>/v3/company/{"{realmId}"}{resolvedPath}{query ? `?${query}` : ""}</span>
              </div>
              {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
              {entry.folder === "GeneralLedger" && <GeneralLedgerBuilder onChange={setQuery} onColumnOrder={setColOrder} />}
              <div className="space-y-1.5">
                <label className={label}>Query params</label>
                <Input value={query} onChange={e => setQuery(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                {entry.method === "POST" && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveBody}
                      onChange={e => {
                        setSaveBody(e.target.checked)
                        if (e.target.checked) localStorage.setItem(storeKey(entry), body)
                        else { localStorage.removeItem(storeKey(entry)); setBody(entry.body) }
                      }}
                      data-testid="checkbox-save-body"
                    />
                    Save my edited body for next time (uncheck to restore the original)
                  </label>
                )}
                <label className={label}>Body{entry.method === "POST" ? ` (${entry.contentType || "application/json"})` : ""}</label>
                {entry.method === "POST" ? (
                  <textarea
                    value={body}
                    onChange={e => {
                      setBody(e.target.value)
                      if (saveBody) localStorage.setItem(storeKey(entry), e.target.value)
                    }}
                    rows={14}
                    className="w-full rounded-md border bg-background p-3 font-mono text-xs"
                    data-testid="input-body"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No body — GET requests don&apos;t send one.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {result && (
        <Card>
          <div className="px-5 py-3 border-b flex items-center gap-3 text-sm">
            <Badge variant="outline" className={result.status < 300 ? "text-emerald-700" : "text-rose-700"}>{result.status}</Badge>
            <span className="text-muted-foreground">{result.ms} ms</span>
            <Button size="sm" variant="outline" className="ml-auto" data-testid="button-copy-response" onClick={() => {
              const text = typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)
              navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => setError("Could not copy the response"))
            }}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          {table && (
            <div className="border-b">
              <div className="px-5 py-2 flex items-center gap-3">
                <Button size="sm" onClick={() => downloadCsv(table)} data-testid="button-export-csv">Export CSV (opens in Excel)</Button>
                <Button size="sm" variant="outline" onClick={() => setShowRaw(s => !s)}>{showRaw ? "Show table" : "Show raw JSON"}</Button>
                <span className="text-xs text-muted-foreground">{table.rows.length} rows</span>
              </div>
              {!showRaw && (
                <div className="overflow-auto max-h-[500px]">
                  <table className="text-xs w-full" data-testid="table-report">
                    <thead className="sticky top-0 bg-muted"><tr>{table.head.map((h, i) => <th key={i} className="text-left px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <pre className={`p-5 text-xs font-mono overflow-auto max-h-[500px] ${table && !showRaw ? "hidden" : ""}`} data-testid="text-response">
            {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
