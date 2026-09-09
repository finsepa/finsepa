import "server-only";

import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { fetchEodhdExchangeSymbolListUncachedDirect } from "@/lib/market/eodhd-exchange-symbols";
import { fetchEodhdTopByMarketCapUncached, type EodhdTopUniverseRow } from "@/lib/market/eodhd-screener";
import { filterUniverseRowsRemovingOtcDuplicates } from "@/lib/market/otc-duplicate-tickers";
import { listTop500EquityTickersOrdered } from "@/lib/screener/screener-earnings-universe";
import {
  filterScreenerTop500ExcludedTickers,
  type TopCompanyUniverseRow,
} from "@/lib/screener/top500-companies";
import { filterIssuerLineDuplicatesInUniverse } from "@/lib/screener/universe-issuer-dedupe";
import { isUsSecTenQTenKIssuer } from "@/lib/market/sec-earnings-us-filers";

export const SEC_EARNINGS_REPORTS_UNIVERSE_DEFAULT = 500;

function mergeCapRows(pages: readonly EodhdTopUniverseRow[]): TopCompanyUniverseRow[] {
  const byTicker = new Map<string, TopCompanyUniverseRow>();
  for (const r of pages) {
    const prev = byTicker.get(r.ticker);
    if (!prev || r.marketCapUsd > prev.marketCapUsd) byTicker.set(r.ticker, r);
  }
  const out = Array.from(byTicker.values());
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  return filterScreenerTop500ExcludedTickers(
    filterIssuerLineDuplicatesInUniverse(filterUniverseRowsRemovingOtcDuplicates(out)),
  );
}

type ExchangeMeta = {
  type: string | null;
  name: string;
  marketCapUsd: number | null;
  exchange: string | null;
};

const LISTED_US_VENUES = new Set(["NYSE", "NASDAQ", "AMEX", "NYSE MKT"]);

function venueRank(exchange: string | null | undefined): number {
  const u = (exchange ?? "").trim().toUpperCase();
  if (u === "NYSE") return 0;
  if (u === "NASDAQ") return 1;
  if (u === "AMEX" || u === "NYSE MKT") return 2;
  return 9;
}

function isListedUsVenue(exchange: string | null | undefined): boolean {
  if (!exchange) return false;
  return LISTED_US_VENUES.has(exchange.trim().toUpperCase());
}

async function loadExchangeMeta(): Promise<Map<string, ExchangeMeta>> {
  const out = new Map<string, ExchangeMeta>();
  try {
    const rows = await fetchEodhdExchangeSymbolListUncachedDirect("US");
    for (const r of rows) {
      const ticker = r.ticker.trim().toUpperCase();
      if (!ticker) continue;
      out.set(ticker, {
        type: r.type,
        name: r.name,
        marketCapUsd: r.marketCapUsd,
        exchange: r.exchange,
      });
    }
  } catch {
    /* Universe filter still works from ticker/name heuristics. */
  }
  return out;
}

function eligibleTickersFromRows(
  rows: readonly TopCompanyUniverseRow[],
  metaByTicker: ReadonlyMap<string, ExchangeMeta>,
): { eligible: string[]; skipped: number } {
  const eligible: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const row of rows) {
    const ticker = row.ticker.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const meta = metaByTicker.get(ticker);
    if (
      !isUsSecTenQTenKIssuer({
        ticker,
        name: row.name || meta?.name,
        type: meta?.type ?? null,
      })
    ) {
      skipped += 1;
      continue;
    }
    eligible.push(ticker);
  }
  return { eligible, skipped };
}

function fillFromExchangeList(
  already: readonly string[],
  metaByTicker: ReadonlyMap<string, ExchangeMeta>,
  limit: number,
): string[] {
  const seen = new Set(already);
  const extra = [...metaByTicker.entries()]
    .filter(([ticker, meta]) => {
      if (seen.has(ticker)) return false;
      const type = (meta.type ?? "").toLowerCase();
      if (!type.includes("common stock")) return false;
      if (!isListedUsVenue(meta.exchange)) return false;
      const rootLen = ticker.replace(/[-.]/g, "").length;
      // Screener already kept large 5-letter names (GOOGL, CRWD). Unranked
      // 5-letter extras are mostly SPACs / microcaps because exchange-list caps are null.
      if (rootLen >= 5) return false;
      return isUsSecTenQTenKIssuer({ ticker, name: meta.name, type: meta.type });
    })
    .sort((a, b) => {
      const venue = venueRank(a[1].exchange) - venueRank(b[1].exchange);
      if (venue !== 0) return venue;
      const len = a[0].replace(/[-.]/g, "").length - b[0].replace(/[-.]/g, "").length;
      if (len !== 0) return len;
      return a[0].localeCompare(b[0]);
    });
  const out = [...already];
  for (const [ticker] of extra) {
    if (out.length >= limit) break;
    seen.add(ticker);
    out.push(ticker);
  }
  return out;
}

/**
 * Market-cap ordered US issuers expected to file 10-Q/10-K.
 * Skips FPIs, ADRs, OTC foreign lines, and preferreds before any SEC warm.
 */
export async function listSecEarningsReportsUniverse(
  limit: number = SEC_EARNINGS_REPORTS_UNIVERSE_DEFAULT,
): Promise<{ tickers: string[]; skipped: number; scanned: number }> {
  const n = Math.max(1, Math.min(2000, Math.trunc(limit)));
  const metaByTicker = await loadExchangeMeta();

  const fromSnapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
  let merged = fromSnapshot?.length
    ? mergeCapRows(filterScreenerTop500ExcludedTickers(fromSnapshot))
    : [];

  // CLI/cron cannot use Next `unstable_cache`. Fill from the uncached screener
  // starting at offset 0 when the snapshot is missing or too small.
  let offset = merged.length >= 100 ? 500 : 0;
  let partitioned = eligibleTickersFromRows(merged, metaByTicker);

  while (partitioned.eligible.length < n && offset <= 900) {
    const page = await fetchEodhdTopByMarketCapUncached({ limit: 100, offset });
    if (page.length === 0) break;
    merged = mergeCapRows([...merged, ...page]);
    partitioned = eligibleTickersFromRows(merged, metaByTicker);
    offset += 100;
  }

  if (partitioned.eligible.length < n) {
    for (const exchangeFilter of ["NYSE", "NASDAQ"] as const) {
      for (let exOffset = 0; partitioned.eligible.length < n && exOffset <= 2400; exOffset += 100) {
        const page = await fetchEodhdTopByMarketCapUncached({
          limit: 100,
          offset: exOffset,
          exchangeFilter,
        });
        if (page.length === 0) break;
        merged = mergeCapRows([...merged, ...page]);
        partitioned = eligibleTickersFromRows(merged, metaByTicker);
      }
    }
  }

  const tickers = fillFromExchangeList(partitioned.eligible, metaByTicker, n).slice(0, n);

  return {
    tickers,
    skipped: partitioned.skipped,
    scanned: merged.length,
  };
}

/** Same cap order as the screener top-500 helper, after the US 10-Q/10-K filter. */
export async function listSecEarningsReportsTickers(
  limit: number = SEC_EARNINGS_REPORTS_UNIVERSE_DEFAULT,
): Promise<string[]> {
  const { tickers } = await listSecEarningsReportsUniverse(limit);
  return listTop500EquityTickersOrdered(tickers.map((ticker) => ({ ticker }))).slice(0, limit);
}
