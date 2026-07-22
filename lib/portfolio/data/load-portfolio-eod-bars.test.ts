/**
 * Unit tests for Portfolio EOD bar cache key stability (no network).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PORTFOLIO_EOD_GRANULARITY,
  portfolioEodBarsCacheKey,
} from "./portfolio-eod-bars-cache-key.ts";

describe("portfolioEodBarsCacheKey", () => {
  it("is deterministic for identical inputs", () => {
    const a = portfolioEodBarsCacheKey({
      route: "equity",
      providerSymbol: "AAPL.US",
      fromYmd: "2025-01-01",
      toYmd: "2026-07-22",
      retry: false,
    });
    const b = portfolioEodBarsCacheKey({
      route: "equity",
      providerSymbol: "AAPL.US",
      fromYmd: "2025-01-01",
      toYmd: "2026-07-22",
      retry: false,
    });
    assert.equal(a, b);
    assert.match(a, new RegExp(PORTFOLIO_EOD_GRANULARITY));
  });

  it("separates retry modes so empty no-retry does not skip analytics retry", () => {
    const base = {
      route: "equity" as const,
      providerSymbol: "SPY.US",
      fromYmd: "2025-01-01",
      toYmd: "2026-07-22",
    };
    const r0 = portfolioEodBarsCacheKey({ ...base, retry: false });
    const r1 = portfolioEodBarsCacheKey({ ...base, retry: true });
    assert.notEqual(r0, r1);
    assert.match(r0, /\|r0\|/);
    assert.match(r1, /\|r1\|/);
  });

  it("separates equity vs crypto routes", () => {
    const equity = portfolioEodBarsCacheKey({
      route: "equity",
      providerSymbol: "BTC-USD.CC",
      fromYmd: "2025-01-01",
      toYmd: "2026-07-22",
      retry: false,
    });
    const crypto = portfolioEodBarsCacheKey({
      route: "crypto",
      providerSymbol: "BTC-USD.CC",
      fromYmd: "2025-01-01",
      toYmd: "2026-07-22",
      retry: false,
    });
    assert.notEqual(equity, crypto);
  });
});
