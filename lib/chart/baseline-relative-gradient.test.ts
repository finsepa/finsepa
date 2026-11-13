import assert from "node:assert/strict";
import test from "node:test";

import { baselineRelativeGradientEnabled } from "./baseline-relative-gradient.ts";

const pts = (...values: number[]) => values.map((value) => ({ value }));

test("base inside the data range enables the relative gradient", () => {
  assert.equal(baselineRelativeGradientEnabled(pts(149, 160, 167), 155), true);
  assert.equal(baselineRelativeGradientEnabled(pts(149, 160, 167), 149), true);
});

test("base above or below every point (1D prior close) disables it", () => {
  assert.equal(baselineRelativeGradientEnabled(pts(149, 160, 167), 173.73), false);
  assert.equal(baselineRelativeGradientEnabled(pts(149, 160, 167), 140), false);
});

test("flat or empty data disables it", () => {
  assert.equal(baselineRelativeGradientEnabled(pts(5, 5, 5), 5), false);
  assert.equal(baselineRelativeGradientEnabled([], 5), false);
  assert.equal(baselineRelativeGradientEnabled(pts(1, 2), Number.NaN), false);
});
