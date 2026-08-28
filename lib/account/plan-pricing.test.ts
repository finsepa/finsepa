import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLE_PRO_ANNUAL_USD,
  APPLE_PRO_MONTHLY_USD,
  PRO_ANNUAL_USD,
  PRO_MONTHLY_USD,
  appleProPriceForCycle,
  displayAppleBilledUsd,
  looksLikeStripeWebProPrice,
  proPriceForCycle,
  remapStripeListPriceToAppleUsd,
} from "./plan-pricing.ts";

describe("plan-pricing", () => {
  it("uses unified list prices on web and Apple", () => {
    assert.equal(PRO_MONTHLY_USD, 12.99);
    assert.equal(PRO_ANNUAL_USD, 129);
    assert.equal(APPLE_PRO_MONTHLY_USD, PRO_MONTHLY_USD);
    assert.equal(APPLE_PRO_ANNUAL_USD, PRO_ANNUAL_USD);
    assert.equal(proPriceForCycle("monthly"), 12.99);
    assert.equal(proPriceForCycle("annually"), 129);
    assert.equal(appleProPriceForCycle("monthly"), 12.99);
    assert.equal(appleProPriceForCycle("annually"), 129);
  });

  it("remaps legacy stale Apple rows that stored old Stripe list prices", () => {
    assert.equal(remapStripeListPriceToAppleUsd(15), 17.99);
    assert.equal(remapStripeListPriceToAppleUsd(150), 179.99);
    assert.equal(remapStripeListPriceToAppleUsd(12.99), 12.99);
    assert.equal(remapStripeListPriceToAppleUsd(129), 129);
    assert.equal(remapStripeListPriceToAppleUsd(17.99), 17.99);
  });

  it("displayAppleBilledUsd prefers stored grandfathered amounts", () => {
    assert.equal(displayAppleBilledUsd(17.99, 12.99), 17.99);
    assert.equal(displayAppleBilledUsd(15, 12.99), 15);
    assert.equal(displayAppleBilledUsd(12.99, 12.99), 12.99);
    assert.equal(displayAppleBilledUsd(0, 12.99), 12.99);
  });

  it("looksLikeStripeWebProPrice matches current list prices only", () => {
    assert.equal(looksLikeStripeWebProPrice(12.99), true);
    assert.equal(looksLikeStripeWebProPrice(129), true);
    assert.equal(looksLikeStripeWebProPrice(15), false);
    assert.equal(looksLikeStripeWebProPrice(17.99), false);
  });
});
