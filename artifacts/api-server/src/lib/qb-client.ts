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

export async function isConnected(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  const now = new Date();
  return now < new Date(token.refreshTokenExpiresAt);
}
