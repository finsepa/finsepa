/**
 * Run: npx tsx --test lib/screener/crypto-screener-mcap-sort.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { CryptoMeta } from "@/lib/market/crypto-meta";
import { sortCryptoMetasByMarketCap } from "@/lib/screener/crypto-mcap-sort";

const meta = (symbol: string): CryptoMeta => ({
  symbol,
  name: symbol,
  eodhdSymbol: `${symbol}-USD.CC`,
});

test("sortCryptoMetasByMarketCap orders by derived mcap descending", () => {
  const metas = [meta("XRP"), meta("BNB"), meta("BTC")];
  const derived = {
    BTC: { marketCapUsd: 1e12 },
    BNB: { marketCapUsd: 90e9 },
    XRP: { marketCapUsd: 80e9 },
  };
  assert.deepEqual(
    sortCryptoMetasByMarketCap(metas, derived).map((m) => m.symbol),
    ["BTC", "BNB", "XRP"],
  );
});

test("sortCryptoMetasByMarketCap puts missing mcap last", () => {
  const metas = [meta("ZZZ"), meta("BTC")];
  const derived = {
    BTC: { marketCapUsd: 1e12 },
  };
  assert.deepEqual(
    sortCryptoMetasByMarketCap(metas, derived).map((m) => m.symbol),
    ["BTC", "ZZZ"],
  );
});
