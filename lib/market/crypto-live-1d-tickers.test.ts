import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";

test("crypto live 1D allowlist covers screener page-1 non-stables", () => {
  assert.equal(CRYPTO_LIVE_1D_DEFAULT_TICKERS.length, 47);
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
    "MNT",
    "POL",
    "DOT",
    "FTM",
    "JUP",
    "ARB",
    "STRK",
    "PEPE",
    "OP",
    "ICP",
    "IMX",
    "PYTH",
    "MKR",
    "ETC",
    "AAVE",
    "ATOM",
    "RNDR",
    "STX",
    "ALGO",
  ]);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("ETH-USD.CC"), true);
  assert.equal(isCryptoLive1DSymbol("SHIB"), true);
  assert.equal(isCryptoLive1DSymbol("ALGO"), true);
  assert.equal(isCryptoLive1DSymbol("USDT"), false);
  assert.equal(isCryptoLive1DSymbol("DAI"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});
