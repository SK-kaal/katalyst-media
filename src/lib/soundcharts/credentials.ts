/**
 * Soundcharts OAuth client-credentials helpers.
 *
 * SOUNDCHARTS_CLIENT_ID and SOUNDCHARTS_CLIENT_SECRET stay server-only
 * (no NEXT_PUBLIC_ prefix). New integrations exchange them for a short-lived
 * access token at account.soundcharts.com, then call the API with
 * Authorization: Bearer. The legacy x-app-id / x-api-key headers are not used.
 *
 * Import only from route handlers, server components or scheduled jobs.
 */

export const SOUNDCHARTS_API_BASE_URL = "https://customer.api.soundcharts.com";
export const SOUNDCHARTS_TOKEN_URL = "https://account.soundcharts.com/oauth/token";

/** Refresh a little early so an in-flight request never races the expiry. */
const TOKEN_REFRESH_SKEW_MS = 30_000;

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

function readCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SOUNDCHARTS_CLIENT_ID;
  const clientSecret = process.env.SOUNDCHARTS_CLIENT_SECRET;

  const missing = [
    clientId ? null : "SOUNDCHARTS_CLIENT_ID",
    clientSecret ? null : "SOUNDCHARTS_CLIENT_SECRET",
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}`);
  }

  return { clientId: clientId as string, clientSecret: clientSecret as string };
}

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function requestAccessToken(): Promise<CachedToken> {
  const { clientId, clientSecret } = readCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
    "base64",
  );

  const response = await fetch(SOUNDCHARTS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !payload.access_token) {
    const detail =
      payload.error_description ||
      payload.error ||
      `HTTP ${response.status}`;
    throw new Error(`Soundcharts token request failed: ${detail}`);
  }

  const expiresInSec =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 900;

  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

/**
 * Returns a valid access token, refreshing when the cached one is close to
 * expiry. Concurrent callers share a single in-flight refresh.
 */
export async function getSoundchartsAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return cached.accessToken;
  }

  if (!inflight) {
    inflight = requestAccessToken()
      .then((next) => {
        cached = next;
        return next.accessToken;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

/**
 * Auth headers for a Soundcharts API request. Throws when credentials are
 * missing or the token exchange fails.
 */
export async function soundchartsAuthHeaders(): Promise<
  Record<string, string>
> {
  const accessToken = await getSoundchartsAccessToken();
  return { Authorization: `Bearer ${accessToken}` };
}

/** True when both credentials are present, for callers that degrade quietly. */
export function hasSoundchartsCredentials(): boolean {
  return Boolean(
    process.env.SOUNDCHARTS_CLIENT_ID && process.env.SOUNDCHARTS_CLIENT_SECRET,
  );
}

/** Drops the cached token — useful after a 401 so the next call re-auths. */
export function clearSoundchartsAccessToken() {
  cached = null;
}
