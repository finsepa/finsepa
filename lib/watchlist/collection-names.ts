/** Default server name and common user rename for the primary watchlist. */
const PRIMARY_WATCHLIST_NAMES = new Set(["main", "watchlist"]);

/** True when two collection names refer to the same logical list (e.g. Main ↔ Watchlist). */
export function collectionNamesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return true;
  return PRIMARY_WATCHLIST_NAMES.has(left) && PRIMARY_WATCHLIST_NAMES.has(right);
}
