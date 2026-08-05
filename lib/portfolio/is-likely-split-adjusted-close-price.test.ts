import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLikelyAsTradedCloseAfterSplit,
  isLikelySplitAdjustedClosePrice,
} from "./is-likely-split-adjusted-close-price.ts";

describe("split vs continuous price detection", () => {
  it("detects adjusted autofill", () => {
    assert.equal(isLikelySplitAdjustedClosePrice(84.826, 84.826, 848.26), true);
  });

  it("detects temporary as-traded heal to reverse", () => {
    assert.equal(isLikelyAsTradedCloseAfterSplit(848.26, 84.826, 848.26), true);
  });

  it("does not reverse continuous chart prices", () => {
    assert.equal(isLikelyAsTradedCloseAfterSplit(84.826, 84.826, 848.26), false);
  });
});
