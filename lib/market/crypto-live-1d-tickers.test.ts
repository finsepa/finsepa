import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";

test("crypto live 1D allowlist includes BTC/ETH/XRP/BNB/SOL", () => {
  assert.deepEqual([...CRYPTO_LIVE_1D_DEFAULT_TICKERS], ["BTC", "ETH", "XRP", "BNB", "SOL"]);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("ETH"), true);
  assert.equal(isCryptoLive1DSymbol("ETH-USD.CC"), true);
  assert.equal(isCryptoLive1DSymbol("XRP"), true);
  assert.equal(isCryptoLive1DSymbol("BNB-USD"), true);
  assert.equal(isCryptoLive1DSymbol("SOL"), true);
  assert.equal(isCryptoLive1DSymbol("DOGE"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});
