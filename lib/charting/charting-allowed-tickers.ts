import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/**
 * Popular equities for charting / comparison pickers (top-10 first, then screener universe).
 * Search can still surface remote hits outside this list; URL sessions keep those picks.
 */
export function buildChartingAllowedTickerList(universe: readonly { ticker: string }[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of TOP10_TICKERS) {
    const u = t.trim().toUpperCase();
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  // Allow the full screener universe so `/comparison` and charting pickers work for common tickers (e.g. PYPL).
  for (const r of universe) {
    const u = r.ticker.trim().toUpperCase();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** US tickers may appear as `BRK-B` (universe) vs `BRK.B` (URL / search). */
function chartingTickerUrlAliases(u: string): string[] {
  const s = u.trim().toUpperCase();
  return [s, s.replace(/\./g, "-"), s.replace(/-/g, ".")];
}

function resolveChartingTickerAgainstAllowlist(raw: string, allow: Set<string>): string | null {
  for (const candidate of chartingTickerUrlAliases(raw)) {
    if (allow.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Tickers from `?ticker=` for Charting / comparison sessions.
 * Prefer the allowlist’s canonical form when present (hyphen/dot aliases).
 * Otherwise keep the URL ticker so company-picker remote search picks (e.g. FIG)
 * are not silently dropped after `router.replace`.
 */
export function filterChartingUrlTickersForSession(
  parsedTickers: readonly string[],
  chartingAllowSet: Set<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  if (isSingleAssetMode()) {
    for (const t of parsedTickers) {
      const u = t.trim().toUpperCase();
      if (!u || seen.has(u)) continue;
      if (!isSupportedAsset(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }

  for (const t of parsedTickers) {
    const u = t.trim().toUpperCase();
    if (!u) continue;
    const resolved =
      chartingAllowSet.size > 0
        ? (resolveChartingTickerAgainstAllowlist(t, chartingAllowSet) ?? u)
        : u;
    if (seen.has(resolved)) continue;
    if (chartingTickerUrlAliases(resolved).some((alias) => seen.has(alias))) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}
