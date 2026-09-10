import { type NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-auth/session";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const hasSession = await verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const isLogin = pathname === "/admin/login";

  const withNoStore = (response: NextResponse) => {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    return response;
  };

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    if (pathname !== "/admin") {
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    return withNoStore(NextResponse.redirect(url));
  }

  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return withNoStore(NextResponse.redirect(url));
  }

  const { supabaseResponse } = await updateSession(request, {
    ensureBridge: hasSession,
  });
  return withNoStore(supabaseResponse);
}

export const config = {
  matcher: ["/admin/:path*"],
};
