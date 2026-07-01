import "server-only";

import { listTop500EquityTickersOrdered } from "@/lib/screener/screener-earnings-universe";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";

/** Extra tickers outside top-cap list that we always include in the warm universe. */
const WARM_EXTRA_TICKERS = ["MU", "AMD", "CMCSA", "PYPL", "RACE", "COIN", "MAR"] as const;

/** How many equities to include from the screener top-500 snapshot. */
export const EARNINGS_WARM_UNIVERSE_CAP = 100;

export const EARNINGS_WARM_SHARD_COUNT = 7;

/** Max tickers processed per cron invocation (serverless time budget). */
export const EARNINGS_WARM_TICKERS_PER_RUN = 10;

function hashTicker(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (Math.imul(31, h) + ticker.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function listEarningsDocumentWarmUniverse(): Promise<string[]> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const top = listTop500EquityTickersOrdered(universe).slice(0, EARNINGS_WARM_UNIVERSE_CAP);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...TOP10_TICKERS, ...top, ...WARM_EXTRA_TICKERS]) {
    const sym = t.trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}

export function tickersForWarmShard(
  universe: readonly string[],
  shard: number,
  options?: { shardCount?: number; perRun?: number; dayOffset?: number },
): { shard: number; shardCount: number; tickers: string[]; totalInShard: number } {
  const shardCount = options?.shardCount ?? EARNINGS_WARM_SHARD_COUNT;
  const perRun = options?.perRun ?? EARNINGS_WARM_TICKERS_PER_RUN;
  const safeShard = ((shard % shardCount) + shardCount) % shardCount;

  const inShard = universe.filter((t) => hashTicker(t) % shardCount === safeShard);
  const dayIndex = options?.dayOffset ?? Math.floor(Date.now() / 86_400_000);
  const pages = Math.max(1, Math.ceil(inShard.length / perRun));
  const page = dayIndex % pages;
  const offset = page * perRun;

  return {
    shard: safeShard,
    shardCount,
    tickers: inShard.slice(offset, offset + perRun),
    totalInShard: inShard.length,
  };
}
