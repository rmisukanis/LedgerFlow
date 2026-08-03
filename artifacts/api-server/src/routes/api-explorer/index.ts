import { Router, type IRouter } from "express";
import { db, apiRequestsTable } from "@workspace/db";
import { eq, ilike, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  ListApiRequestsQueryParams,
  CreateApiRequestBody,
  GetApiRequestParams,
  UpdateApiRequestParams,
  UpdateApiRequestBody,
  DeleteApiRequestParams,
  RunApiRequestParams,
  RunApiRequestBody,
  RunAdHocRequestBody,
  ListApiRequestsResponse,
  GetApiRequestResponse,
  CreateApiRequestResponse,
  UpdateApiRequestResponse,
  RunApiRequestResponse,
  RunAdHocRequestResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRequest(r: Record<string, unknown>) {
  return {
    ...r,
    lastRunAt: r.lastRunAt instanceof Date ? r.lastRunAt.toISOString() : (r.lastRunAt ?? null),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  };
}

async function executeRequest(
  method: string,
  url: string,
  headersStr: string | null | undefined,
  queryParamsStr: string | null | undefined,
  body: string | null | undefined,
  bodyType: string | null | undefined
): Promise<{ statusCode: number; statusText: string; responseTime: number; responseBody: string; responseHeaders: string }> {
  let finalUrl = url;

  if (queryParamsStr) {
    try {
      const params = JSON.parse(queryParamsStr) as Record<string, string>;
      const qs = new URLSearchParams(params).toString();
      if (qs) finalUrl = `${finalUrl}${finalUrl.includes("?") ? "&" : "?"}${qs}`;
    } catch {
      // ignore parse error
    }
  }

  const headers: Record<string, string> = {};
  if (headersStr) {
    try {
      Object.assign(headers, JSON.parse(headersStr));
    } catch {
      // ignore
    }
  }

  const hasBody = method !== "GET" && method !== "HEAD" && body && bodyType !== "none";
  if (hasBody && bodyType === "json" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const startTime = Date.now();
  let statusCode = 0;
  let statusText = "";
  let responseBody = "";
  let responseHeaders = "{}";

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
      body: hasBody ? body : undefined,
    };

    const response = await fetch(finalUrl, fetchOptions);
    const responseTime = Date.now() - startTime;
    statusCode = response.status;
    statusText = response.statusText;

    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    responseHeaders = JSON.stringify(headersObj);

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      responseBody = JSON.stringify(json, null, 2);
    } else {
      responseBody = await response.text();
    }

    return { statusCode, statusText, responseTime, responseBody, responseHeaders };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const message = err instanceof Error ? err.message : "Request failed";
    return {
      statusCode: 0,
      statusText: "Network Error",
      responseTime,
      responseBody: JSON.stringify({ error: message }),
      responseHeaders: "{}",
    };
  }
}

// GET /api-requests
router.get("/api-requests", async (req, res): Promise<void> => {
  const queryParams = ListApiRequestsQueryParams.safeParse(req.query);
  const { collectionId, search } = queryParams.success ? queryParams.data : {};

  let query = db.select().from(apiRequestsTable).$dynamic();

  if (collectionId != null) {
    query = query.where(eq(apiRequestsTable.collectionId, collectionId));
  } else if (search) {
    query = query.where(ilike(apiRequestsTable.name, `%${search}%`));
  }

  const requests = await query.orderBy(sql`${apiRequestsTable.updatedAt} DESC`);
  res.json(ListApiRequestsResponse.parse(requests.map(r => serializeRequest(r as unknown as Record<string, unknown>))));
});

// POST /api-requests
router.post("/api-requests", async (req, res): Promise<void> => {
  const parsed = CreateApiRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [request] = await db.insert(apiRequestsTable).values(parsed.data).returning();
  res.status(201).json(CreateApiRequestResponse.parse(serializeRequest(request as unknown as Record<string, unknown>)));
});

// GET /api-requests/run (ad-hoc, before /:id)
router.post("/api-requests/run", async (req, res): Promise<void> => {
  const parsed = RunAdHocRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { method, url, headers, queryParams, body, bodyType } = parsed.data;
  const result = await executeRequest(method, url, headers, queryParams, body, bodyType ?? "none");
  res.json(RunAdHocRequestResponse.parse(result));
});

// GET /api-requests/:id
router.get("/api-requests/:id", async (req, res): Promise<void> => {
  const params = GetApiRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [request] = await db.select().from(apiRequestsTable).where(eq(apiRequestsTable.id, params.data.id));
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.json(GetApiRequestResponse.parse(serializeRequest(request as unknown as Record<string, unknown>)));
});

// PATCH /api-requests/:id
router.patch("/api-requests/:id", async (req, res): Promise<void> => {
  const params = UpdateApiRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateApiRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [request] = await db
    .update(apiRequestsTable)
    .set(parsed.data)
    .where(eq(apiRequestsTable.id, params.data.id))
    .returning();

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.json(UpdateApiRequestResponse.parse(serializeRequest(request as unknown as Record<string, unknown>)));
});

// DELETE /api-requests/:id
router.delete("/api-requests/:id", async (req, res): Promise<void> => {
  const params = DeleteApiRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(apiRequestsTable).where(eq(apiRequestsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /api-requests/:id/run
router.post("/api-requests/:id/run", async (req, res): Promise<void> => {
  const params = RunApiRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [apiReq] = await db.select().from(apiRequestsTable).where(eq(apiRequestsTable.id, params.data.id));
  if (!apiReq) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const override = RunApiRequestBody.safeParse(req.body);
  const overrideData = override.success ? override.data : {};

  const result = await executeRequest(
    apiReq.method,
    apiReq.url,
    overrideData.headers ?? apiReq.headers,
    overrideData.queryParams ?? apiReq.queryParams,
    overrideData.body ?? apiReq.body,
    apiReq.bodyType
  );

  // Update last run info
  await db
    .update(apiRequestsTable)
    .set({ lastRunAt: new Date(), lastStatusCode: result.statusCode })
    .where(eq(apiRequestsTable.id, params.data.id));

  res.json(RunApiRequestResponse.parse(result));
});

export default router;
