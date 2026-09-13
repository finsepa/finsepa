/**
 * Run: npx tsx --test lib/screener/screener-market-tab-segment-hint.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { screenerMarketTabSegmentHint } from "./screener-market-tab-segment-hint";
import type { ScreenerPagePayload } from "./screener-page-payload-types";

const stocksPayload = {
  market: "stocks",
  stockRows: [],
  stocksTotalCount: 0,
  stocksSectorFilter: null,
  stocksIndustryFilter: null,
  indexCards: [],
  companiesMarketCacheSegment: "live-2026-09-13-10",
} satisfies ScreenerPagePayload;

const cryptoPayload = {
  market: "crypto",
  cryptoRows: [],
  cryptoTotalCount: 0,
  cryptoMoverRows: [],
  fearGreed: null,
  marketCacheSegment: "live-2026-09-13-10",
} satisfies ScreenerPagePayload;

const currenciesPayload = {
  market: "currencies",
  currenciesRows: [],
  marketCacheSegment: "slow-live-2026-09-13",
} satisfies ScreenerPagePayload;

test("hot markets share segment hints across stocks/crypto", () => {
  assert.equal(screenerMarketTabSegmentHint("crypto", stocksPayload), "live-2026-09-13-10");
  assert.equal(screenerMarketTabSegmentHint("stocks", cryptoPayload), "live-2026-09-13-10");
});

test("currencies only reuse currencies slow segment", () => {
  assert.equal(screenerMarketTabSegmentHint("currencies", stocksPayload), "");
  assert.equal(screenerMarketTabSegmentHint("stocks", currenciesPayload), "");
  assert.equal(screenerMarketTabSegmentHint("currencies", currenciesPayload), "slow-live-2026-09-13");
});
