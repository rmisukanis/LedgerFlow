import React, { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  FileText, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCcw,
  Link as LinkIcon,
  Unlink,
  Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

import { 
  useGetQbStatus, 
  useGetQbAuthUrl, 
  useDisconnectQb, 
  useGetInvoiceSummary, 
  useGetTransactionSummary,
  getGetQbStatusQueryKey,
  useListTransactions
} from "@workspace/api-client-react"

export default function Dashboard() {
  const queryClient = useQueryClient()
  
  const { data: qbStatus, isLoading: qbLoading } = useGetQbStatus()
  const { data: qbAuthUrl } = useGetQbAuthUrl()
  const disconnectQb = useDisconnectQb()

  const { data: invoiceSummary, isLoading: invoiceLoading } = useGetInvoiceSummary()
  const { data: txSummary, isLoading: txLoading } = useGetTransactionSummary()
  
  const { data: recentTxs } = useListTransactions({ search: '' }, { query: { queryKey: ['recent-txs'] } }) // Note: ideally use a limit, but params only has source, status, search

  useEffect(() => {
    if (window.location.search.includes('qb_connected=true')) {
      toast({ 
        title: "QuickBooks Connected", 
        description: "Your account is now synced with QuickBooks.", 
      })
      window.history.replaceState({}, document.title, window.location.pathname)
      queryClient.invalidateQueries({ queryKey: getGetQbStatusQueryKey() })
    }
  }, [queryClient])

  const handleConnectQb = () => {
    if (qbAuthUrl?.url) {
      window.location.href = qbAuthUrl.url
    }
  }

  const handleDisconnectQb = () => {
    disconnectQb.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Disconnected", description: "QuickBooks has been disconnected." })
        queryClient.invalidateQueries({ queryKey: getGetQbStatusQueryKey() })
      }
    })
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your financial pulse and API activity.</p>
        </div>
        
        {/* QB Status Banner */}
        <div className="bg-card border rounded-lg p-1.5 pr-4 flex items-center gap-3 shadow-sm min-w-[280px]">
          {qbLoading ? (
            <div className="flex items-center gap-3 w-full py-1 px-2">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Checking status...</span>
            </div>
          ) : qbStatus?.connected ? (
            <>
              <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">QuickBooks</p>
                <p className="text-sm font-bold text-emerald-600 truncate max-w-[140px]">{qbStatus.companyName || "Connected"}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleDisconnectQb} disabled={disconnectQb.isPending}>
                {disconnectQb.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              </Button>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">QuickBooks</p>
                <p className="text-sm font-semibold">Not Connected</p>
              </div>
              <Button size="sm" onClick={handleConnectQb}>
                Connect
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Net */}
        <Card className="shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
            <Wallet className="w-16 h-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Net Position</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {txLoading ? <div className="h-8 w-24 bg-muted rounded animate-pulse" /> : (
              <div className="text-3xl font-bold tracking-tight">
                {formatCurrency(txSummary?.netAmount || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="flex items-center text-emerald-600">
                <ArrowUpRight className="w-3 h-3" /> {formatCurrency(txSummary?.totalIncome || 0)}
              </span>
              <span className="mx-1">&bull;</span>
              <span className="flex items-center text-rose-600">
                <ArrowDownRight className="w-3 h-3" /> {formatCurrency(txSummary?.totalExpenses || 0)}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Unpaid Invoices */}
        <Card className="shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <FileText className="w-16 h-16" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {invoiceLoading ? <div className="h-8 w-24 bg-muted rounded animate-pulse" /> : (
              <div className="text-3xl font-bold tracking-tight text-amber-600">
                {formatCurrency(invoiceSummary?.overdueAmount || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {invoiceSummary?.overdue || 0} invoices past due
            </p>
          </CardContent>
        </Card>

        {/* Flagged Transactions */}
        <Card className="shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Flagged Transactions</CardTitle>
            <Badge variant="destructive" className="font-mono text-xs">{txSummary?.flagged || 0}</Badge>
          </CardHeader>
          <CardContent>
            {txLoading ? <div className="h-8 w-24 bg-muted rounded animate-pulse" /> : (
              <div className="text-3xl font-bold tracking-tight">
                {txSummary?.flagged || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Requires review by accounting
            </p>
          </CardContent>
        </Card>

        {/* Invoice Collection Rate */}
        <Card className="shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Collected Revenue</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {invoiceLoading ? <div className="h-8 w-24 bg-muted rounded animate-pulse" /> : (
              <div className="text-3xl font-bold tracking-tight text-emerald-600">
                {formatCurrency(invoiceSummary?.paidAmount || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              From {invoiceSummary?.paid || 0} paid invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest processed transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!recentTxs ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))
              ) : recentTxs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent activity found.
                </div>
              ) : (
                recentTxs.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm border ${
                        tx.type === 'income' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                      }`}>
                        {tx.type === 'income' ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{new Date(tx.transactionDate).toLocaleDateString()}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 uppercase">{tx.source}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{tx.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <CardHeader>
            <CardTitle className="text-primary-foreground">Quick Actions</CardTitle>
            <CardDescription className="text-primary-foreground/70">Common financial workflows</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="secondary" className="w-full justify-start h-12 text-secondary-foreground" asChild>
              <a href="/invoices">
                <FileText className="mr-2 h-5 w-5 opacity-70" />
                Manage Invoices
              </a>
            </Button>
            <Button variant="secondary" className="w-full justify-start h-12 text-secondary-foreground" asChild>
              <a href="/financial">
                <Activity className="mr-2 h-5 w-5 opacity-70" />
                Review Transactions
              </a>
            </Button>
            <Button variant="secondary" className="w-full justify-start h-12 text-secondary-foreground" asChild>
              <a href="/api-explorer">
                <RefreshCcw className="mr-2 h-5 w-5 opacity-70" />
                Run Integration Sync
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
