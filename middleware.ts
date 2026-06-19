import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { requestHasSupabaseAuthCookies } from "@/lib/auth/supabase-auth-cookies";

export async function middleware(request: NextRequest) {
  // Keep middleware Edge-safe: do not import app modules or server-only utilities.
  const PATH_LOGIN = "/login";
  const PATH_SIGNUP = "/signup";
  const PATH_FORGOT_PASSWORD = "/forgot-password";
  const PATH_APP_ENTRY = "/screener";
  const PATH_ACTIVATE_SUBSCRIPTION = "/activate-subscription";

  const path = request.nextUrl.pathname;

  /**
   * Avatar files live in `public/superinvestors/*.png`. `next/image` loads the source URL from the
   * optimization worker without session cookies; if these paths stay auth-gated, the worker gets
   * HTML (login redirect) instead of bytes → broken avatars on the Superinvestors table and profiles.
   */
  if (/^\/superinvestors\/[^/]+\.(?:png|jpe?g|webp|gif|svg)$/i.test(path)) {
    return NextResponse.next();
  }

  const isActivateSubscriptionPath = path === PATH_ACTIVATE_SUBSCRIPTION || path.startsWith(`${PATH_ACTIVATE_SUBSCRIPTION}/`);

  const isProtectedPath =
    path === "/screener" ||
    path.startsWith("/screener/") ||
    path === "/news" ||
    path.startsWith("/news/") ||
    path === "/macro" ||
    path.startsWith("/macro/") ||
    path === "/earnings" ||
    path.startsWith("/earnings/") ||
    path === "/charting" ||
    path.startsWith("/charting/") ||
    path === "/crypto" ||
    path.startsWith("/crypto/") ||
    path.startsWith("/stock/") ||
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/watchlist" ||
    path.startsWith("/watchlist/") ||
    path === "/portfolio" ||
    path.startsWith("/portfolio/") ||
    path === "/portfolios" ||
    path.startsWith("/portfolios/") ||
    path === "/superinvestors" ||
    path.startsWith("/superinvestors/") ||
    path.startsWith("/index/");

  const isAuthGatePagePath = path === PATH_LOGIN || path === PATH_SIGNUP || path === PATH_FORGOT_PASSWORD;

  // Logged-out visitors on auth pages: skip Supabase round-trip (major TTFB win on /login).
  if (isAuthGatePagePath && !requestHasSupabaseAuthCookies(request.cookies.getAll())) {
    return NextResponse.next();
  }

  // If Supabase env is missing, fall back to basic protection.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    if (isProtectedPath) return NextResponse.redirect(new URL(PATH_LOGIN, request.url));
    return NextResponse.next();
  }

  // Minimal, Edge-safe Supabase client that reads/writes cookies.
  const response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Merge every chunk onto the same response — recreating NextResponse drops prior Set-Cookie headers.
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAuthGatePagePath) {
    return NextResponse.redirect(new URL(PATH_APP_ENTRY, request.url));
  }

  if (!user && (isProtectedPath || isActivateSubscriptionPath)) {
    // Preserve where the user was trying to go (optional).
    const loginUrl = new URL(PATH_LOGIN, request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/screener",
    "/screener/:path*",
    "/news/:path*",
    "/macro/:path*",
    "/earnings/:path*",
    "/charting/:path*",
    "/crypto/:path*",
    "/stock/:path*",
    "/account/:path*",
    "/watchlist/:path*",
    "/portfolio",
    "/portfolio/:path*",
    "/portfolios",
    "/portfolios/:path*",
    "/superinvestors",
    "/superinvestors/:path*",
    "/index/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/activate-subscription",
  ],
};
