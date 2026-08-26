import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultSuperinvestorFollowPaths } from "./default-superinvestor-follows.ts";

describe("defaultSuperinvestorFollowPaths", () => {
  it("includes Warren Buffett and Terry Smith profile paths", () => {
    assert.deepEqual(defaultSuperinvestorFollowPaths(), [
      "/superinvestors/berkshire-hathaway",
      "/superinvestors/terry-smith",
    ]);
  });
});
