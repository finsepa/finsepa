/**
 * Run: npx tsx --test lib/screener/screener-crypto-payload-usability.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isEmptyScreenerMarketTabPayload,
  isUsableCryptoScreenerRows,
  isUsableScreenerMarketTabPayload,
  type CryptoTop10Row,
  type ScreenerPagePayload,
} from "./screener-page-payload-types.ts";

function row(partial: Partial<CryptoTop10Row> & Pick<CryptoTop10Row, "symbol">): CryptoTop10Row {
  return {
    name: partial.symbol,
    price: null,
    changePercent1D: null,
    changePercent1M: null,
    changePercentYTD: null,
    marketCap: "1B",
    sparkline5d: [],
    logoUrl: "",
    ...partial,
  };
}

test("isUsableCryptoScreenerRows rejects mostly-null prices", () => {
  const rows = [
    row({ symbol: "BTC", price: 1 }),
    row({ symbol: "ETH" }),
    row({ symbol: "XRP" }),
    row({ symbol: "BNB" }),
    row({ symbol: "SOL", price: 2 }),
    row({ symbol: "DOGE", price: 3 }),
    row({ symbol: "ADA" }),
    row({ symbol: "TRX" }),
    row({ symbol: "LINK" }),
    row({ symbol: "AVAX", price: 4 }),
  ];
  assert.equal(isUsableCryptoScreenerRows(rows), false);
});

test("isUsableCryptoScreenerRows accepts majority priced rows", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    row({ symbol: `C${i}`, price: i < 6 ? i + 1 : null }),
  );
  assert.equal(isUsableCryptoScreenerRows(rows), true);
});

test("sparse crypto payload is treated as empty for client bootstrap", () => {
  const payload: ScreenerPagePayload = {
    market: "crypto",
    cryptoRows: [row({ symbol: "BTC" }), row({ symbol: "ETH" })],
    cryptoTotalCount: 50,
    fearGreed: null,
    marketCacheSegment: "frozen-2026-08-21",
  };
  assert.equal(isEmptyScreenerMarketTabPayload(payload), true);
  assert.equal(isUsableScreenerMarketTabPayload(payload), false);
});
