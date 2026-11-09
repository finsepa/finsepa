import assert from "node:assert/strict";
import test from "node:test";

import {
  cryptoLiveQuotesFromPayload,
  cryptoLiveQuotesToPayload,
  cryptoUtcDayChangePct,
  findCryptoLiveQuote,
  overlayCryptoLiveQuote,
  type CryptoLiveQuote,
} from "./crypto-live-quotes-shared.ts";

const QUOTES: Record<string, CryptoLiveQuote> = {
  BTC: { price: 110, utcOpen: 100, source: "binance" },
  XMR: { price: 600, utcOpen: null, source: "kraken" },
};

test("1D % is vs the UTC-day open and null without one", () => {
  assert.equal(cryptoUtcDayChangePct(110, 100), 10);
  assert.equal(cryptoUtcDayChangePct(110, null), null);
  assert.equal(cryptoUtcDayChangePct(0, 100), null);
});

test("finds quotes for every crypto symbol form", () => {
  for (const sym of ["BTC", "btc", "BTC-USD", "BTC.CC", "crypto:BTC", "CRYPTO:BTC"]) {
    assert.equal(findCryptoLiveQuote(QUOTES, sym)?.price, 110, sym);
  }
  assert.equal(findCryptoLiveQuote(QUOTES, "ETH"), null);
  assert.equal(findCryptoLiveQuote(null, "BTC"), null);
});

test("overlay replaces price and 1D %, keeps row pct when the open is unknown", () => {
  const row = { symbol: "BTC", price: 90 as number | null, pct1d: 1 as number | null };
  assert.deepEqual(overlayCryptoLiveQuote(row, QUOTES.BTC!, "pct1d"), { symbol: "BTC", price: 110, pct1d: 10 });
  assert.deepEqual(overlayCryptoLiveQuote({ ...row, symbol: "XMR" }, QUOTES.XMR!, "pct1d"), {
    symbol: "XMR",
    price: 600,
    pct1d: 1,
  });
  assert.equal(overlayCryptoLiveQuote(row, null, "pct1d"), row);
});

test("payload round-trips and drops non-positive prices", () => {
  const payload = cryptoLiveQuotesToPayload(QUOTES, 1);
  assert.deepEqual(cryptoLiveQuotesFromPayload(payload), QUOTES);
  const bad = { asOfSec: 1, quotes: { ZZZ: { p: 0, o: 1, s: "okx" as const } } };
  assert.deepEqual(cryptoLiveQuotesFromPayload(bad), {});
});
