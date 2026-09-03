import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionMarkUsd } from "./session-mark-price.ts";

describe("sessionMarkUsd", () => {
  it("drops pre-split hourly prints when they diverge from adjusted EOD (NFLX 10:1)", () => {
    assert.equal(sessionMarkUsd(700.12, 70.01), 70.01);
  });

  it("keeps same-session intraday when it agrees with adjusted EOD", () => {
    assert.equal(sessionMarkUsd(90.4, 90.1), 90.4);
  });

  it("uses adjusted EOD when hourly is missing", () => {
    assert.equal(sessionMarkUsd(null, 90.1), 90.1);
  });

  it("uses hourly when EOD is missing", () => {
    assert.equal(sessionMarkUsd(90.4, null), 90.4);
  });

  it("treats a reverse-split gap the same way", () => {
    assert.equal(sessionMarkUsd(12, 120), 120);
  });
});
