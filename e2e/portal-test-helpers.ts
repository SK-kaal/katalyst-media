import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

export const QA_PREFIX = "QA Audit";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running portal E2E tests`);
  return value;
}

export async function createPortalDbClient() {
  const client = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: requiredEnv("ADMIN_SUPABASE_EMAIL"),
    password: requiredEnv("ADMIN_SUPABASE_PASSWORD"),
  });
  if (error) throw new Error(`Portal E2E database login failed: ${error.message}`);
  return client;
}

export async function cleanupQaClients() {
  const client = await createPortalDbClient();
  const { data, error } = await client
    .from("clients")
    .select("id, profile_image_url")
    .ilike("name", `${QA_PREFIX}%`);
  if (error) throw new Error(`Could not find QA clients: ${error.message}`);

  for (const row of data ?? []) {
    if (!row.profile_image_url) continue;
    const marker = "/object/public/portal-assets/";
    const path = decodeURIComponent(
      new URL(row.profile_image_url).pathname.split(marker)[1] ?? "",
    );
    if (path.startsWith(`clients/${row.id}/avatar`)) {
      await client.storage.from("portal-assets").remove([path]);
    }
  }

  const ids = (data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { error: deleteError } = await client
      .from("clients")
      .delete()
      .in("id", ids);
    if (deleteError) {
      throw new Error(`Could not clean QA clients: ${deleteError.message}`);
    }
  }
}

export async function existingTikTokPostUrl() {
  const client = await createPortalDbClient();
  const { data, error } = await client
    .from("tiktok_posts")
    .select("post_url")
    .not("post_url", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read a test post URL: ${error.message}`);
  return data?.post_url ?? null;
}
