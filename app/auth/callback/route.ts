import { NextResponse } from "next/server";

import {
  appendOnboardingQuery,
  ONBOARDING_META_PENDING,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK_COMPLETE } from "@/lib/auth/routes";
import { requestOriginFromHeaders } from "@/lib/auth/request-origin";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOriginFromHeaders(request.headers) || url.origin;

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const authType = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code && !(token_hash && type)) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  try {
    const { supabase, redirect } = await createSupabaseRouteHandlerClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
        return NextResponse.redirect(new URL("/login?error=session", origin));
      }

      let destination = next;
      const user = data.session?.user ?? null;
      if (shouldMarkOnboardingAfterAuth(user, authType)) {
        try {
          await supabase.auth.updateUser({ data: { [ONBOARDING_META_PENDING]: true } });
        } catch {
          /* non-blocking */
        }
        destination = appendOnboardingQuery(next);
      }

      const completeUrl = new URL(PATH_AUTH_CALLBACK_COMPLETE, origin);
      completeUrl.searchParams.set("next", destination);
      return redirect(completeUrl);
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token_hash!,
      type: type! as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    if (error) {
      console.error("[auth/callback] verifyOtp:", error.message);
      return NextResponse.redirect(new URL("/login?error=session", origin));
    }

    let destination = next;
    const user = data.session?.user ?? data.user ?? null;
    if (shouldMarkOnboardingAfterAuth(user, authType)) {
      try {
        await supabase.auth.updateUser({ data: { [ONBOARDING_META_PENDING]: true } });
      } catch {
        /* non-blocking */
      }
      destination = appendOnboardingQuery(next);
    }

    const completeUrl = new URL(PATH_AUTH_CALLBACK_COMPLETE, origin);
    completeUrl.searchParams.set("next", destination);
    return redirect(completeUrl);
  } catch (err) {
    console.error("[auth/callback]", err);
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }
}
