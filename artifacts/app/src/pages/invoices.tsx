import { useState } from "react"
import {
  Search, X, FileText, ArrowDownRight, Loader2, AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

import {
  listQbInvoices,
  listQbDeposits,
  useGetQbStatus,
  QbInvoice,
  QbDeposit,
} from "@workspace/api-client-react"

type DocType = "invoices" | "deposits"

interface Filters {
  docType: DocType
  dateFrom: string
  dateTo: string
  invoiceNumber: string
}

const EMPTY_FILTERS: Filters = {
  docType: "invoices",
  dateFrom: "",
  dateTo: "",
  invoiceNumber: "",
}

const qbStatusColors: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  open: "bg-blue-50 text-blue-700 border-blue-200",
}

export default function InvoicesPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [invoices, setInvoices] = useState<QbInvoice[] | null>(null)
  const [deposits, setDeposits] = useState<QbDeposit[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const { data: qbStatus } = useGetQbStatus()
  const qbConnected = qbStatus?.connected ?? false

  const hasApplied = applied !== null

  const handleSearch = async () => {
    const filters = { ...draft }
    setApplied(filters)
    setIsLoading(true)
    setSearchError(null)
    try {
      if (filters.docType === "invoices") {
        const data = await listQbInvoices({
          invoiceNumber: filters.invoiceNumber || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        })
        setInvoices(data)
        setDeposits(null)
      } else {
        const data = await listQbDeposits({
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        })
        setDeposits(data)
        setInvoices(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach QuickBooks."
      setSearchError(message)
      setInvoices(null)
      setDeposits(null)
      toast({ title: "Search failed", description: message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(null)
    setInvoices(null)
    setDeposits(null)
    setSearchError(null)
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Records</h1>
          <p className="text-muted-foreground mt-1">
            Search your QuickBooks invoices and deposits by date range or invoice number.
          </p>
        </div>
        {qbConnected && (
          <Badge variant="outline" className="shrink-0 text-emerald-700 border-emerald-200 bg-emerald-50">
            QuickBooks connected
          </Badge>
        )}
      </div>

      {/* Not-connected warning */}
      {!qbConnected && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              QuickBooks is not connected. Go to the Dashboard and connect your QuickBooks account to search records.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="shadow-sm border-muted">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Document Type */}
            <div className="space-y-1.5 min-w-[160px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Type</label>
              <Select
                value={draft.docType}
                onValueChange={(v: DocType) => setDraft(d => ({ ...d, docType: v, invoiceNumber: "" }))}
              >
                <SelectTrigger className="h-9 bg-background" data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoices">Invoices</SelectItem>
                  <SelectItem value="deposits">Deposits</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5 min-w-[150px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date From</label>
              <Input
                type="date"
                value={draft.dateFrom}
                onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))}
                className="h-9 bg-background"
                data-testid="input-date-from"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5 min-w-[150px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date To</label>
              <Input
                type="date"
                value={draft.dateTo}
                onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))}
                className="h-9 bg-background"
                data-testid="input-date-to"
              />
            </div>

            {/* Invoice Number — invoices only */}
            {draft.docType === "invoices" && (
              <div className="space-y-1.5 min-w-[160px]">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice No.</label>
                <Input
                  placeholder="e.g. 1012"
                  value={draft.invoiceNumber}
                  onChange={e => setDraft(d => ({ ...d, invoiceNumber: e.target.value }))}
                  className="h-9 bg-background"
                  data-testid="input-invoice-number"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pb-0.5 ml-auto">
              {hasApplied && (
                <Button variant="outline" size="sm" className="h-9" onClick={handleClear} data-testid="button-clear">
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                className="h-9 px-5 shadow-sm"
                onClick={handleSearch}
                disabled={!qbConnected || isLoading}
                data-testid="button-search"
              >
                {isLoading
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <Search className="w-3.5 h-3.5 mr-1.5" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {!hasApplied ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="w-12 h-12 mb-4 opacity-10" />
          <p className="text-sm font-medium">Set your filters and click Search to load records from QuickBooks</p>
        </div>
      ) : searchError ? (
        <Card className="border-rose-200">
          <CardContent className="p-8 flex flex-col items-center text-center gap-2">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <p className="text-sm font-semibold text-foreground">QuickBooks search failed</p>
            <p className="text-sm text-muted-foreground max-w-md">{searchError}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border-muted overflow-hidden">
          {/* Results header */}
          <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{applied.docType}</span>
              {applied.dateFrom && applied.dateTo && (
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDate(applied.dateFrom)} – {formatDate(applied.dateTo)}
                </span>
              )}
              {applied.invoiceNumber && (
                <Badge variant="outline" className="text-xs font-mono">{applied.invoiceNumber}</Badge>
              )}
            </div>
            {!isLoading && (
              <span className="text-xs text-muted-foreground">
                {applied.docType === "invoices"
                  ? `${invoices?.length ?? 0} record${invoices?.length === 1 ? "" : "s"}`
                  : `${deposits?.length ?? 0} record${deposits?.length === 1 ? "" : "s"}`}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : applied.docType === "invoices" ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!invoices || invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <FileText className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No invoices found in QuickBooks for this search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map(inv => (
                    <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="font-mono text-xs font-semibold">{inv.docNumber}</TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">{inv.customerName}</p>
                        {inv.customerEmail && (
                          <p className="text-xs text-muted-foreground">{inv.customerEmail}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.txnDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(inv.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(inv.balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${qbStatusColors[inv.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {inv.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Deposited To</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!deposits || deposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <ArrowDownRight className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No deposits found in QuickBooks for this search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deposits.map(dep => (
                    <TableRow key={dep.id} data-testid={`row-deposit-${dep.id}`}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {formatDate(dep.txnDate)}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{dep.accountName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dep.memo ?? "—"}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-emerald-600">
                        +{formatCurrency(dep.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
