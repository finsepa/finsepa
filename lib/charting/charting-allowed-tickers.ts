import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/**
 * Equities allowed on `/charting` — same universe as the company picker and screener stock search
 * (screener universe; top-10 preserved first).
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
 * When the allowlist is empty (cold or failed universe build), accept URL tickers so sessions are not stuck.
 * Otherwise require membership (with hyphen/dot alias resolution).
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

  if (chartingAllowSet.size === 0) {
    for (const t of parsedTickers) {
      const u = t.trim().toUpperCase();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }

  for (const t of parsedTickers) {
    const resolved = resolveChartingTickerAgainstAllowlist(t, chartingAllowSet);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}
