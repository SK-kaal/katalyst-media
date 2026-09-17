/**
 * Soundcharts credentials, read from SOUNDCHARTS_CLIENT_ID and
 * SOUNDCHARTS_CLIENT_SECRET.
 *
 * Neither name carries a NEXT_PUBLIC_ prefix, so Next keeps both in the Node
 * runtime and never inlines them into a browser bundle. Import this only from
 * server code — a route handler, server component or scheduled job — so the
 * values cannot cross into a client component and get bundled by accident.
 */

/** Soundcharts rejects anything else with "Authentication required". */
const APP_ID_HEADER = "x-app-id";
const API_KEY_HEADER = "x-api-key";

export const SOUNDCHARTS_API_BASE_URL = "https://customer.api.soundcharts.com";

/**
 * Auth headers for a Soundcharts request. Throws when either value is missing
 * so a misconfigured environment fails on the server with a clear message,
 * rather than surfacing as an opaque 401 from the API.
 */
export function soundchartsAuthHeaders(): Record<string, string> {
  const appId = process.env.SOUNDCHARTS_CLIENT_ID;
  const apiKey = process.env.SOUNDCHARTS_CLIENT_SECRET;

  const missing = [
    appId ? null : "SOUNDCHARTS_CLIENT_ID",
    apiKey ? null : "SOUNDCHARTS_CLIENT_SECRET",
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}`);
  }

  return {
    [APP_ID_HEADER]: appId as string,
    [API_KEY_HEADER]: apiKey as string,
  };
}

/** True when both credentials are present, for callers that degrade quietly. */
export function hasSoundchartsCredentials(): boolean {
  return Boolean(
    process.env.SOUNDCHARTS_CLIENT_ID && process.env.SOUNDCHARTS_CLIENT_SECRET,
  );
}
