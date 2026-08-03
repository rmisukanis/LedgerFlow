import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { 
  LineChart, Sparkles, Filter, Plus, ArrowUpRight, ArrowDownRight, 
  Trash2, Edit, AlertTriangle, CheckCircle2, Download, Search, Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"

import {
  useListTransactions,
  useGetTransactionSummary,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  getListTransactionsQueryKey,
  getGetTransactionSummaryQueryKey,
  Transaction,
  TransactionType,
  TransactionSource,
  TransactionStatus,
  TransactionImportInputSource
} from "@workspace/api-client-react"

export default function FinancialPage() {
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const { data: summary, isLoading: isLoadingSummary } = useGetTransactionSummary()
  const { data: transactions, isLoading: isLoadingTxs } = useListTransactions(
    { 
      search: search || undefined, 
      source: sourceFilter !== "all" ? sourceFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined
    },
    { query: { queryKey: ['txs', search, sourceFilter, statusFilter] } }
  )

  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Intelligence</h1>
          <p className="text-muted-foreground mt-1">Review transactions, resolve AI flags, and reconcile books.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                <Download className="w-4 h-4 mr-2" />
                Import Data
              </Button>
            </DialogTrigger>
            <ImportDialog onClose={() => setIsImportOpen(false)} />
          </Dialog>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <CreateTransactionDialog onClose={() => setIsCreateOpen(false)} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm bg-background">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Net Position</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.netAmount || 0)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-background">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" /> Action Required
            </p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{summary?.flagged || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-background">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold mt-1">{summary?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-background">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">Processed</p>
            <p className="text-2xl font-bold mt-1">
              {summary?.bySource?.reduce((acc, curr) => acc + curr.count, 0) || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-muted">
        <div className="p-4 border-b flex flex-wrap gap-4 items-center bg-muted/20">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search descriptions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-background shadow-sm w-full"
            />
          </div>
          <div className="w-[160px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 bg-background shadow-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px]">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-9 bg-background shadow-sm">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="quickbooks">QuickBooks</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="import">Import</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px] text-center">Source</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[100px] text-center">AI Flags</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTxs ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !transactions || transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <LineChart className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No transactions found</p>
                      <p className="text-xs">Try adjusting your filters or importing data.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const queryClient = useQueryClient()
  const deleteTx = useDeleteTransaction()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
    cleared: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    reconciled: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    flagged: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400",
  }

  const handleDelete = () => {
    deleteTx.mutate({ id: transaction.id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: `Transaction deleted.` })
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetTransactionSummaryQueryKey() })
        setIsDeleteOpen(false)
      }
    })
  }

  const hasFlags = transaction.aiFlags && transaction.aiFlags.length > 2 && transaction.aiFlags !== '[]' && transaction.aiFlags !== '{}'

  return (
    <>
      <TableRow className="group">
        <TableCell className="text-xs text-muted-foreground font-mono">{formatDate(transaction.transactionDate)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${
              transaction.type === 'income' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
            }`}>
              {transaction.type === 'income' ? <ArrowDownRight className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
            </div>
            <p className="font-semibold text-sm truncate max-w-[200px] lg:max-w-xs">{transaction.description}</p>
          </div>
        </TableCell>
        <TableCell className="text-xs">{transaction.category || '-'}</TableCell>
        <TableCell className={`text-right font-bold tabular-nums tracking-tight ${transaction.type === 'income' ? 'text-emerald-600' : ''}`}>
          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
        </TableCell>
        <TableCell className="text-center">
          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 h-5 bg-background">
            {transaction.source}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[transaction.status] || ''}`}>
            {transaction.status}
          </span>
        </TableCell>
        <TableCell className="text-center">
          {hasFlags ? (
            <div className="flex items-center justify-center text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 w-max mx-auto gap-1">
              <Sparkles className="w-3 h-3" />
              <span className="text-[10px] font-bold">FLAGGED</span>
            </div>
          ) : (
            <span className="text-muted-foreground/30">-</span>
          )}
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
        <EditTransactionDialog transaction={transaction} onClose={() => setIsEditOpen(false)} />
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Transaction
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground my-4">
            Are you sure you want to delete this transaction? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTx.isPending}>
              {deleteTx.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateTransactionDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const createTx = useCreateTransaction()
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "0.00",
    type: TransactionType.expense as typeof TransactionType[keyof typeof TransactionType],
    category: "",
    transactionDate: new Date().toISOString().split('T')[0],
    source: TransactionSource.manual as typeof TransactionSource[keyof typeof TransactionSource],
    status: TransactionStatus.pending as typeof TransactionStatus[keyof typeof TransactionStatus],
    notes: ""
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createTx.mutate({ 
      data: {
        ...formData,
        amount: parseFloat(formData.amount),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Transaction created." })
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetTransactionSummaryQueryKey() })
        onClose()
      }
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Transaction</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Description</label>
          <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Type</label>
            <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(TransactionType).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Date</label>
            <Input type="date" required value={formData.transactionDate} onChange={e => setFormData({...formData, transactionDate: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Category</label>
            <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Software" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Status</label>
            <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(TransactionStatus).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Source</label>
            <Select value={formData.source} onValueChange={(v: any) => setFormData({...formData, source: v})} disabled>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Notes</label>
          <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={createTx.isPending}>
            {createTx.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Transaction
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function EditTransactionDialog({ transaction, onClose }: { transaction: Transaction, onClose: () => void }) {
  const queryClient = useQueryClient()
  const updateTx = useUpdateTransaction()
  
  const [formData, setFormData] = useState({
    description: transaction.description,
    amount: transaction.amount.toString(),
    type: transaction.type,
    category: transaction.category || "",
    transactionDate: transaction.transactionDate.split('T')[0],
    status: transaction.status,
    notes: transaction.notes || ""
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateTx.mutate({ 
      id: transaction.id,
      data: {
        ...formData,
        amount: parseFloat(formData.amount),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Updated", description: "Transaction updated." })
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetTransactionSummaryQueryKey() })
        onClose()
      }
    })
  }

  const hasFlags = transaction.aiFlags && transaction.aiFlags.length > 2 && transaction.aiFlags !== '[]' && transaction.aiFlags !== '{}'

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit Transaction</DialogTitle>
      </DialogHeader>
      
      {hasFlags && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 my-2 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-bold mb-1">
            <Sparkles className="w-4 h-4" /> AI Flags
          </div>
          <pre className="font-mono text-xs whitespace-pre-wrap">{transaction.aiFlags}</pre>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Description</label>
          <Input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
            <Input type="number" step="0.01" min="0" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Type</label>
            <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(TransactionType).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Date</label>
            <Input type="date" required value={formData.transactionDate} onChange={e => setFormData({...formData, transactionDate: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Category</label>
            <Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(TransactionStatus).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Notes</label>
          <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={updateTx.isPending}>
            {updateTx.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Update
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const importTxs = useImportTransactions()
  const [jsonStr, setJsonStr] = useState("")

  const handleImport = () => {
    importTxs.mutate({
      data: {
        source: TransactionImportInputSource.excel,
        data: jsonStr
      }
    }, {
      onSuccess: () => {
        toast({ title: "Import Successful", description: "Transactions imported." })
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() })
        queryClient.invalidateQueries({ queryKey: getGetTransactionSummaryQueryKey() })
        onClose()
      },
      onError: () => {
        toast({ title: "Import Failed", description: "Invalid JSON format or server error.", variant: "destructive" })
      }
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Import Transactions</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-4">
        <p className="text-sm text-muted-foreground">Paste a JSON array of transactions below to import them into the system. Our AI will automatically flag anomalies.</p>
        <Textarea 
          value={jsonStr} 
          onChange={e => setJsonStr(e.target.value)} 
          placeholder='[{"description": "AWS", "amount": 120.00, "type": "expense", ...}]'
          className="font-mono text-xs h-64"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!jsonStr || importTxs.isPending}>
            {importTxs.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Process Import
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  )
}
