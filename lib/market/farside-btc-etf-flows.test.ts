import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFarsideBtcEtfFlowTotals } from "./farside-btc-etf-flows-parse.ts";

describe("parseFarsideBtcEtfFlowTotals", () => {
  it("parses markdown pipe tables with paren outflows", () => {
    const raw = `
| Date | IBIT | FBTC | Total |
| --- | --- | --- | --- |
| 11 Jan 2024 | 111.7 | 227.0 | 655.3 |
| 16 Jan 2024 | 212.7 | 102.0 | (52.7) |
| 22 Jul 2026 | 38.8 | 21.5 | 69.1 |
`;
    const points = parseFarsideBtcEtfFlowTotals(raw);
    assert.equal(points.length, 3);
    assert.deepEqual(points[0], { time: "2024-01-11", value: 655.3e6 });
    assert.deepEqual(points[1], { time: "2024-01-16", value: -52.7e6 });
    assert.deepEqual(points[2], { time: "2026-07-22", value: 69.1e6 });
  });

  it("parses line-oriented Jina-style cells", () => {
    const raw = `
11 Jan 2024
111.7
227.0
237.9
65.3
17.4
50.1
29.4
10.6
1.0
-
(95.1)
-
655.3
16 Jan 2024
212.7
102.0
50.2
122.3
31.9
0.0
15.3
7.3
0.0
-
(594.4)
-
(52.7)
`;
    const points = parseFarsideBtcEtfFlowTotals(raw);
    assert.equal(points.length, 2);
    assert.equal(points[0]!.time, "2024-01-11");
    assert.equal(points[0]!.value, 655.3e6);
    assert.equal(points[1]!.time, "2024-01-16");
    assert.equal(points[1]!.value, -52.7e6);
  });

  it("rejects Cloudflare challenge pages", () => {
    assert.deepEqual(parseFarsideBtcEtfFlowTotals("<html>Just a moment...</html>"), []);
  });
});
