import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchesBrokerage,
  resolveBrokerageLogoStyleFromMeta,
} from "@/lib/snaptrade/brokerage-logo-style";

describe("brokerage logo style", () => {
  it("matches eToro / Alpaca / Binance by slug or name", () => {
    assert.equal(matchesBrokerage("ETORO", "eToro", "ETORO"), true);
    assert.equal(matchesBrokerage(null, "eToro", "ETORO"), true);
    assert.equal(matchesBrokerage("ALPACA-PAPER", "Alpaca Paper", "ALPACA"), true);
    assert.equal(matchesBrokerage("BINANCE", "Binance", "BINANCE"), true);
    assert.equal(matchesBrokerage("ROBINHOOD", "Robinhood", "ETORO"), false);
  });

  it("returns brand plate styles for known brokers", () => {
    const etoro = resolveBrokerageLogoStyleFromMeta("ETORO", "eToro");
    assert.deepEqual(etoro, {
      kind: "markOnBrandBackdrop",
      backdrop: "#6AA621",
      tint: "#FFFFFF",
    });

    const alpaca = resolveBrokerageLogoStyleFromMeta("ALPACA-PAPER", "Alpaca Paper");
    assert.deepEqual(alpaca, { kind: "markOnBrandPlate", backdrop: "#FFD200" });

    assert.equal(resolveBrokerageLogoStyleFromMeta("ROBINHOOD", "Robinhood"), null);
  });
});
