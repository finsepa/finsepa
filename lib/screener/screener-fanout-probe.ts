import "server-only";

import { peekEodhdRequestWindow } from "@/lib/market/eodhd-hourly-budget";
import { runWithProviderTraceCollect, type ProviderTraceSnapshot } from "@/lib/market/provider-trace";
import {
  buildCryptoScreenerApiResponse,
  buildScreenerCompaniesApiResponse,
  buildScreenerMarketTabApiResponse,
} from "@/lib/screener/screener-page-payload";
import {
  SCREENER_COMPANIES_PAGE_SIZE,
  SCREENER_CRYPTO_PAGE_SIZE,
} from "@/lib/screener/screener-markets-page-size";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

export type ScreenerFanoutProbeOptions = {
  /** Simulated concurrent readers (default 100). */
  users?: number;
};

export type ScreenerFanoutFingerprint = {
  stocksRowCount: number;
  stocksFirstTicker: string | null;
  stocksTotal: number;
  cryptoRowCount: number;
  cryptoFirstSymbol: string | null;
  cryptoTotal: number;
  companiesPageRowCount: number;
};

export type ScreenerFanoutProbeReport = {
  at: string;
  segment: string;
  marketMode: "live" | "frozen";
  users: number;
  /** Warm / seed read (may pay snapshot miss once). */
  warmTrace: ProviderTraceSnapshot;
  /** Concurrent fan-out of `users` identical screener reads. */
  fanoutTrace: ProviderTraceSnapshot;
  budgetBefore: ReturnType<typeof peekEodhdRequestWindow>;
  budgetAfter: ReturnType<typeof peekEodhdRequestWindow>;
  fingerprint: ScreenerFanoutFingerprint;
  /** True when every concurrent user got the same fingerprint. */
  allUsersSharedSamePayload: boolean;
  /**
   * Pass when fan-out wave traced ~0 EODHD HTTP (shared snapshot) and fingerprints match.
   * Warm may still show a few calls on a cold isolate — that is expected once, not × users.
   */
  pass: boolean;
  notes: string[];
};

function fingerprintFromParts(parts: {
  stocks: Awaited<ReturnType<typeof buildScreenerMarketTabApiResponse>>;
  crypto: Awaited<ReturnType<typeof buildCryptoScreenerApiResponse>>;
  companies: Awaited<ReturnType<typeof buildScreenerCompaniesApiResponse>>;
}): ScreenerFanoutFingerprint {
  const stocks = parts.stocks.market === "stocks" ? parts.stocks : null;
  return {
    stocksRowCount: stocks?.stockRows.length ?? 0,
    stocksFirstTicker: stocks?.stockRows[0]?.ticker ?? null,
    stocksTotal: stocks?.stocksTotalCount ?? 0,
    cryptoRowCount: parts.crypto.rows.length,
    cryptoFirstSymbol: parts.crypto.rows[0]?.symbol ?? null,
    cryptoTotal: parts.crypto.total,
    companiesPageRowCount: parts.companies.rows.length,
  };
}

function fingerprintsEqual(a: ScreenerFanoutFingerprint, b: ScreenerFanoutFingerprint): boolean {
  return (
    a.stocksRowCount === b.stocksRowCount &&
    a.stocksFirstTicker === b.stocksFirstTicker &&
    a.stocksTotal === b.stocksTotal &&
    a.cryptoRowCount === b.cryptoRowCount &&
    a.cryptoFirstSymbol === b.cryptoFirstSymbol &&
    a.cryptoTotal === b.cryptoTotal &&
    a.companiesPageRowCount === b.companiesPageRowCount
  );
}

async function loadScreenerBundle() {
  const [stocks, crypto, companies] = await Promise.all([
    buildScreenerMarketTabApiResponse("stocks"),
    buildCryptoScreenerApiResponse(1, SCREENER_CRYPTO_PAGE_SIZE),
    buildScreenerCompaniesApiResponse(1, SCREENER_COMPANIES_PAGE_SIZE),
  ]);
  return { stocks, crypto, companies };
}

/**
 * Simulate N concurrent screener/markets readers in one isolate.
 * Expectation: after a warm read, the fan-out wave traces ≈0 EODHD HTTP and every user
 * receives the same snapshot fingerprint (shared `market_snapshot` / session cache).
 */
export async function runScreenerFanoutProbe(
  options: ScreenerFanoutProbeOptions = {},
): Promise<ScreenerFanoutProbeReport> {
  const users = Math.min(200, Math.max(2, Math.trunc(options.users ?? 100) || 100));
  const epoch = getScreenerUsMarketCacheEpoch();
  const budgetBefore = peekEodhdRequestWindow();
  const notes: string[] = [];

  const warm = await runWithProviderTraceCollect("screener-fanout/warm", async () => loadScreenerBundle());
  const fingerprint = fingerprintFromParts(warm.result);

  if (fingerprint.stocksRowCount === 0 && fingerprint.cryptoRowCount === 0) {
    notes.push("warm payload empty — hubs may be missing; fan-out result is inconclusive");
  }
  if (warm.trace.eodhdHttp > 0) {
    notes.push(
      `warm paid ${warm.trace.eodhdHttp} EODHD HTTP (cold isolate / hub miss). Fan-out must still be ~0 if sharing works.`,
    );
  }

  const fanout = await runWithProviderTraceCollect(`screener-fanout/users-${users}`, async () => {
    const results = await Promise.all(Array.from({ length: users }, () => loadScreenerBundle()));
    return results.map(fingerprintFromParts);
  });

  const allUsersSharedSamePayload = fanout.result.every((fp) => fingerprintsEqual(fp, fingerprint));
  if (!allUsersSharedSamePayload) {
    notes.push("fingerprint mismatch across concurrent users — not sharing one payload");
  }

  const fanoutEodhd = fanout.trace.eodhdHttp;
  // Allow a tiny leak (0–2) for incidental reads; fail hard if it scales with users.
  const pass = allUsersSharedSamePayload && fanoutEodhd <= 2 && fingerprint.stocksRowCount + fingerprint.cryptoRowCount > 0;

  if (fanoutEodhd > 2) {
    notes.push(
      `fan-out traced ${fanoutEodhd} EODHD HTTP for ${users} users — expected ≈0 (shared snapshot). Check unusable hubs / request-path rebuild.`,
    );
  } else if (pass) {
    notes.push(`PASS: ${users} concurrent readers shared one fingerprint; fan-out EODHD HTTP=${fanoutEodhd}`);
  }

  return {
    at: new Date().toISOString(),
    segment: epoch.segment,
    marketMode: epoch.mode,
    users,
    warmTrace: warm.trace,
    fanoutTrace: fanout.trace,
    budgetBefore,
    budgetAfter: peekEodhdRequestWindow(),
    fingerprint,
    allUsersSharedSamePayload,
    pass,
    notes,
  };
}
