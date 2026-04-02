import type { ScreenerTableRow } from "@/lib/screener/screener-static";

/** Internal only — stripped before RSC passes rows to the client table. */
export type ScreenerRowWithMarketCapSort = ScreenerTableRow & {
  marketCapUsd: number | null;
};

const SORT_MISSING = -1;

/**
 * Parse display strings like "$3.22T", "$890.44 B" for fallback / error rows only.
 * Returns null if unparseable or "-".
 */
export function parseMarketCapDisplayToUsd(display: string): number | null {
  const t = display.trim();
  if (!t || t === "-") return null;
  const compact = t.replace(/\s/g, "").replace(/^\$/, "");
  const m = compact.match(/^([\d.]+)(T|B|M)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suf = (m[2] ?? "").toUpperCase();
  if (suf === "T") return n * 1e12;
  if (suf === "B") return n * 1e9;
  if (suf === "M") return n * 1e6;
  return n;
}

/** Largest market cap first; missing / invalid caps last; stable tie-break by ticker. */
export function sortRowsByMarketCapDesc(rows: ScreenerRowWithMarketCapSort[]): ScreenerTableRow[] {
  const sorted = [...rows].sort((a, b) => {
    const ka = a.marketCapUsd != null && Number.isFinite(a.marketCapUsd) ? a.marketCapUsd : SORT_MISSING;
    const kb = b.marketCapUsd != null && Number.isFinite(b.marketCapUsd) ? b.marketCapUsd : SORT_MISSING;
    const diff = kb - ka;
    if (diff !== 0) return diff;
    return a.ticker.localeCompare(b.ticker);
  });
  return sorted.map(({ marketCapUsd, ...row }) => {
    void marketCapUsd;
    return row;
  });
}
