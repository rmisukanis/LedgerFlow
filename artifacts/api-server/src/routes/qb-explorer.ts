import { Router, type IRouter } from "express";
import { getAuthorizedClient, getStoredToken, getQbApiBase } from "../lib/qb-client";
import { QB_CATALOG } from "../data/qb-catalog";

const router: IRouter = Router();

router.get("/qb/explorer/catalog", (_req, res) => {
  res.json(QB_CATALOG);
});

// POST /qb/explorer/run — { method, path, query, body, contentType }
router.post("/qb/explorer/run", async (req, res): Promise<void> => {
  const { method, path, query, body, contentType } = req.body ?? {};
  if (!["GET", "POST"].includes(method) || typeof path !== "string" || !/^\/[A-Za-z0-9_\-\/]+$/.test(path) || path.includes("..")) {
    res.status(400).json({ error: "Invalid method or path" });
    return;
  }
  const client = await getAuthorizedClient();
  const token = await getStoredToken();
  if (!client || !token) {
    res.status(401).json({ error: "QuickBooks is not connected" });
    return;
  }
  const qs = new URLSearchParams(typeof query === "string" ? query : "");
  qs.set("minorversion", "75");
  const url = `${getQbApiBase()}/v3/company/${token.realmId}${path}?${qs.toString()}`;
  const started = Date.now();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (method === "POST") headers["Content-Type"] = contentType || "application/json";
    const r = await client.makeApiCall({ url, method, headers, body: method === "POST" ? String(body ?? "") : undefined });
    res.json({ status: r.response?.status ?? 200, ms: Date.now() - started, url, data: r.json ?? r.body });
  } catch (err) {
    const e = err as { authResponse?: { response?: { status?: number }; json?: unknown; body?: unknown }; message?: string };
    res.json({
      status: e.authResponse?.response?.status ?? 502,
      ms: Date.now() - started,
      url,
      data: e.authResponse?.json ?? e.authResponse?.body ?? { error: e.message },
    });
  }
});

export default router;
