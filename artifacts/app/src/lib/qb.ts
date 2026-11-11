const RUN = `${import.meta.env.BASE_URL}api/qb/explorer/run`

export function qbQuote(value: string) {
  return value.replace(/'/g, "\\'")
}

export async function qbQuery(query: string) {
  const r = await fetch(RUN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "GET", path: "/query", query: new URLSearchParams({ query }).toString() }),
  })
  const body = await r.json()
  if (!r.ok || body.status >= 300) throw new Error(body.data?.Fault?.Error?.[0]?.Detail ?? body.data?.detail ?? body.error ?? "QuickBooks request failed")
  return body.data as Record<string, unknown>
}

export function qbList<T>(data: Record<string, unknown>, name: string): T[] {
  return ((data.QueryResponse as Record<string, unknown> | undefined)?.[name] as T[] | undefined) ?? []
}
