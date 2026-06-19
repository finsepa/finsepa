import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  appendOnboardingQuery,
  ONBOARDING_META_PENDING,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import { PATH_APP_ENTRY, PATH_AUTH_CALLBACK } from "@/lib/auth/routes";
import { requestOriginFromHeaders } from "@/lib/auth/request-origin";
import { createSupabaseServerClientFromRequest } from "@/lib/supabase/server-client-from-request";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

type AuthCallbackResult =
  | { handled: false }
  | { handled: true; response: NextResponse };

/**
 * Exchanges OAuth `code` or email `token_hash` on the server and sets session cookies
 * on the redirect response. Returns `{ handled: false }` when the URL has no server-visible
 * auth params (e.g. implicit hash flow — `/auth/callback` client page handles those).
 */
export async function handleAuthCallbackRequest(request: NextRequest): Promise<AuthCallbackResult> {
  if (request.nextUrl.pathname !== PATH_AUTH_CALLBACK) {
    return { handled: false };
  }

  const url = request.nextUrl;
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const origin = requestOriginFromHeaders(request.headers) || url.origin;
    return {
      handled: true,
      response: NextResponse.redirect(new URL("/login?error=oauth", origin)),
    };
  }

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const authType = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code && !(token_hash && type)) {
    return { handled: false };
  }

  const origin = requestOriginFromHeaders(request.headers) || url.origin;
  const { supabase, withCookies } = createSupabaseServerClientFromRequest(request);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return {
        handled: true,
        response: NextResponse.redirect(new URL("/login?error=session", origin)),
      };
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

    return {
      handled: true,
      response: withCookies(NextResponse.redirect(new URL(destination, origin))),
    };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token_hash!,
    type: type! as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
  });

  if (error) {
    return {
      handled: true,
      response: NextResponse.redirect(new URL("/login?error=session", origin)),
    };
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

  return {
    handled: true,
    response: withCookies(NextResponse.redirect(new URL(destination, origin))),
  };
}
