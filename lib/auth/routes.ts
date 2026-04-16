/** Public marketing / landing */
export const PATH_PUBLIC_HOME = "/";

/** Email + password auth pages */
export const PATH_LOGIN = "/login";
export const PATH_SIGNUP = "/signup";
export const PATH_FORGOT_PASSWORD = "/forgot-password";

/** Password recovery: Supabase `redirectTo` should list this URL; links land here and the client exchanges PKCE/hash tokens into the session. */
export const PATH_AUTH_CALLBACK = "/auth/callback";
export const PATH_AUTH_RESET_PASSWORD = "/auth/reset-password";

/** Default destination after sign-in (protected product entry) */
export const PATH_APP_ENTRY = "/screener";

export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/screener" || pathname.startsWith("/screener/")) return true;
  if (pathname === "/crypto" || pathname.startsWith("/crypto/")) return true;
  if (pathname.startsWith("/stock/")) return true;
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  if (pathname === "/watchlist" || pathname.startsWith("/watchlist/")) return true;
  return false;
}

/** Pages where an already signed-in user is redirected to the app (not recovery completion). */
export function isAuthGatePagePath(pathname: string): boolean {
  return pathname === PATH_LOGIN || pathname === PATH_SIGNUP || pathname === PATH_FORGOT_PASSWORD;
}

/** @deprecated Use `isAuthGatePagePath` — reset-password is excluded so recovery sessions can complete. */
export function isAuthPagePath(pathname: string): boolean {
  return isAuthGatePagePath(pathname);
}
