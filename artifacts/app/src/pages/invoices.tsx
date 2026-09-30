import { useEffect, useMemo, useState } from "react"
import { Loader2, Send, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
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
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/catalog`).then(r => r.json()).then(setCatalog).catch(() => setError("Could not load the QuickBooks catalog."))
  }, [])

  const methods = useMemo(() => [...new Set(catalog.map(e => e.method))], [catalog])
  const folders = useMemo(
    () => [...new Set(catalog.filter(e => e.method === method).map(e => e.folder))],
    [catalog, method],
  )
  const ops = useMemo(() => catalog.filter(e => e.method === method && e.folder === folder), [catalog, method, folder])
  const entry = ops.find(o => o.name === opKey)
  const needsId = entry?.path.includes("{id}") ?? false
  const resolvedPath = entry ? entry.path.replace("{id}", id || "{id}") : ""

  const pick = (e: Entry | undefined) => {
    setOpKey(e?.name ?? "")
    setQuery(e?.query ?? "")
    setBody(e?.body ?? "")
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
              <Select value={folder} onValueChange={onFolder}>
                <SelectTrigger data-testid="select-entity"><SelectValue placeholder="Select entity" /></SelectTrigger>
                <SelectContent>{folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
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
            <>
              <div className="flex items-center gap-2 font-mono text-sm bg-muted/40 rounded px-3 py-2 break-all">
                <Badge>{entry.method}</Badge>
                <span>/v3/company/{"{realmId}"}{resolvedPath}{query ? `?${query}` : ""}</span>
              </div>
              {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
              <div className="space-y-1.5">
                <label className={label}>Query params</label>
                <Input value={query} onChange={e => setQuery(e.target.value)} className="font-mono text-xs" />
              </div>
              {entry.method === "POST" && (
                <div className="space-y-1.5">
                  <label className={label}>Body</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={8}
                    className="w-full rounded-md border bg-background p-3 font-mono text-xs"
                    data-testid="input-body"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {result && (
        <Card>
          <div className="px-5 py-3 border-b flex items-center gap-3 text-sm">
            <Badge variant="outline" className={result.status < 300 ? "text-emerald-700" : "text-rose-700"}>{result.status}</Badge>
            <span className="text-muted-foreground">{result.ms} ms</span>
          </div>
          <pre className="p-5 text-xs font-mono overflow-auto max-h-[500px]" data-testid="text-response">
            {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
