import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Search, X, FileText, ArrowDownRight, Loader2,
  Edit, Trash2, AlertCircle, Plus
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

import {
  listInvoices,
  listTransactions,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  getListInvoicesQueryKey,
  Invoice,
  Transaction,
  InvoiceStatus,
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

export default function InvoicesPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [deposits, setDeposits] = useState<Transaction[] | null>(null)

  const hasApplied = applied !== null

  const handleSearch = async () => {
    const filters = { ...draft }
    setApplied(filters)
    setIsLoading(true)
    try {
      if (filters.docType === "invoices") {
        const data = await listInvoices({
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          invoiceNumber: filters.invoiceNumber || undefined,
        })
        setInvoices(data)
        setDeposits(null)
      } else {
        const data = await listTransactions({
          type: "income",
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        })
        setDeposits(data)
        setInvoices(null)
      }
    } catch {
      toast({ title: "Search failed", description: "Could not load records.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(null)
    setInvoices(null)
    setDeposits(null)
  }

  const invoiceStatusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    overdue: "bg-rose-50 text-rose-700 border-rose-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Records</h1>
          <p className="text-muted-foreground mt-1">Search invoices and deposits by date range or reference number.</p>
        </div>
        {applied?.docType === "invoices" && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm shrink-0" data-testid="button-create-invoice">
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
            <CreateInvoiceDialog onClose={() => setIsCreateOpen(false)} />
          </Dialog>
        )}
      </div>

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
                  placeholder="e.g. INV-001"
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
              <Button size="sm" className="h-9 px-5 shadow-sm" onClick={handleSearch} data-testid="button-search">
                <Search className="w-3.5 h-3.5 mr-1.5" />
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
          <p className="text-sm font-medium">Set your filters and click Search to load records</p>
        </div>
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
                  <TableHead className="w-[130px]">Invoice No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[110px] text-center">Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!invoices || invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <FileText className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No invoices found for this search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map(inv => (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      statusColors={invoiceStatusColors}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="w-[90px] text-center">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!deposits || deposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <ArrowDownRight className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No deposits found for this search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deposits.map(dep => (
                    <TableRow key={dep.id} data-testid={`row-deposit-${dep.id}`}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {formatDate(dep.transactionDate)}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{dep.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{dep.category || "—"}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-emerald-600">
                        +{formatCurrency(dep.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200">
                          {dep.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 h-5">
                          {dep.source}
                        </Badge>
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

// ─── Invoice Row ─────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  statusColors,
}: {
  invoice: Invoice
  statusColors: Record<string, string>
}) {
  const queryClient = useQueryClient()
  const deleteInv = useDeleteInvoice()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const handleDelete = () => {
    deleteInv.mutate({ id: invoice.id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: `Invoice ${invoice.invoiceNumber} deleted.` })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        setIsDeleteOpen(false)
      },
    })
  }

  return (
    <>
      <TableRow className="group" data-testid={`row-invoice-${invoice.id}`}>
        <TableCell className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</TableCell>
        <TableCell>
          <p className="font-semibold text-sm">{invoice.customerName}</p>
          {invoice.customerEmail && (
            <p className="text-xs text-muted-foreground">{invoice.customerEmail}</p>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDate(invoice.issueDate)}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
        </TableCell>
        <TableCell className="text-right font-bold tabular-nums">{formatCurrency(invoice.amount)}</TableCell>
        <TableCell className="text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[invoice.status] ?? ""}`}>
            {invoice.status}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => setIsEditOpen(true)}
              data-testid={`button-edit-invoice-${invoice.id}`}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setIsDeleteOpen(true)}
              data-testid={`button-delete-invoice-${invoice.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <EditInvoiceDialog invoice={invoice} onClose={() => setIsEditOpen(false)} />
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Delete Invoice
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground my-4">
            Delete <strong className="text-foreground">{invoice.invoiceNumber}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteInv.isPending} data-testid="button-confirm-delete">
              {deleteInv.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Create Invoice Dialog ───────────────────────────────────────────────────

function CreateInvoiceDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const createInv = useCreateInvoice()
  const [form, setForm] = useState({
    invoiceNumber: `INV-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    customerName: "",
    customerEmail: "",
    description: "",
    amount: "",
    issueDate: "",
    dueDate: "",
    status: "draft" as typeof InvoiceStatus[keyof typeof InvoiceStatus],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createInv.mutate({
      data: {
        ...form,
        amount: parseFloat(form.amount),
        customerEmail: form.customerEmail || undefined,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Invoice created" })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        onClose()
      },
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New Invoice</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Invoice No.</label>
            <Input required value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} data-testid="input-invoice-no" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={form.status} onValueChange={(v: typeof form.status) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(InvoiceStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Customer Name</label>
          <Input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} data-testid="input-customer-name" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Customer Email</label>
          <Input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} data-testid="input-customer-email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} data-testid="input-amount" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Issue Date</label>
            <Input type="date" required value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} data-testid="input-issue-date" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} data-testid="input-due-date" />
        </div>
        <DialogFooter className="pt-4 border-t mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createInv.isPending} data-testid="button-submit-invoice">
            {createInv.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

// ─── Edit Invoice Dialog ─────────────────────────────────────────────────────

function EditInvoiceDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient()
  const updateInv = useUpdateInvoice()
  const [form, setForm] = useState({
    customerName: invoice.customerName,
    amount: String(invoice.amount),
    status: invoice.status as typeof InvoiceStatus[keyof typeof InvoiceStatus],
    dueDate: invoice.dueDate?.split("T")[0] ?? "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateInv.mutate({
      id: invoice.id,
      data: {
        customerName: form.customerName,
        amount: parseFloat(form.amount),
        status: form.status,
        dueDate: form.dueDate || undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Invoice updated" })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        onClose()
      },
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit {invoice.invoiceNumber}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Customer Name</label>
          <Input required value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={form.status} onValueChange={(v: typeof form.status) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(InvoiceStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
          <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>
        <DialogFooter className="pt-4 border-t mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={updateInv.isPending}>
            {updateInv.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
