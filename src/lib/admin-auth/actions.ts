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

export type AccessCodeState = {
  ok: boolean;
  error?: string;
  message?: string;
  retryAfterSec?: number;
};

async function establishSupabaseBridge() {
  const email = process.env.ADMIN_SUPABASE_EMAIL;
  const password = process.env.ADMIN_SUPABASE_PASSWORD;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) return;

  if (!email || !password) {
    throw new Error(
      "Configure SUPABASE_SERVICE_ROLE_KEY or ADMIN_SUPABASE_EMAIL + ADMIN_SUPABASE_PASSWORD",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("Portal data bridge unavailable");
  }
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
  redirect("/admin");
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
