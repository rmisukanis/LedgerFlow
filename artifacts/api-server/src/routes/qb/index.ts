import { Router, type IRouter } from "express";
import OAuthClient from "intuit-oauth";
import { db, qbTokensTable } from "@workspace/db";
import { createOAuthClient, getStoredToken, isConnected } from "../../lib/qb-client";
import { GetQbStatusResponse, GetQbAuthUrlResponse, DisconnectQbResponse } from "@workspace/api-zod";

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

// DELETE /qb/auth/disconnect
router.delete("/qb/auth/disconnect", async (req, res): Promise<void> => {
  await db.delete(qbTokensTable);
  res.json(DisconnectQbResponse.parse({ connected: false, companyName: null, companyId: null, expiresAt: null, connectedAt: null }));
});

export default router;
