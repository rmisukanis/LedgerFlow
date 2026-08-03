import { Router, type IRouter } from "express";
import OAuthClient from "intuit-oauth";
import { db, qbTokensTable } from "@workspace/db";
import { createOAuthClient, getStoredToken, isConnected, queryQuickBooks, escapeQbString, QbNotConnectedError, QbUpstreamError } from "../../lib/qb-client";
import {
  GetQbStatusResponse,
  GetQbAuthUrlResponse,
  DisconnectQbResponse,
  ListQbInvoicesQueryParams,
  ListQbInvoicesResponse,
  ListQbDepositsQueryParams,
  ListQbDepositsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /qb/status
router.get("/qb/status", async (req, res): Promise<void> => {
  const token = await getStoredToken();
  const connected = await isConnected();

  const response = GetQbStatusResponse.parse({
    connected,
    companyName: token?.companyName ?? null,
    companyId: token?.realmId ?? null,
    expiresAt: token ? token.refreshTokenExpiresAt.toISOString() : null,
    connectedAt: token ? token.connectedAt.toISOString() : null,
  });

  res.json(response);
});

// GET /qb/auth/url
router.get("/qb/auth/url", async (req, res): Promise<void> => {
  const oauthClient = createOAuthClient();
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
    state: crypto.randomUUID(),
  });

  res.json(GetQbAuthUrlResponse.parse({ url: authUri }));
});

// GET /qb/auth/callback
router.get("/qb/auth/callback", async (req, res): Promise<void> => {
  const { error, code, realmId } = req.query as Record<string, string>;

  if (error) {
    req.log.warn({ error }, "QuickBooks OAuth error");
    res.redirect(`/?qb_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !realmId) {
    res.redirect("/?qb_error=missing_params");
    return;
  }

  try {
    const oauthClient = createOAuthClient();
    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const tokenResponse = await oauthClient.createToken(fullUrl);
    const token = tokenResponse.getJson();

    // Try to get company info
    let companyName: string | null = null;
    try {
      const companyInfoResponse = await oauthClient.makeApiCall({
        url: `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
        method: "GET",
      });
      const companyData = (companyInfoResponse.json ?? {}) as Record<string, unknown>;
      const info = (companyData?.CompanyInfo as Record<string, unknown>) ?? {};
      companyName = (info?.CompanyName as string) ?? null;
    } catch (err) {
      req.log.warn({ err }, "Could not fetch QB company info");
    }

    const accessExpiry = new Date(Date.now() + (token.expires_in as number) * 1000);
    const refreshExpiry = new Date(
      Date.now() + (token.x_refresh_token_expires_in as number) * 1000
    );

    // Remove any existing token rows and insert fresh one
    await db.delete(qbTokensTable);
    await db.insert(qbTokensTable).values({
      realmId,
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string,
      companyName,
      accessTokenExpiresAt: accessExpiry,
      refreshTokenExpiresAt: refreshExpiry,
    });

    req.log.info({ realmId, companyName }, "QuickBooks connected successfully");
    res.redirect("/?qb_connected=true");
  } catch (err) {
    req.log.error({ err }, "QuickBooks OAuth callback failed");
    res.redirect("/?qb_error=callback_failed");
  }
});

// GET /qb/invoices — search invoices in QuickBooks
router.get("/qb/invoices", async (req, res): Promise<void> => {
  const parsed = ListQbInvoicesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { invoiceNumber, dateFrom, dateTo } = parsed.data;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if ((dateFrom && !DATE_RE.test(dateFrom)) || (dateTo && !DATE_RE.test(dateTo))) {
    res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    return;
  }
  if (invoiceNumber && invoiceNumber.length > 50) {
    res.status(400).json({ error: "Invoice number too long" });
    return;
  }

  const conditions: string[] = [];
  if (invoiceNumber) conditions.push(`DocNumber = '${escapeQbString(invoiceNumber)}'`);
  if (dateFrom) conditions.push(`TxnDate >= '${escapeQbString(dateFrom)}'`);
  if (dateTo) conditions.push(`TxnDate <= '${escapeQbString(dateTo)}'`);

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM Invoice${where} ORDERBY TxnDate DESC MAXRESULTS 100`;

  try {
    req.log.info({ query }, "Querying QuickBooks invoices");
    const queryResponse = await queryQuickBooks(query);
    const rawInvoices = (queryResponse.Invoice as Record<string, unknown>[]) ?? [];

    const invoices = rawInvoices.map((inv) => {
      const customerRef = (inv.CustomerRef as Record<string, unknown>) ?? {};
      const billEmail = (inv.BillEmail as Record<string, unknown>) ?? {};
      const balance = Number(inv.Balance ?? 0);
      const total = Number(inv.TotalAmt ?? 0);
      return {
        id: String(inv.Id),
        docNumber: String(inv.DocNumber ?? ""),
        customerName: String(customerRef.name ?? "Unknown"),
        customerEmail: (billEmail.Address as string) ?? null,
        amount: total,
        balance,
        status: balance === 0 ? "paid" : balance < total ? "partial" : "open",
        txnDate: String(inv.TxnDate ?? ""),
        dueDate: (inv.DueDate as string) ?? null,
      };
    });

    res.json(ListQbInvoicesResponse.parse(invoices));
  } catch (err) {
    req.log.error({ err }, "QuickBooks invoice query failed");
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks connection expired — please reconnect from the Dashboard." });
    } else if (err instanceof QbUpstreamError) {
      res.status(502).json({ error: `QuickBooks request failed: ${err.message}` });
    } else {
      res.status(500).json({ error: "Unexpected error querying QuickBooks" });
    }
  }
});

// GET /qb/deposits — search deposits in QuickBooks
router.get("/qb/deposits", async (req, res): Promise<void> => {
  const parsed = ListQbDepositsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { dateFrom, dateTo } = parsed.data;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if ((dateFrom && !DATE_RE.test(dateFrom)) || (dateTo && !DATE_RE.test(dateTo))) {
    res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
    return;
  }

  const conditions: string[] = [];
  if (dateFrom) conditions.push(`TxnDate >= '${escapeQbString(dateFrom)}'`);
  if (dateTo) conditions.push(`TxnDate <= '${escapeQbString(dateTo)}'`);

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM Deposit${where} ORDERBY TxnDate DESC MAXRESULTS 100`;

  try {
    req.log.info({ query }, "Querying QuickBooks deposits");
    const queryResponse = await queryQuickBooks(query);
    const rawDeposits = (queryResponse.Deposit as Record<string, unknown>[]) ?? [];

    const deposits = rawDeposits.map((dep) => {
      const accountRef = (dep.DepositToAccountRef as Record<string, unknown>) ?? {};
      return {
        id: String(dep.Id),
        amount: Number(dep.TotalAmt ?? 0),
        txnDate: String(dep.TxnDate ?? ""),
        accountName: (accountRef.name as string) ?? null,
        memo: (dep.PrivateNote as string) ?? null,
      };
    });

    res.json(ListQbDepositsResponse.parse(deposits));
  } catch (err) {
    req.log.error({ err }, "QuickBooks deposit query failed");
    if (err instanceof QbNotConnectedError) {
      res.status(401).json({ error: "QuickBooks connection expired — please reconnect from the Dashboard." });
    } else if (err instanceof QbUpstreamError) {
      res.status(502).json({ error: `QuickBooks request failed: ${err.message}` });
    } else {
      res.status(500).json({ error: "Unexpected error querying QuickBooks" });
    }
  }
});

// DELETE /qb/auth/disconnect
router.delete("/qb/auth/disconnect", async (req, res): Promise<void> => {
  await db.delete(qbTokensTable);
  res.json(DisconnectQbResponse.parse({ connected: false, companyName: null, companyId: null, expiresAt: null, connectedAt: null }));
});

export default router;
