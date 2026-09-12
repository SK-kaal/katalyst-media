/** Edge-safe admin session helpers (Web Crypto — no Node `crypto`). */

export const ADMIN_SESSION_COOKIE = "km_admin_session";
export const ADMIN_RATE_COOKIE = "km_admin_rl";

/** 24 hours — staff portal session */
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24;

type SessionPayload = {
  v: 1;
  iat: number;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set (min 32 chars)");
  }
  return secret;
}

function expectedAccessCode() {
  const code = process.env.ADMIN_ACCESS_CODE;
  if (!code) {
    throw new Error("ADMIN_ACCESS_CODE is not configured");
  }
  return code;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function importHmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payloadB64: string) {
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return toBase64Url(sig);
}

function encodePayload(payload: SessionPayload) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function decodePayload(payloadB64: string): SessionPayload | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(payloadB64));
    const parsed = JSON.parse(json) as SessionPayload;
    if (parsed?.v !== 1 || typeof parsed.iat !== "number" || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function createAdminSessionToken(now = Date.now()) {
  const payload: SessionPayload = {
    v: 1,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SEC,
  };
  const payloadB64 = encodePayload(payload);
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payloadB64, sig] = parts;
    if (!payloadB64 || !sig) return false;

    const expected = await sign(payloadB64);
    const a = fromBase64Url(sig);
    const b = fromBase64Url(expected);
    if (!timingSafeEqualBytes(a, b)) return false;

    const payload = decodePayload(payloadB64);
    if (!payload) return false;
    if (payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

async function sha256Bytes(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

/** Timing-safe compare of two secrets of any length (server-only). */
export async function verifySecret(
  submitted: string,
  expected: string,
): Promise<boolean> {
  const left = await sha256Bytes(submitted);
  const right = await sha256Bytes(expected);
  return timingSafeEqualBytes(left, right);
}

/** Timing-safe compare of submitted code against ADMIN_ACCESS_CODE (server-only). */
export async function verifyAccessCode(submitted: string): Promise<boolean> {
  return verifySecret(submitted, expectedAccessCode());
}

export function adminCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export type RateLimitState = {
  fails: number;
  lockedUntil: number;
};

export function parseRateLimitCookie(raw: string | undefined): RateLimitState {
  if (!raw) return { fails: 0, lockedUntil: 0 };
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(fromBase64Url(raw)),
    ) as RateLimitState;
    return {
      fails: Number(parsed.fails) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}

export function encodeRateLimitCookie(state: RateLimitState) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
}

/** After N failures, lock for increasing durations. */
export function nextLockMs(fails: number): number {
  if (fails >= 10) return 5 * 60 * 1000;
  if (fails >= 5) return 60 * 1000;
  return 0;
}
