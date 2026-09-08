import "server-only";

import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { listTop500EquityTickersOrdered } from "@/lib/screener/screener-earnings-universe";
import {
  buildTop500MarketSnapshotForIngest,
  filterScreenerTop500ExcludedTickers,
  type TopCompanyUniverseRow,
} from "@/lib/screener/top500-companies";
import { EARNINGS_IR_VAULT_TOP_N } from "@/lib/market/earnings-ir-vault-types";

/** Drop non-IR / duplicate share-class noise from Phase-1 vault universe. */
const EARNINGS_IR_VAULT_EXCLUDED = new Set([
  "SPCX", // not a mega-cap IR issuer (screener artifact)
  "IDCBY", // ICBC OTC ADR — not a mega-cap IR issuer (same class of noise as SPCX)
  "SSNLF", // Samsung OTC — same class of noise as IDCBY
  "BRK-A", // same IR as BRK-B — keep one class
  "BRK-B", // no normal quarterly IR deck/press PDF program
]);

function filterVaultUniverseTickers(tickers: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tickers) {
    const t = raw.trim().toUpperCase();
    if (!t || seen.has(t) || EARNINGS_IR_VAULT_EXCLUDED.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Screener market-cap ordered top N. Prefer snapshot so CLI/cron work without Next cache. */
export async function listEarningsIrVaultUniverse(
  topN: number = EARNINGS_IR_VAULT_TOP_N,
): Promise<string[]> {
  const n = Math.max(1, topN);
  // Over-fetch so exclusions still leave a full top-N.
  const fetchN = Math.min(500, n + 10);
  const fromSnapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(
    MARKET_SNAPSHOT_KEY.top500Market,
  );
  const ordered = fromSnapshot?.length
    ? listTop500EquityTickersOrdered(filterScreenerTop500ExcludedTickers(fromSnapshot))
    : listTop500EquityTickersOrdered(await buildTop500MarketSnapshotForIngest());
  return filterVaultUniverseTickers(ordered.slice(0, fetchN)).slice(0, n);
}
