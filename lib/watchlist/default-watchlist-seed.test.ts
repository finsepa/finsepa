import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDefaultWatchlistSectionLayout,
  DEFAULT_WATCHLIST_SEED_ITEMS,
  defaultWatchlistSeedTickers,
} from "./default-watchlist-seed.ts";

describe("defaultWatchlistSeed", () => {
  it("seeds BTC + JPM + AAPL + MSFT across CRYPTO / FINANCE / TECH", () => {
    const layout = buildDefaultWatchlistSectionLayout();
    assert.deepEqual(
      layout.sections.map((s) => s.name),
      ["CRYPTO", "FINANCE", "TECH"],
    );
    assert.deepEqual(defaultWatchlistSeedTickers(), ["CRYPTO:BTC", "JPM", "AAPL", "MSFT"]);
    for (const item of DEFAULT_WATCHLIST_SEED_ITEMS) {
      assert.equal(layout.tickerSections[item.ticker], item.sectionId);
    }
  });
});
