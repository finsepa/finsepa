/**
 * Enrich unresolved 13F holdings with tickers (CUSIP map → OpenFIGI → EODHD issuer search).
 * Runs at ingest only — no UI changes.
 */

import "server-only";

import { resolve13fIssuerTickerCached } from "@/lib/superinvestors/resolve-13f-issuer-ticker";
import {
  mergeSuperinvestorCusipTickerMap,
  readSuperinvestorCusipTickerMap,
} from "@/lib/superinvestors/superinvestor-13f-cusip-ticker-store";
import {
  SUPERINVESTOR_CUSIP_TICKER_OVERRIDES,
  SUPERINVESTOR_ISSUER_TICKER_OVERRIDES,
} from "@/lib/superinvestors/superinvestor-13f-ticker-overrides";
import type {
  Berkshire13fComparisonPayload,
  Berkshire13fComparisonRow,
  Superinvestor13fProfilePageData,
  SuperinvestorTransactionsPayload,
} from "@/lib/superinvestors/types";

export type SuperinvestorTickerEnrichStats = {
  beforeUnresolved: number;
  afterUnresolved: number;
  resolvedStaticOrMap: number;
  resolvedOpenFigi: number;
  resolvedEodhd: number;
  holdingCount: number;
  resolutionRate: number;
};

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const OPENFIGI_API_KEY = process.env.OPENFIGI_API_KEY?.trim() || "";
/** OpenFIGI allows larger batches with an API key. */
const OPENFIGI_BATCH = OPENFIGI_API_KEY ? 100 : 10;
const OPENFIGI_BATCH_DELAY_MS = OPENFIGI_API_KEY ? 250 : 1100;
const EODHD_CONCURRENCY = 4;
/** Cap EODHD issuer searches per ingest (value-sorted). OpenFIGI covers CUSIPs first. */
const EODHD_MAX_PER_INGEST = 250;

async function mapOpenFigiCusips(cusips: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(cusips.map((c) => c.toUpperCase()).filter((c) => c.length >= 6))];
  for (let i = 0; i < unique.length; i += OPENFIGI_BATCH) {
    const batch = unique.slice(i, i + OPENFIGI_BATCH);
    const body = batch.map((idValue) => ({ idType: "ID_CUSIP" as const, idValue }));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (OPENFIGI_API_KEY) headers["X-OPENFIGI-APIKEY"] = OPENFIGI_API_KEY;
      const res = await fetch(OPENFIGI_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as Array<{
        data?: Array<{ ticker?: string; exchCode?: string }>;
        error?: string;
      }>;
      for (let j = 0; j < batch.length; j++) {
        const hit = json[j]?.data?.[0];
        const ticker = hit?.ticker?.trim();
        if (!ticker) continue;
        // Prefer US listings when OpenFIGI returns a bare ticker.
        out[batch[j]!] = ticker.toUpperCase();
      }
    } catch {
      /* rate limit / network — continue with other sources */
    }
    if (i + OPENFIGI_BATCH < unique.length) {
      await new Promise((r) => setTimeout(r, OPENFIGI_BATCH_DELAY_MS));
    }
  }
  return out;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function normalizeIssuerKey(issuer: string): string {
  return issuer
    .trim()
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyTickerToRow(row: Berkshire13fComparisonRow, ticker: string): Berkshire13fComparisonRow {
  return { ...row, ticker };
}

function applyTickerMapToComparison(
  comparison: Berkshire13fComparisonPayload,
  tickerByCusip: Record<string, string>,
  tickerByIssuer: Record<string, string>,
): { comparison: Berkshire13fComparisonPayload; resolved: number } {
  let resolved = 0;
  const rows = comparison.rows.map((row) => {
    if (row.ticker?.trim()) return row;
    const cusip = row.cusip?.toUpperCase() ?? "";
    const fromCusip = cusip.length >= 6 ? tickerByCusip[cusip] : null;
    if (fromCusip) {
      resolved += 1;
      return applyTickerToRow(row, fromCusip);
    }
    const issuerKey = normalizeIssuerKey(row.companyName);
    const fromIssuer =
      tickerByIssuer[issuerKey] ?? tickerByIssuer[row.companyName.trim().toLowerCase()];
    if (fromIssuer) {
      resolved += 1;
      return applyTickerToRow(row, fromIssuer);
    }
    return row;
  });

  const soldOut = comparison.soldOut.map((row) => {
    if (row.ticker?.trim()) return row;
    const cusip = row.cusip?.toUpperCase() ?? "";
    const fromCusip = cusip.length >= 6 ? tickerByCusip[cusip] : null;
    if (fromCusip) return { ...row, ticker: fromCusip };
    const issuerKey = normalizeIssuerKey(row.companyName);
    const fromIssuer =
      tickerByIssuer[issuerKey] ?? tickerByIssuer[row.companyName.trim().toLowerCase()];
    return fromIssuer ? { ...row, ticker: fromIssuer } : row;
  });

  return { comparison: { ...comparison, rows, soldOut }, resolved };
}

function applyTickerMapToTransactions(
  tx: SuperinvestorTransactionsPayload,
  tickerByCusip: Record<string, string>,
): SuperinvestorTransactionsPayload {
  return {
    ...tx,
    quarters: tx.quarters.map((q) => ({
      ...q,
      transactions: q.transactions.map((t) => {
        if (t.ticker?.trim()) return t;
        const cusip = t.cusip?.toUpperCase() ?? "";
        const fromCusip = cusip.length >= 6 ? tickerByCusip[cusip] : null;
        return fromCusip ? { ...t, ticker: fromCusip } : t;
      }),
    })),
  };
}

/**
 * Fill missing tickers on a profile page. Mutates via new object; safe for SSR ingest.
 */
export async function enrichSuperinvestorProfileTickers(
  page: Superinvestor13fProfilePageData,
): Promise<{ page: Superinvestor13fProfilePageData; stats: SuperinvestorTickerEnrichStats }> {
  const beforeUnresolved = page.comparison.rows.filter((r) => !r.ticker?.trim()).length;
  const holdingCount = page.comparison.rows.length;

  const persisted = await readSuperinvestorCusipTickerMap();
  let tickerByCusip: Record<string, string> = {
    ...SUPERINVESTOR_CUSIP_TICKER_OVERRIDES,
    ...persisted,
  };
  const tickerByIssuer: Record<string, string> = { ...SUPERINVESTOR_ISSUER_TICKER_OVERRIDES };

  let working = applyTickerMapToComparison(page.comparison, tickerByCusip, tickerByIssuer);
  let resolvedStaticOrMap = working.resolved;

  const stillNeedCusip = working.comparison.rows
    .filter((r) => !r.ticker?.trim() && r.cusip && r.cusip.length >= 6)
    .map((r) => r.cusip!.toUpperCase());

  let resolvedOpenFigi = 0;
  if (stillNeedCusip.length) {
    const figi = await mapOpenFigiCusips(stillNeedCusip);
    const learned: Record<string, string> = {};
    for (const [k, v] of Object.entries(figi)) {
      if (!tickerByCusip[k]) {
        tickerByCusip[k] = v;
        learned[k] = v;
        resolvedOpenFigi += 1;
      }
    }
    if (Object.keys(learned).length) {
      await mergeSuperinvestorCusipTickerMap(learned);
    }
    working = applyTickerMapToComparison(working.comparison, tickerByCusip, tickerByIssuer);
  }

  const unresolvedByValue = working.comparison.rows
    .filter((r) => !r.ticker?.trim())
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, EODHD_MAX_PER_INGEST);

  let resolvedEodhd = 0;
  if (unresolvedByValue.length) {
    const results = await mapPool(unresolvedByValue, EODHD_CONCURRENCY, async (row) => {
      const ticker = await resolve13fIssuerTickerCached(row.companyName);
      return { row, ticker };
    });
    const learned: Record<string, string> = {};
    for (const { row, ticker } of results) {
      if (!ticker) continue;
      resolvedEodhd += 1;
      tickerByIssuer[row.companyName.trim().toLowerCase()] = ticker;
      if (row.cusip && row.cusip.length >= 6) {
        tickerByCusip[row.cusip.toUpperCase()] = ticker;
        learned[row.cusip.toUpperCase()] = ticker;
      }
    }
    if (Object.keys(learned).length) {
      await mergeSuperinvestorCusipTickerMap(learned);
    }
    working = applyTickerMapToComparison(working.comparison, tickerByCusip, tickerByIssuer);
  }

  const transactions = applyTickerMapToTransactions(page.transactions, tickerByCusip);
  const afterUnresolved = working.comparison.rows.filter((r) => !r.ticker?.trim()).length;
  const resolutionRate = holdingCount > 0 ? (holdingCount - afterUnresolved) / holdingCount : 1;

  return {
    page: { comparison: working.comparison, transactions },
    stats: {
      beforeUnresolved,
      afterUnresolved,
      resolvedStaticOrMap,
      resolvedOpenFigi,
      resolvedEodhd,
      holdingCount,
      resolutionRate,
    },
  };
}
