import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { PATH_AUTH_RESET_PASSWORD, PATH_LOGIN } from "@/lib/auth/routes";

/**
 * Exchanges Supabase PKCE `code` from email links (e.g. password recovery) into session cookies,
 * then redirects to `next` (default: set new password).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") ?? PATH_AUTH_RESET_PASSWORD;
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : PATH_AUTH_RESET_PASSWORD;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL(`${PATH_LOGIN}?error=config`, url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${PATH_LOGIN}?error=missing_code`, url.origin));
  }

  let response = NextResponse.redirect(new URL(safeNext, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    response = NextResponse.redirect(new URL(`${PATH_LOGIN}?error=session`, url.origin));
    return response;
  }

  return response;
}
