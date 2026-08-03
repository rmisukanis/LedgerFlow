import React, { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { 
  Play, Save, Plus, Folder, FileJson, Copy, Trash2, Edit2, 
  ChevronRight, ChevronDown, MoreVertical, Loader2, Send
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

import {
  useListApiCollections,
  useListApiRequests,
  useCreateApiRequest,
  useUpdateApiRequest,
  useDeleteApiRequest,
  useRunAdHocRequest,
  ApiRequest,
  ApiRequestMethod,
  ApiRequestBodyType,
  getListApiRequestsQueryKey
} from "@workspace/api-client-react"

export default function ApiExplorer() {
  const queryClient = useQueryClient()
  
  const { data: collections } = useListApiCollections()
  const { data: requests, isLoading: isLoadingRequests } = useListApiRequests()

  const [activeReqId, setActiveReqId] = useState<number | 'new'>('new')
  
  // Form State
  const [method, setMethod] = useState<typeof ApiRequestMethod[keyof typeof ApiRequestMethod]>('GET')
  const [url, setUrl] = useState("https://api.example.com/v1/users")
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
  const [queryParams, setQueryParams] = useState('{}')
  const [body, setBody] = useState('{\n  "name": "Jane Doe"\n}')
  const [bodyType, setBodyType] = useState<typeof ApiRequestBodyType[keyof typeof ApiRequestBodyType]>('json')
  const [reqName, setReqName] = useState("New Request")
  
  // Response State
  const [response, setResponse] = useState<any>(null)
  
  const runReq = useRunAdHocRequest()
  const createReq = useCreateApiRequest()
  const updateReq = useUpdateApiRequest()
  const deleteReq = useDeleteApiRequest()

  useEffect(() => {
    if (activeReqId !== 'new' && requests) {
      const r = requests.find(x => x.id === activeReqId)
      if (r) {
        setMethod(r.method)
        setUrl(r.url)
        setHeaders(r.headers || '{}')
        setQueryParams(r.queryParams || '{}')
        setBody(r.body || '')
        setBodyType(r.bodyType || 'json')
        setReqName(r.name)
        setResponse(null) // clear previous response
      }
    } else {
      setMethod('GET')
      setUrl('https://api.example.com/v1/users')
      setHeaders('{\n  "Content-Type": "application/json"\n}')
      setQueryParams('{}')
      setBody('{\n  "name": "Jane Doe"\n}')
      setBodyType('json')
      setReqName("New Request")
      setResponse(null)
    }
  }, [activeReqId, requests])

  const handleRun = () => {
    runReq.mutate({
      data: {
        method,
        url,
        headers,
        queryParams,
        body,
        bodyType
      }
    }, {
      onSuccess: (res) => {
        setResponse(res)
      },
      onError: () => {
        toast({ title: "Request Failed", description: "Could not execute the API request.", variant: "destructive" })
      }
    })
  }

  const handleSave = () => {
    const data = {
      name: reqName,
      method,
      url,
      headers,
      queryParams,
      body,
      bodyType,
    }

    if (activeReqId === 'new') {
      createReq.mutate({ data }, {
        onSuccess: (res) => {
          toast({ title: "Saved", description: "Request saved successfully." })
          queryClient.invalidateQueries({ queryKey: getListApiRequestsQueryKey() })
          setActiveReqId(res.id)
        }
      })
    } else {
      updateReq.mutate({ id: activeReqId, data }, {
        onSuccess: () => {
          toast({ title: "Updated", description: "Request updated successfully." })
          queryClient.invalidateQueries({ queryKey: getListApiRequestsQueryKey() })
        }
      })
    }
  }

  const handleDelete = (id: number) => {
    deleteReq.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Request deleted." })
        queryClient.invalidateQueries({ queryKey: getListApiRequestsQueryKey() })
        if (activeReqId === id) setActiveReqId('new')
      }
    })
  }

  const methodColors: Record<string, string> = {
    GET: "text-blue-500",
    POST: "text-emerald-500",
    PUT: "text-amber-500",
    PATCH: "text-amber-500",
    DELETE: "text-rose-500",
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 animate-in fade-in duration-500">
      
      {/* SIDEBAR */}
      <Card className="w-64 flex flex-col shadow-sm border-muted overflow-hidden shrink-0">
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
          <span className="font-bold text-sm tracking-tight">Collections</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setActiveReqId('new')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          <Button 
            variant={activeReqId === 'new' ? 'secondary' : 'ghost'} 
            className="w-full justify-start h-8 px-2 text-xs font-medium"
            onClick={() => setActiveReqId('new')}
          >
            <Plus className="w-3.5 h-3.5 mr-2 opacity-50" />
            New Request
          </Button>
          
          <div className="pt-2 pb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Saved Requests
          </div>
          
          {isLoadingRequests ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : requests?.map(r => (
            <div key={r.id} className="group relative flex items-center">
              <Button 
                variant={activeReqId === r.id ? 'secondary' : 'ghost'} 
                className="w-full justify-start h-8 px-2 text-xs font-medium truncate pr-8"
                onClick={() => setActiveReqId(r.id)}
              >
                <span className={`w-10 font-mono text-[10px] font-bold ${methodColors[r.method] || 'text-foreground'}`}>{r.method}</span>
                <span className="truncate">{r.name}</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-4 mb-4">
          <Input 
            value={reqName} 
            onChange={(e) => setReqName(e.target.value)} 
            className="text-lg font-bold h-10 bg-transparent border-transparent hover:border-input focus-visible:border-input focus-visible:ring-0 px-2 w-64 shadow-none"
          />
          <div className="flex-1" />
          <Button variant="outline" onClick={handleSave} disabled={createReq.isPending || updateReq.isPending} className="shadow-sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button onClick={handleRun} disabled={runReq.isPending} className="shadow-sm">
            {runReq.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send Request
          </Button>
        </div>

        <Card className="shadow-sm border-muted p-1 flex items-center gap-1 mb-4 bg-background">
          <Select value={method} onValueChange={(v: any) => setMethod(v)}>
            <SelectTrigger className={`w-28 font-mono font-bold h-9 border-none shadow-none focus:ring-0 ${methodColors[method] || ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(ApiRequestMethod).map(m => (
                <SelectItem key={m} value={m} className={`font-mono font-bold ${methodColors[m] || ''}`}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-[1px] h-6 bg-border mx-1" />
          <Input 
            value={url} 
            onChange={e => setUrl(e.target.value)}
            className="flex-1 border-none shadow-none focus-visible:ring-0 font-mono text-sm h-9"
            placeholder="https://api.example.com/v1/..."
          />
        </Card>

        <div className="grid grid-rows-2 gap-4 flex-1 min-h-0">
          {/* Request Config */}
          <Card className="shadow-sm border-muted flex flex-col min-h-0">
            <Tabs defaultValue="body" className="flex flex-col h-full">
              <div className="border-b px-2 flex items-center">
                <TabsList className="h-10 bg-transparent gap-4">
                  <TabsTrigger value="params" className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 border-primary rounded-none px-2">Query Params</TabsTrigger>
                  <TabsTrigger value="headers" className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 border-primary rounded-none px-2">Headers</TabsTrigger>
                  <TabsTrigger value="body" className="data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 border-primary rounded-none px-2">Body</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex-1 overflow-hidden p-0 relative bg-muted/10">
                <TabsContent value="params" className="h-full m-0">
                  <Textarea 
                    value={queryParams}
                    onChange={e => setQueryParams(e.target.value)}
                    className="h-full w-full resize-none border-0 focus-visible:ring-0 rounded-none font-mono text-xs p-4 bg-transparent"
                    placeholder="{}"
                  />
                </TabsContent>
                <TabsContent value="headers" className="h-full m-0">
                  <Textarea 
                    value={headers}
                    onChange={e => setHeaders(e.target.value)}
                    className="h-full w-full resize-none border-0 focus-visible:ring-0 rounded-none font-mono text-xs p-4 bg-transparent"
                    placeholder="{}"
                  />
                </TabsContent>
                <TabsContent value="body" className="h-full m-0 flex flex-col">
                  <div className="px-4 py-2 border-b flex items-center bg-background">
                    <Select value={bodyType} onValueChange={(v: any) => setBodyType(v)}>
                      <SelectTrigger className="w-[120px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(ApiRequestBodyType).map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea 
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    className="flex-1 w-full resize-none border-0 focus-visible:ring-0 rounded-none font-mono text-xs p-4 bg-transparent"
                    disabled={bodyType === 'none'}
                    placeholder={bodyType === 'none' ? "This request does not have a body" : "{\n  \n}"}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </Card>

          {/* Response Viewer */}
          <Card className="shadow-sm border-muted flex flex-col min-h-0 bg-sidebar text-sidebar-foreground">
            <div className="border-b border-sidebar-border px-4 py-2 flex items-center justify-between bg-sidebar-accent">
              <span className="font-semibold text-xs tracking-wide uppercase text-sidebar-foreground/70">Response</span>
              {response && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className={`font-bold ${response.statusCode < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {response.statusCode} {response.statusText}
                  </span>
                  <span className="text-sidebar-foreground/50">{response.responseTime}ms</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {runReq.isPending ? (
                <div className="h-full flex items-center justify-center text-sidebar-foreground/30">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !response ? (
                <div className="h-full flex items-center justify-center text-sidebar-foreground/30 text-sm font-mono">
                  Hit Send to execute the request
                </div>
              ) : (
                <pre className="font-mono text-xs text-sidebar-foreground/90 whitespace-pre-wrap break-all">
                  {response.responseBody}
                </pre>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
