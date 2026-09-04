/**
 * Run: npx tsx --test lib/market/merge-crypto-quotes.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { mergeCryptoQuoteMaps, type CryptoQuoteDatum } from "./merge-crypto-quotes.ts";

const priced = (price: number): CryptoQuoteDatum => ({
  price,
  previousClose: price,
  changePercent1D: 0.1,
});

const empty: CryptoQuoteDatum = { price: null, previousClose: null, changePercent1D: null };

test("mergeCryptoQuoteMaps keeps tab prices when page2 stubs are null", () => {
  const tab = { USDT: priced(0.9998), BTC: priced(80000) };
  const page2 = { USDT: empty, USDC: empty, SUI: priced(1.2) };
  const merged = mergeCryptoQuoteMaps(tab, page2);
  assert.equal(merged.USDT?.price, 0.9998);
  assert.equal(merged.BTC?.price, 80000);
  assert.equal(merged.SUI?.price, 1.2);
  assert.equal(merged.USDC?.price, null);
});

test("mergeCryptoQuoteMaps prefers page2 when it has a real price", () => {
  const tab = { SUI: priced(1.0) };
  const page2 = { SUI: priced(1.25) };
  const merged = mergeCryptoQuoteMaps(tab, page2);
  assert.equal(merged.SUI?.price, 1.25);
});
