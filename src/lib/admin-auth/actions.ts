"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_RATE_COOKIE,
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  createAdminSessionToken,
  encodeRateLimitCookie,
  nextLockMs,
  parseRateLimitCookie,
  verifyAccessCode,
} from "@/lib/admin-auth/session";
import { createClient } from "@/lib/supabase/server";
import { ensureSupabaseBridge } from "@/lib/admin-auth/bridge";

export type AccessCodeState = {
  ok: boolean;
  error?: string;
  message?: string;
  retryAfterSec?: number;
};

async function establishSupabaseBridge() {
  const supabase = await createClient();
  await ensureSupabaseBridge(supabase);
}

export async function submitAccessCodeAction(
  _prev: AccessCodeState | null,
  formData: FormData,
): Promise<AccessCodeState> {
  const store = await cookies();
  const rl = parseRateLimitCookie(store.get(ADMIN_RATE_COOKIE)?.value);
  const now = Date.now();

  if (rl.lockedUntil > now) {
    return {
      ok: false,
      error: "Too many attempts. Try again shortly.",
      retryAfterSec: Math.ceil((rl.lockedUntil - now) / 1000),
    };
  }

  const trimmed = String(formData.get("code") ?? "").trim();
  const requestedNext = String(formData.get("next") ?? "/admin");
  const nextPath =
    requestedNext.startsWith("/admin") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.startsWith("/admin/login") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : "/admin";
  if (!trimmed) {
    return { ok: false, error: "Incorrect access code.\nTry again." };
  }

  let valid = false;
  try {
    valid = await verifyAccessCode(trimmed);
  } catch {
    return { ok: false, error: "Access temporarily unavailable." };
  }

  if (!valid) {
    const fails = rl.fails + 1;
    const lockMs = nextLockMs(fails);
    store.set(
      ADMIN_RATE_COOKIE,
      encodeRateLimitCookie({
        fails,
        lockedUntil: lockMs > 0 ? now + lockMs : 0,
      }),
      { ...adminCookieOptions(60 * 60), httpOnly: true },
    );
    return { ok: false, error: "Incorrect access code.\nTry again." };
  }

  try {
    await establishSupabaseBridge();
  } catch {
    return { ok: false, error: "Access temporarily unavailable." };
  }

  store.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(), adminCookieOptions());
  store.set(ADMIN_RATE_COOKIE, "", { ...adminCookieOptions(0), maxAge: 0 });

  // Immediate server redirect into the portal (cookie is set on this response).
  redirect(nextPath);
}

export async function logoutAdmin() {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
  store.delete(ADMIN_RATE_COOKIE);

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Session may already be gone.
  }

  redirect("/admin/login");
}
