import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  appendOnboardingQuery,
  ONBOARDING_META_PENDING,
  shouldMarkOnboardingAfterAuth,
} from "@/lib/auth/onboarding";
import { PATH_APP_ENTRY } from "@/lib/auth/routes";
import { requestOriginFromHeaders } from "@/lib/auth/request-origin";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return PATH_APP_ENTRY;
  return raw;
}

function supabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

function mergeCookies(target: CookieToSet[], incoming: CookieToSet[]) {
  for (const entry of incoming) {
    const index = target.findIndex((c) => c.name === entry.name);
    if (index >= 0) target[index] = entry;
    else target.push(entry);
  }
}

function redirectWithCookies(origin: string, path: string, pendingCookies: CookieToSet[]) {
  const response = NextResponse.redirect(new URL(path, origin));
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

/**
 * Server-side OAuth / email-link exchange (Node route handler).
 * Session cookies are merged across every setAll call, then attached to the redirect.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = supabaseKey();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  const cookieStore = await cookies();
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        mergeCookies(
          pendingCookies,
          cookiesToSet.map(({ name, value, options }) => ({ name, value, options })),
        );
      },
    },
  });

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // Allow any deferred auth subscriber work to finish before we return.
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

    return redirectWithCookies(origin, destination, pendingCookies);
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

  return redirectWithCookies(origin, destination, pendingCookies);
}
