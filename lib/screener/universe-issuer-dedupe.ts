import { normTicker } from "@/lib/market/otc-duplicate-tickers";

export type IssuerDedupeRow = { ticker: string; name: string; marketCapUsd: number };

/**
 * Lowercase issuer key for grouping ADR vs OTC-F lines and bank common vs preferred (same display name).
 * Keeps share-class phrases (Class A/B/C) so GOOGL vs GOOG stay separate.
 */
export function normalizeIssuerNameForGrouping(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\b(adr|ads)\b/g, " ");
  s = s.replace(
    /\b(incorporated|inc\.?|corp\.?|corporation|plc|sa|nv|n\.v\.|ltd\.?|limited|lp|l\.p\.)\b/g,
    " ",
  );
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function normalizeSeparators(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[\u2010-\u2015]/g, "-");
}

/**
 * Preferred / depositary series: `BAC-PE`, `BML-PJ`, `BAC.PE` (suffix length ≥ 2).
 * **Not** common share classes like `BRK-B`, `BF-A` (single-letter suffix after `-` or `.`).
 */
export function issuerTickerHasStructuredSecondarySuffix(ticker: string): boolean {
  const u = normalizeSeparators(ticker);
  const hy = u.indexOf("-");
  if (hy >= 1 && u.slice(hy + 1).length >= 2) return true;
  const dot = u.indexOf(".");
  if (dot >= 1 && u.slice(dot + 1).length >= 2) return true;
  return false;
}

/** Pink-style foreign ordinary (e.g. TOYOF, NSRGF) — not BRK.B (share class uses a dot). */
function isTrailingFOrdinaryLine(ticker: string): boolean {
  const u = normTicker(ticker);
  return u.length >= 4 && !u.includes(".") && u.endsWith("F") && !u.endsWith("WF");
}

function collapseIssuerGroup<T extends IssuerDedupeRow>(group: readonly T[]): T[] {
  if (group.length <= 1) return [...group];

  const sorted = [...group].sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  let kept = sorted;

  const hasNonF = kept.some((r) => !isTrailingFOrdinaryLine(r.ticker));
  if (hasNonF && kept.some((r) => isTrailingFOrdinaryLine(r.ticker))) {
    kept = kept.filter((r) => !isTrailingFOrdinaryLine(r.ticker));
  }

  const hasPrimary = kept.some((r) => !issuerTickerHasStructuredSecondarySuffix(r.ticker));
  if (hasPrimary && kept.some((r) => issuerTickerHasStructuredSecondarySuffix(r.ticker))) {
    kept = kept.filter((r) => !issuerTickerHasStructuredSecondarySuffix(r.ticker));
  }

  const hasNoHyphen = kept.some((r) => !normalizeSeparators(r.ticker).includes("-"));
  if (hasNoHyphen && kept.some((r) => normalizeSeparators(r.ticker).includes("-"))) {
    kept = kept.filter((r) => !normalizeSeparators(r.ticker).includes("-"));
  }

  if (kept.length > 1 && kept.every((r) => issuerTickerHasStructuredSecondarySuffix(r.ticker))) {
    kept = [kept[0]!];
  }

  return kept;
}

/**
 * One line per issuer where EODHD lists ADR + OTC-F or common + preferred (same `name` string).
 * Rows should already be cap-sorted; output is re-sorted by market cap.
 */
export function filterIssuerLineDuplicatesInUniverse<T extends IssuerDedupeRow>(rows: readonly T[]): T[] {
  const byName = new Map<string, T[]>();
  for (const r of rows) {
    const k = normalizeIssuerNameForGrouping(r.name);
    const arr = byName.get(k) ?? [];
    arr.push(r);
    byName.set(k, arr);
  }

  const out: T[] = [];
  for (const [, group] of byName) {
    out.push(...collapseIssuerGroup(group));
  }
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  return out;
}
