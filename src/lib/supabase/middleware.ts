import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { ensureSupabaseBridge } from "@/lib/admin-auth/bridge";

/** Keep Supabase auth cookies fresh when the optional email bridge session is present. */
export async function updateSession(
  request: NextRequest,
  options?: { ensureBridge?: boolean },
) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Validate once so refresh tokens rotate when bridge auth is used.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (options?.ensureBridge) {
    try {
      await ensureSupabaseBridge(supabase, Boolean(user));
    } catch {
      // Login page / missing env will surface through portal errors.
    }
  }

  return { supabaseResponse };
}
