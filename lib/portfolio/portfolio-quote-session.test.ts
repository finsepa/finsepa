import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  portfolioQuoteSessionIsFresh,
  portfolioSliceHasSessionMarks,
  type PortfolioQuoteSessionPayload,
} from "./portfolio-quote-session.ts";

describe("portfolioQuoteSessionIsFresh", () => {
  it("requires matching ledger and TTL", () => {
    const session: PortfolioQuoteSessionPayload = {
      ledger: "abc",
      at: 1_000,
      prices: { AAPL: 100 },
    };
    assert.equal(portfolioQuoteSessionIsFresh(session, "abc", 1_000 + 60_000, 180_000), true);
    assert.equal(portfolioQuoteSessionIsFresh(session, "abc", 1_000 + 200_000, 180_000), false);
    assert.equal(portfolioQuoteSessionIsFresh(session, "other", 1_000 + 60_000, 180_000), false);
    assert.equal(portfolioQuoteSessionIsFresh(null, "abc", 1_000, 180_000), false);
  });
});

describe("portfolioSliceHasSessionMarks", () => {
  it("requires every holding symbol", () => {
    const slice = { p1: [{ symbol: "AAPL" }, { symbol: "MSFT" }] };
    assert.equal(portfolioSliceHasSessionMarks(slice, { AAPL: 1, MSFT: 2 }), true);
    assert.equal(portfolioSliceHasSessionMarks(slice, { AAPL: 1 }), false);
    assert.equal(portfolioSliceHasSessionMarks({ p1: [] }, {}), true);
  });
});
