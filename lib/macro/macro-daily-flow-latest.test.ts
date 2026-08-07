import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { indexOfLatestMeaningfulDailyFlow } from "./macro-chart-points.ts";

describe("indexOfLatestMeaningfulDailyFlow", () => {
  it("skips trailing zero tip days", () => {
    const points = [
      { time: "2026-08-05", value: 50e6 },
      { time: "2026-08-06", value: 137.6e6 },
      { time: "2026-08-07", value: 0 },
    ];
    assert.equal(indexOfLatestMeaningfulDailyFlow(points), 1);
  });

  it("keeps a non-zero tip", () => {
    const points = [
      { time: "2026-08-06", value: 137.6e6 },
      { time: "2026-08-07", value: 12e6 },
    ];
    assert.equal(indexOfLatestMeaningfulDailyFlow(points), 1);
  });

  it("returns -1 when every point is zero", () => {
    assert.equal(
      indexOfLatestMeaningfulDailyFlow([
        { time: "2026-08-06", value: 0 },
        { time: "2026-08-07", value: 0 },
      ]),
      -1,
    );
  });
});
