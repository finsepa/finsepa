import assert from "node:assert/strict";
import test from "node:test";

import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import {
  stockPageSsrHas1DChartSeed,
  stockPageSsrHasFundamentalsAnnualSeed,
  stockPageSsrHasKeyStatsBundleSeed,
  stockPageSsrHasLiveSpotSeed,
  stockPageSsrHasNewsOverviewSeed,
  stockPageSsrHasPerformanceSeed,
} from "@/lib/market/stock-page-ssr-live-seed";

function shell(ticker: string): StockPageInitialData {
  return {
    ticker,
    isEtf: false,
    headerMeta: {} as StockPageInitialData["headerMeta"],
    chart: { range: "1D", points: [{ time: 1, value: 100 }, { time: 2, value: 101 }] },
    performance: { ticker, price: 150, d1: 1, d5: null, d7: null, m1: null, m6: null, ytd: null, y1: null, y5: null, y10: null, all: null, annualReturns: [] },
    keyStatsBundle: { basic: [{ label: "Market Cap", value: "$1T" }], valuation: null, revenueProfit: null, margins: null, growth: null, assetsLiabilities: null, returns: null, dividends: null, risk: null },
    keyIndicators: null,
    news: [{ id: "1", title: "News", source: "X", publishedAt: "2026-01-01", summary: "", url: "https://x", tags: [] }],
    profile: null,
    fundamentalsSeriesAnnual: [{ periodEnd: "2025-12-31", revenue: 1 }],
    fundamentalsSeriesQuarterly: [],
    fundamentalsTtmPoint: null,
    peersCompareRows: [],
    headerLiveSpotUsd: 150,
    headerPriorCloseUsd: 149,
    liveRegularSessionActive: true,
    earningsTabPayload: null,
  };
}

test("SSR seed helpers match ticker and payload shape", () => {
  const data = shell("AAPL");
  assert.equal(stockPageSsrHasLiveSpotSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHas1DChartSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHasPerformanceSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHasKeyStatsBundleSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHasNewsOverviewSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHasFundamentalsAnnualSeed(data, "AAPL"), true);
  assert.equal(stockPageSsrHasLiveSpotSeed(data, "MSFT"), false);
});
