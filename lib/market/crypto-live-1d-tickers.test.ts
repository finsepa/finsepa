import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_BINANCE_LIVE_DEFAULT_BASES,
  CRYPTO_KRAKEN_LIVE_DEFAULT_BASES,
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  CRYPTO_OKX_LIVE_DEFAULT_BASES,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
  toBinanceUsdtBase,
  toKrakenPairMeta,
  toOkxInstId,
  usesBinanceLiveSpot,
  usesKrakenLiveSpot,
  usesOkxLiveSpot,
} from "@/lib/market/crypto-live-1d-tickers";

test("live-1D covers Binance TRADING USDT universe plus Finsepa-only names", () => {
  assert.ok(CRYPTO_LIVE_1D_DEFAULT_TICKERS.length > 500);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("JUP"), true);
  assert.equal(isCryptoLive1DSymbol("PEPE"), true);
  assert.equal(isCryptoLive1DSymbol("LEO"), true);
  assert.equal(isCryptoLive1DSymbol("XMR"), true);
  assert.equal(isCryptoLive1DSymbol("USDT"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});

test("Binance live bases are all TRADING USDT spot pairs", () => {
  assert.ok(CRYPTO_BINANCE_LIVE_DEFAULT_BASES.length >= 500);
  assert.ok(CRYPTO_BINANCE_LIVE_DEFAULT_BASES.includes("BTC"));
  assert.ok(CRYPTO_BINANCE_LIVE_DEFAULT_BASES.includes("JUP"));
  assert.ok(CRYPTO_BINANCE_LIVE_DEFAULT_BASES.includes("PEPE"));
  assert.ok(CRYPTO_BINANCE_LIVE_DEFAULT_BASES.includes("SKY"));
  assert.equal(usesBinanceLiveSpot("BTC"), true);
  assert.equal(usesBinanceLiveSpot("ADA"), true);
  assert.equal(usesBinanceLiveSpot("RNDR"), true);
  assert.equal(toBinanceUsdtBase("RNDR"), "RENDER");
  assert.equal(usesBinanceLiveSpot("MKR"), true);
  assert.equal(toBinanceUsdtBase("MKR"), "SKY");
  assert.equal(usesBinanceLiveSpot("LEO"), false);
  assert.equal(usesBinanceLiveSpot("XMR"), false);
  assert.equal(usesBinanceLiveSpot("USDT"), false);
});

test("Kraken covers curated Binance-gap USD names", () => {
  assert.deepEqual([...CRYPTO_KRAKEN_LIVE_DEFAULT_BASES], [
    "XMR",
    "TON",
    "MNT",
    "KAS",
    "LRC",
    "CRO",
    "FLR",
    "HNT",
  ]);
  for (const base of CRYPTO_KRAKEN_LIVE_DEFAULT_BASES) {
    assert.equal(usesKrakenLiveSpot(base), true, base);
    const meta = toKrakenPairMeta(base);
    assert.ok(meta?.restPair, base);
    assert.ok(meta?.wsSymbol?.includes("/"), base);
  }
  assert.equal(usesKrakenLiveSpot("BTC"), false);
  assert.equal(usesKrakenLiveSpot("LEO"), false);
});

test("OKX covers LEO", () => {
  assert.deepEqual([...CRYPTO_OKX_LIVE_DEFAULT_BASES], ["LEO"]);
  assert.equal(usesOkxLiveSpot("LEO"), true);
  assert.equal(toOkxInstId("LEO"), "LEO-USDT");
  assert.equal(usesOkxLiveSpot("XMR"), false);
});
