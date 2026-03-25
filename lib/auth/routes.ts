/** Public marketing / landing */
export const PATH_PUBLIC_HOME = "/";

/** Email + password auth pages */
export const PATH_LOGIN = "/login";
export const PATH_SIGNUP = "/signup";

/** Default destination after sign-in (protected product entry) */
export const PATH_APP_ENTRY = "/screener";

export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/screener" || pathname.startsWith("/screener/")) return true;
  if (pathname.startsWith("/stock/")) return true;
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  return false;
}

export function isAuthPagePath(pathname: string): boolean {
  return pathname === PATH_LOGIN || pathname === PATH_SIGNUP;
}
