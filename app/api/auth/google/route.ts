import { NextResponse } from "next/server";

import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";
import { requestOriginFromHeaders } from "@/lib/auth/request-origin";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

/**
 * Starts Google OAuth on the server so the PKCE verifier is stored in first-party cookies
 * before redirecting to Google. Works in Safari/Chrome without client-side Supabase JS.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOriginFromHeaders(request.headers) || url.origin;
  const next = safeNextPath(url.searchParams.get("next"));
  const intent = url.searchParams.get("intent");

  try {
    const { supabase, redirect } = await createSupabaseRouteHandlerClient();

    const callbackParams = new URLSearchParams({ next });
    if (intent === "signup") callbackParams.set("type", "signup");
    const redirectTo = `${origin}${PATH_AUTH_CALLBACK}?${callbackParams.toString()}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.error("[api/auth/google] signInWithOAuth:", error?.message ?? "missing url");
      return NextResponse.redirect(new URL("/login?error=oauth", origin));
    }

    return redirect(data.url);
  } catch (err) {
    console.error("[api/auth/google]", err);
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }
}
