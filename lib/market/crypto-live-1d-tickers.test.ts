import assert from "node:assert/strict";
import test from "node:test";

import {
  CRYPTO_LIVE_1D_DEFAULT_TICKERS,
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";

test("crypto live 1D allowlist includes BTC and ETH", () => {
  assert.deepEqual([...CRYPTO_LIVE_1D_DEFAULT_TICKERS], ["BTC", "ETH"]);
  assert.equal(isCryptoLive1DSymbol("BTC"), true);
  assert.equal(isCryptoLive1DSymbol("ETH"), true);
  assert.equal(isCryptoLive1DSymbol("ETH-USD.CC"), true);
  assert.equal(isCryptoLive1DSymbol("SOL"), false);
  assert.equal(normalizeCryptoBaseSymbol("eth-usd"), "ETH");
});
