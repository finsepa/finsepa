import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultSuperinvestorFollowPaths } from "./default-superinvestor-follows.ts";

describe("defaultSuperinvestorFollowPaths", () => {
  it("matches iOS defaults: Bill Ackman and Warren Buffett", () => {
    assert.deepEqual(defaultSuperinvestorFollowPaths(), [
      "/superinvestors/bill-ackman",
      "/superinvestors/berkshire-hathaway",
    ]);
  });
});
