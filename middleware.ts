import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Keep middleware Edge-safe: do not import app modules or server-only utilities.
  const PATH_LOGIN = "/login";
  const PATH_SIGNUP = "/signup";
  const PATH_FORGOT_PASSWORD = "/forgot-password";
  const PATH_APP_ENTRY = "/screener";

  const path = request.nextUrl.pathname;

  const isProtectedPath =
    path === "/screener" ||
    path.startsWith("/screener/") ||
    path === "/crypto" ||
    path.startsWith("/crypto/") ||
    path.startsWith("/stock/") ||
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/watchlist" ||
    path.startsWith("/watchlist/");

  const isAuthGatePagePath = path === PATH_LOGIN || path === PATH_SIGNUP || path === PATH_FORGOT_PASSWORD;

  // If Supabase env is missing, fall back to basic protection.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (isProtectedPath) return NextResponse.redirect(new URL(PATH_LOGIN, request.url));
    return NextResponse.next();
  }

  // Minimal, Edge-safe Supabase client that reads/writes cookies.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Reflect Supabase cookie updates back into the response.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAuthGatePagePath) {
    return NextResponse.redirect(new URL(PATH_APP_ENTRY, request.url));
  }

  if (!user && isProtectedPath) {
    // Preserve where the user was trying to go (optional).
    const loginUrl = new URL(PATH_LOGIN, request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/screener/:path*",
    "/crypto/:path*",
    "/stock/:path*",
    "/account/:path*",
    "/watchlist/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
