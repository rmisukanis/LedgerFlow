import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import ApiExplorer from '@/pages/apiExplorer';
import BatchBuilder from '@/pages/batch';
import Analysis from '@/pages/analysis';
import Reconcile from '@/pages/reconcile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const keptPages = [
  { id: "explorer", paths: ["/", "/crud", "/invoices", "/api-explorer"], Page: ApiExplorer },
  { id: "analysis", paths: ["/analysis"], Page: Analysis },
]

function Router() {
  const [location] = useLocation()
  const activeId = keptPages.find(page => page.paths.includes(location))?.id
  const [seen, setSeen] = useState<string[]>(() => (activeId ? [activeId] : []))

  if (activeId && !seen.includes(activeId)) {
    setSeen(current => (current.includes(activeId) ? current : [...current, activeId]))
  }

  return (
    <Layout>
      {keptPages.map(page => {
        if (!seen.includes(page.id)) return null
        const Page = page.Page
        const showing = page.id === activeId
        return (
          <div key={page.id} className={showing ? undefined : "hidden"}>
            <Page />
          </div>
        )
      })}
      {!activeId && (
        <Switch>
          <Route path="/batch" component={BatchBuilder} />
          <Route path="/reconcile" component={Reconcile} />
          <Route component={NotFound} />
        </Switch>
      )}
    </Layout>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
