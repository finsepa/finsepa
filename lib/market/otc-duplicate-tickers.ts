/**
 * OTC / foreign-line symbols that duplicate a primary US listing (e.g. ASMLF vs ASML, TSMWF vs TSM).
 * Used by screener universe, earnings calendar grouping, and search dedupe.
 */

export function normTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/-/g, ".");
}

/**
 * Maps an OTC-style line onto its likely primary root for **issuer grouping** (calendar dedupe).
 * Plain primaries (ASML, TSM) are returned unchanged.
 */
export function issuerKeyForOtcListingCollapse(ticker: string): string {
  const t = normTicker(ticker);
  if (t.endsWith("WF") && t.length > 2) {
    const base = t.slice(0, -2);
    if (base.length >= 1) return base;
  }
  // Trailing “F” foreign/OTC ordinary (not `…WF`, not dotted share classes like BRK.B).
  if (!t.includes(".") && t.length >= 4 && t.endsWith("F") && !t.endsWith("WF")) {
    const base = t.slice(0, -1);
    if (base.length >= 2) return base;
  }
  return t;
}

/**
 * True when `ticker` is an OTC-style duplicate and `symbolSet` already contains the primary line
 * (e.g. hide ASMLF if ASML is in the same snapshot).
 */
export function shouldHideOtcForeignLineDuplicate(ticker: string, symbolSet: ReadonlySet<string>): boolean {
  const u = normTicker(ticker);
  if (u.endsWith("WF") && u.length > 2) {
    const base = u.slice(0, -2);
    if (base && symbolSet.has(base)) return true;
  }
  if (!u.includes(".") && u.length >= 4 && u.endsWith("F") && !u.endsWith("WF")) {
    const base = u.slice(0, -1);
    if (base.length >= 2 && symbolSet.has(base)) return true;
  }
  return false;
}

/** Removes redundant OTC lines from a cap-ranked universe (keeps primary when both exist). */
export function filterUniverseRowsRemovingOtcDuplicates<T extends { ticker: string }>(rows: readonly T[]): T[] {
  const symSet = new Set(rows.map((r) => normTicker(r.ticker)));
  return rows.filter((r) => !shouldHideOtcForeignLineDuplicate(r.ticker, symSet));
}
