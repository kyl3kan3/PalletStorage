/**
 * Thin QuickBooks Online REST client. We deliberately avoid the node-quickbooks
 * SDK to keep this portable and easy to test — QBO's REST surface is small
 * and well-documented.
 *
 * Env vars required:
 *   QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENV=sandbox|production
 */

const DISCOVERY = {
  sandbox: {
    authorize: "https://appcenter.intuit.com/connect/oauth2",
    token: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    api: "https://sandbox-quickbooks.api.intuit.com/v3/company",
  },
  production: {
    authorize: "https://appcenter.intuit.com/connect/oauth2",
    token: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    api: "https://quickbooks.api.intuit.com/v3/company",
  },
} as const;

function env() {
  const mode = (process.env.QBO_ENV ?? "sandbox") as "sandbox" | "production";
  return DISCOVERY[mode];
}

function requireEnv(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("QBO_CLIENT_ID"),
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });
  return `${env().authorize}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number; // seconds
  token_type: string;
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const auth = Buffer.from(`${requireEnv("QBO_CLIENT_ID")}:${requireEnv("QBO_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(env().token, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`QBO token error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export function exchangeAuthCode(code: string, redirectUri: string): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export interface QboConnection {
  realmId: string;
  accessToken: string;
  productItemMap: Record<string, string>;
}

/** Minimal typed wrapper around the QBO v3 REST API. */
export async function qboFetch<T>(
  conn: QboConnection,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const url = `${env().api}/${conn.realmId}${path}${path.includes("?") ? "&" : "?"}minorversion=70`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`QBO ${init.method ?? "GET"} ${path} failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
