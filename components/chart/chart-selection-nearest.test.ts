import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nearestPointByChartX, nearestPointByTime } from "./chart-selection-nearest.ts";

describe("nearestPointByTime", () => {
  it("picks the closer of two surrounding bars", () => {
    const points = [
      { time: 100, value: 1 },
      { time: 200, value: 2 },
      { time: 400, value: 3 },
    ];
    assert.equal(nearestPointByTime(points, 140)?.time, 100);
    assert.equal(nearestPointByTime(points, 310)?.time, 400);
  });
});

describe("nearestPointByChartX", () => {
  it("picks the nearest bar by pixel when the pointer is between sparse points", () => {
    const points = [
      { time: 100, value: 1 },
      { time: 400, value: 3 },
    ];
    const timeToX = (time: number) => {
      if (time === 100) return 10;
      if (time === 400) return 90;
      return null;
    };
    assert.equal(nearestPointByChartX(points, 80, timeToX)?.time, 400);
    assert.equal(nearestPointByChartX(points, 12, timeToX)?.time, 100);
  });
});
