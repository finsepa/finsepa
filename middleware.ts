import { type NextRequest, NextResponse } from "next/server";
import {
  isAuthPagePath,
  isProtectedPath,
  PATH_APP_ENTRY,
  PATH_LOGIN,
} from "@/lib/auth/routes";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const path = request.nextUrl.pathname;

  if (!supabase) {
    if (isProtectedPath(path)) {
      return NextResponse.redirect(new URL(PATH_LOGIN, request.url));
    }
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAuthPagePath(path)) {
    return NextResponse.redirect(new URL(PATH_APP_ENTRY, request.url));
  }

  if (!user && isProtectedPath(path)) {
    return NextResponse.redirect(new URL(PATH_LOGIN, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/screener",
    "/screener/:path*",
    "/stock/:path*",
    "/account",
    "/account/:path*",
    "/login",
    "/signup",
  ],
};
