import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { 
  FileText, Plus, UploadCloud, Search, MoreHorizontal, 
  Trash2, Edit, AlertCircle, Loader2, Download,
  CheckCircle2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

import { 
  useListInvoices, 
  useCreateInvoice, 
  useUpdateInvoice, 
  useDeleteInvoice,
  getListInvoicesQueryKey,
  Invoice,
  InvoiceStatus
} from "@workspace/api-client-react"

export default function InvoicesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  const { data: invoices, isLoading } = useListInvoices(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: ['invoices', search, statusFilter] } }
  )

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [isUploadLoading, setIsUploadLoading] = useState(false)

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage billing, track payments, and sync to QuickBooks.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                <UploadCloud className="w-4 h-4 mr-2" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <BulkUploadDialog onClose={() => setIsBulkOpen(false)} />
          </Dialog>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
            <CreateInvoiceDialog onClose={() => setIsCreateOpen(false)} />
          </Dialog>
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/20">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by customer or number..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background shadow-sm"
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 bg-background shadow-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px]">Invoice No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !invoices || invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No invoices found</p>
                      <p className="text-xs">Adjust your search or create a new invoice.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient()
  const deleteInv = useDeleteInvoice()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
    sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    overdue: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-500"
  }

  const handleDelete = () => {
    deleteInv.mutate({ id: invoice.id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: `Invoice ${invoice.invoiceNumber} deleted.` })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        setIsDeleteOpen(false)
      }
    })
  }

  return (
    <>
      <TableRow className="group">
        <TableCell className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</TableCell>
        <TableCell>
          <p className="font-semibold">{invoice.customerName}</p>
          <p className="text-xs text-muted-foreground">{invoice.customerEmail}</p>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{formatDate(invoice.issueDate)}</TableCell>
        <TableCell className="text-muted-foreground text-xs">{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</TableCell>
        <TableCell className="text-right font-bold tabular-nums tracking-tight">
          {formatCurrency(invoice.amount)}
        </TableCell>
        <TableCell className="text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[invoice.status] || ''}`}>
            {invoice.status}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setIsEditOpen(true)}>
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleteOpen(true)}>
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
            Are you sure you want to delete invoice <strong className="text-foreground">{invoice.invoiceNumber}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteInv.isPending}>
              {deleteInv.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateInvoiceDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const createInv = useCreateInvoice()
  
  const [formData, setFormData] = useState({
    invoiceNumber: `INV-${Math.floor(Math.random()*10000)}`,
    customerName: "",
    customerEmail: "",
    amount: "0.00",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    status: InvoiceStatus.draft as typeof InvoiceStatus[keyof typeof InvoiceStatus]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createInv.mutate({ 
      data: {
        ...formData,
        amount: parseFloat(formData.amount),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Invoice created successfully." })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        onClose()
      }
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create Invoice</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Invoice Number</label>
            <Input required value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(InvoiceStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Customer Name</label>
          <Input required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Issue Date</label>
            <Input type="date" required value={formData.issueDate} onChange={e => setFormData({...formData, issueDate: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createInv.isPending}>
            {createInv.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Invoice
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function EditInvoiceDialog({ invoice, onClose }: { invoice: Invoice, onClose: () => void }) {
  const queryClient = useQueryClient()
  const updateInv = useUpdateInvoice()
  
  const [formData, setFormData] = useState({
    customerName: invoice.customerName,
    amount: invoice.amount.toString(),
    status: invoice.status as typeof InvoiceStatus[keyof typeof InvoiceStatus]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateInv.mutate({ 
      id: invoice.id,
      data: {
        customerName: formData.customerName,
        amount: parseFloat(formData.amount),
        status: formData.status
      }
    }, {
      onSuccess: () => {
        toast({ title: "Updated", description: "Invoice updated successfully." })
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
        onClose()
      }
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Invoice {invoice.invoiceNumber}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Customer Name</label>
          <Input required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(InvoiceStatus).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={updateInv.isPending}>
            {updateInv.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Update Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function BulkUploadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<{created: number, failed: number, errors: string[]} | null>(null)

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setResults(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/invoices/bulk-upload', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setResults(data)
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() })
      toast({ title: "Upload Complete", description: `Created ${data.created} invoices.` })
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Bulk Upload Invoices</DialogTitle>
      </DialogHeader>
      
      {!results ? (
        <div className="space-y-6 mt-4">
          <div className="border-2 border-dashed border-muted rounded-xl p-8 text-center hover:bg-muted/10 transition-colors">
            <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <Input 
              type="file" 
              accept=".csv,.xlsx" 
              className="max-w-[250px] mx-auto"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground mt-4">Accepts .csv and .xlsx files.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Start Import
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <div className="space-y-6 mt-4 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Import Successful</h3>
            <div className="flex justify-center gap-8 text-sm">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-emerald-600">{results.created}</span>
                <span className="text-muted-foreground">Created</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-rose-600">{results.failed}</span>
                <span className="text-muted-foreground">Failed</span>
              </div>
            </div>
          </div>
          {results.errors?.length > 0 && (
            <div className="bg-rose-50 text-rose-800 text-xs p-4 rounded text-left max-h-32 overflow-auto">
              <p className="font-bold mb-1">Errors:</p>
              <ul className="list-disc pl-4 space-y-1">
                {results.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button onClick={onClose} className="w-full">Done</Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  )
}
