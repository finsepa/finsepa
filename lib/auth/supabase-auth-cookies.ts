/** True when the request may have a Supabase session (skip remote auth on public auth pages). */
export function requestHasSupabaseAuthCookies(
  cookies: ReadonlyArray<{ name: string }>,
): boolean {
  return cookies.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth"),
  );
}
