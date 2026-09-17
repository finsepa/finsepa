import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";

test("crypto live 1D allowlist is top mcap coins within shared WS budget", () => {
  assert.equal(CRYPTO_LIVE_1D_DEFAULT_TICKERS.length, 28);
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
    "XLM",
    "SUI",
    "TON",
    "GRT",
    "UNI",
    "LTC",
    "AVAX",
    "HBAR",
    "ONDO",
    "NEAR",
    "SHIB",
    "APT",
    "CRO",
    "WLD",
  ]);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("WLD"), true);
  assert.equal(isCryptoLive1DSymbol("PEPE"), false);
  assert.equal(isCryptoLive1DSymbol("ALGO"), false);
  assert.equal(isCryptoLive1DSymbol("USDT"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});
