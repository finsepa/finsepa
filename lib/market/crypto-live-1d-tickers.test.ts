import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";

test("crypto live 1D allowlist includes top 15 by mcap (ex-stables)", () => {
  assert.deepEqual([...CRYPTO_LIVE_1D_DEFAULT_TICKERS], [
    "BTC",
    "ETH",
    "BNB",
    "XRP",
    "SOL",
    "TRX",
    "HYPE",
    "ZEC",
    "DOGE",
    "XMR",
    "LEO",
    "ADA",
    "BCH",
    "LINK",
    "TON",
  ]);
  assert.equal(CRYPTO_LIVE_1D_DEFAULT_TICKERS.length, 15);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("ETH"), true);
  assert.equal(isCryptoLive1DSymbol("ETH-USD.CC"), true);
  assert.equal(isCryptoLive1DSymbol("XRP"), true);
  assert.equal(isCryptoLive1DSymbol("BNB-USD"), true);
  assert.equal(isCryptoLive1DSymbol("SOL"), true);
  assert.equal(isCryptoLive1DSymbol("DOGE"), true);
  assert.equal(isCryptoLive1DSymbol("TON"), true);
  assert.equal(isCryptoLive1DSymbol("USDT"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});
