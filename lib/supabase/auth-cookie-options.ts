import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Durable first-party auth cookie options.
 *
 * Without Max-Age/Expires, browsers treat cookies as session-only. iOS Safari
 * (and Chrome on iOS) often drops those when the tab is closed; desktop Chrome
 * usually keeps the process alive so the same cookies appear to "persist".
 *
 * @supabase/ssr defaults to a 400-day maxAge; we pass them explicitly so every
 * createBrowserClient / createServerClient path stays consistent, and so
 * production cookies are marked Secure.
 */
export const SUPABASE_AUTH_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60;

export const supabaseAuthCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE_SEC,
  secure: process.env.NODE_ENV === "production",
};

/** Ensure Set-Cookie always includes durable attributes (login API / middleware). */
export function withDurableAuthCookieOptions(
  options?: Partial<CookieOptionsWithName> | null,
): CookieOptionsWithName {
  const clearing = typeof options?.maxAge === "number" && options.maxAge <= 0;

  if (clearing) {
    return {
      ...supabaseAuthCookieOptions,
      ...options,
      path: options?.path ?? supabaseAuthCookieOptions.path,
      sameSite: options?.sameSite ?? supabaseAuthCookieOptions.sameSite,
      maxAge: 0,
      httpOnly: false,
    };
  }

  return {
    ...supabaseAuthCookieOptions,
    ...options,
    path: options?.path ?? supabaseAuthCookieOptions.path,
    sameSite: options?.sameSite ?? supabaseAuthCookieOptions.sameSite,
    maxAge:
      typeof options?.maxAge === "number" && options.maxAge > 0
        ? options.maxAge
        : SUPABASE_AUTH_COOKIE_MAX_AGE_SEC,
    secure: options?.secure ?? supabaseAuthCookieOptions.secure,
    // Auth tokens must stay readable by createBrowserClient (document.cookie).
    httpOnly: false,
  };
}
