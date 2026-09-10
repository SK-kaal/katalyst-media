import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Re-establish the server-only Supabase user used for portal RLS when the
 * access-code session is still valid but the bridge auth cookies expired.
 */
export async function ensureSupabaseBridge(
  supabase: SupabaseClient<Database>,
  hasUser = false,
): Promise<void> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (hasUser) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return;

  const email = process.env.ADMIN_SUPABASE_EMAIL;
  const password = process.env.ADMIN_SUPABASE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Configure SUPABASE_SERVICE_ROLE_KEY or ADMIN_SUPABASE_EMAIL + ADMIN_SUPABASE_PASSWORD",
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("Portal data bridge unavailable");
  }
}
