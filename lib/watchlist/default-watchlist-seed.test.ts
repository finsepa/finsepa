import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDefaultWatchlistSectionLayout, defaultWatchlistSeedTickers } from "./default-watchlist-seed.ts";

describe("defaultWatchlistSeed", () => {
  it("seeds BTC + JPM + AAPL + MSFT with no sections", () => {
    assert.deepEqual(defaultWatchlistSeedTickers(), ["CRYPTO:BTC", "JPM", "AAPL", "MSFT"]);
    const layout = buildDefaultWatchlistSectionLayout();
    assert.deepEqual(layout.sections, []);
    assert.deepEqual(layout.tickerSections, {});
  });
});
