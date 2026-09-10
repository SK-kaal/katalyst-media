import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-auth/session";

export async function readAdminSessionFromCookies(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession() {
  const ok = await readAdminSessionFromCookies();
  if (!ok) {
    redirect("/admin/login");
  }
}
