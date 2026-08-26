import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { portfolioDividendIncome } from "./portfolio-dividend-income.ts";

describe("portfolioDividendIncome", () => {
  it("dilutes yield by non-paying holdings (portfolio-level, not payer-only average)", () => {
    const holdings = [
      { symbol: "KO", currentValue: 50_000 },
      { symbol: "BTC-USD", currentValue: 50_000 },
    ];
    const { annualUsd, yieldPct } = portfolioDividendIncome(holdings, { KO: 1.5 });
    assert.ok(annualUsd != null);
    assert.ok(yieldPct != null);
    // $50k × 1.5% = $750 annual; / $100k equity = 0.75% portfolio yield
    assert.ok(Math.abs(annualUsd! - 750) < 1e-6);
    assert.ok(Math.abs(yieldPct! - 0.75) < 1e-6);
  });

  it("does not inflate yield by excluding non-payers from the denominator", () => {
    const holdings = [
      { symbol: "AAPL", currentValue: 25_000 },
      { symbol: "ETH-USD", currentValue: 75_000 },
    ];
    const { yieldPct } = portfolioDividendIncome(holdings, { AAPL: 0.4 });
    // Payer-only average would be 0.4%; portfolio yield is 0.1%.
    assert.ok(yieldPct != null);
    assert.ok(Math.abs(yieldPct! - 0.1) < 1e-6);
  });

  it("returns null when no yield data", () => {
    const out = portfolioDividendIncome([{ symbol: "BTC-USD", currentValue: 10_000 }], {});
    assert.equal(out.annualUsd, null);
    assert.equal(out.yieldPct, null);
  });
});
