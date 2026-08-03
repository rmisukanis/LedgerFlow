import OAuthClient from "intuit-oauth";
import { db, qbTokensTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";

const QB_CLIENT_ID = process.env.QB_CLIENT_ID ?? "";
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET ?? "";
const QB_ENVIRONMENT =
  (process.env.QB_ENVIRONMENT as "sandbox" | "production") ?? "sandbox";

export function getRedirectUri(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost";
  return `https://${domain}/api/qb/auth/callback`;
}

export function createOAuthClient(): OAuthClient {
  return new OAuthClient({
    clientId: QB_CLIENT_ID,
    clientSecret: QB_CLIENT_SECRET,
    environment: QB_ENVIRONMENT,
    redirectUri: getRedirectUri(),
    logging: false,
  });
}

export async function getStoredToken() {
  const [token] = await db
    .select()
    .from(qbTokensTable)
    .orderBy(desc(qbTokensTable.connectedAt))
    .limit(1);
  return token ?? null;
}

export async function getAuthorizedClient(): Promise<OAuthClient | null> {
  const storedToken = await getStoredToken();
  if (!storedToken) return null;

  const client = createOAuthClient();
  client.setToken({
    token_type: "bearer",
    access_token: storedToken.accessToken,
    refresh_token: storedToken.refreshToken,
    expires_in: 3600,
    x_refresh_token_expires_in: 8726400,
    realmId: storedToken.realmId,
  });

  const now = new Date();
  const refreshExpiry = new Date(storedToken.refreshTokenExpiresAt);
  const accessExpiry = new Date(storedToken.accessTokenExpiresAt);

  if (now >= refreshExpiry) {
    logger.warn("QuickBooks refresh token expired — reconnect required");
    return null;
  }

  if (now >= accessExpiry) {
    try {
      logger.info("Refreshing QuickBooks access token");
      const refreshResponse = await client.refresh();
      const newToken = refreshResponse.getJson();

      const newAccessExpiry = new Date(
        Date.now() + (newToken.expires_in as number) * 1000,
      );
      const newRefreshExpiry = new Date(
        Date.now() + (newToken.x_refresh_token_expires_in as number) * 1000,
      );

      await db
        .update(qbTokensTable)
        .set({
          accessToken: newToken.access_token as string,
          refreshToken: newToken.refresh_token as string,
          accessTokenExpiresAt: newAccessExpiry,
          refreshTokenExpiresAt: newRefreshExpiry,
          updatedAt: new Date(),
        })
        .where(eq(qbTokensTable.id, storedToken.id));

      logger.info("QuickBooks access token refreshed successfully");
    } catch (err) {
      logger.error({ err }, "Failed to refresh QuickBooks access token");
      return null;
    }
  }

  return client;
}

export function getQbApiBase(): string {
  return QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export class QbNotConnectedError extends Error {
  constructor() {
    super("QuickBooks is not connected");
    this.name = "QbNotConnectedError";
  }
}

export class QbUpstreamError extends Error {
  constructor(message: string, public statusCode?: string) {
    super(message);
    this.name = "QbUpstreamError";
  }
}

function isAuthError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "401" || code === "403";
}

/** Run a QuickBooks query (their SQL-like query language) and return the QueryResponse object.
 *  On an auth failure, forces a token refresh and retries once. */
export async function queryQuickBooks(
  query: string,
): Promise<Record<string, unknown>> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new QbNotConnectedError();
  }
  const token = await getStoredToken();
  const realmId = token!.realmId;
  const url = `${getQbApiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;

  const call = async (c: OAuthClient) => {
    const response = await c.makeApiCall({ url, method: "GET" });
    const body = (response.json ?? {}) as Record<string, unknown>;
    return (body.QueryResponse as Record<string, unknown>) ?? {};
  };

  try {
    return await call(client);
  } catch (err) {
    if (!isAuthError(err)) {
      const code = (err as { code?: string })?.code;
      throw new QbUpstreamError(
        (err as Error)?.message ?? "QuickBooks request failed",
        code,
      );
    }
    // Auth failure despite a nominally valid token — force a refresh and retry once.
    logger.warn("QuickBooks auth failure on query; forcing token refresh and retrying");
    try {
      const refreshResponse = await client.refresh();
      const newToken = refreshResponse.getJson();
      await db
        .update(qbTokensTable)
        .set({
          accessToken: newToken.access_token as string,
          refreshToken: newToken.refresh_token as string,
          accessTokenExpiresAt: new Date(Date.now() + (newToken.expires_in as number) * 1000),
          refreshTokenExpiresAt: new Date(Date.now() + (newToken.x_refresh_token_expires_in as number) * 1000),
          updatedAt: new Date(),
        })
        .where(eq(qbTokensTable.id, token!.id));
      return await call(client);
    } catch (retryErr) {
      logger.error({ err: retryErr }, "QuickBooks retry after refresh failed");
      throw new QbNotConnectedError();
    }
  }
}

/** Escape a user-supplied string for inclusion in a QB query literal. */
export function escapeQbString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function isConnected(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  const now = new Date();
  return now < new Date(token.refreshTokenExpiresAt);
}
