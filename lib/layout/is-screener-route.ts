/** True on `/screener` and nested screener routes. */
export function isScreenerRoute(pathname: string): boolean {
  return pathname === "/screener" || pathname.startsWith("/screener/");
}
