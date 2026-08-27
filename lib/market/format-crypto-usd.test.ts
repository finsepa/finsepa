import assert from "node:assert/strict";
import test from "node:test";

import {
  cryptoUsdFractionDigits,
  formatCryptoUsd,
  formatCryptoUsdAxis,
} from "./format-crypto-usd.ts";

test("XRP-scale prices keep 4 fraction digits", () => {
  assert.equal(cryptoUsdFractionDigits(1.4405), 4);
  assert.equal(formatCryptoUsd(1.4405), "$1.4405");
  assert.equal(formatCryptoUsdAxis(1.4405), "1.4405");
});

test("sub-dollar crypto keeps up to 6 digits", () => {
  assert.equal(cryptoUsdFractionDigits(0.123456), 6);
  assert.equal(formatCryptoUsd(0.123456), "$0.123456");
});

test("BTC-scale prices stay at 2 digits", () => {
  assert.equal(cryptoUsdFractionDigits(79319.99), 2);
  assert.equal(formatCryptoUsd(79319.99), "$79,319.99");
});
