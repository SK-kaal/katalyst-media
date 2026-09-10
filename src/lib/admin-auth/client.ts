import { requireAdminSession } from "@/lib/admin-auth/guard";
import { ensureSupabaseBridge } from "@/lib/admin-auth/bridge";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Admin data client. Prefer service role when configured; otherwise use
 * the cookie-bound SSR client (populated via server-only bridge login).
 * Re-establishes the bridge if the access-code session outlives Supabase auth.
 */
export async function createAdminClient() {
  await requireAdminSession();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceClient();
  }
  const supabase = await createClient();
  await ensureSupabaseBridge(supabase);
  return supabase;
}
