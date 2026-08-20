import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeRealtimeSymbols,
  pickRealtimePayloadFromMap,
} from "./eodhd-realtime-payload.ts";

type Payload = { code?: string; close?: number };

function payload(code: string, close: number): Payload {
  return { code, close };
}

describe("pickRealtimePayloadFromMap", () => {
  it("matches qualified symbol, then bare code", () => {
    const map = new Map<string, Payload>([["AAPL", payload("AAPL", 190)]]);
    const hit = pickRealtimePayloadFromMap(map, "AAPL.US");
    assert.equal(hit?.close, 190);
  });

  it("matches exact qualified key", () => {
    const map = new Map<string, Payload>([["AAPL.US", payload("AAPL.US", 191)]]);
    const hit = pickRealtimePayloadFromMap(map, "AAPL.US");
    assert.equal(hit?.close, 191);
  });

  it("returns null when absent", () => {
    const map = new Map<string, Payload>();
    assert.equal(pickRealtimePayloadFromMap(map, "MSFT.US"), null);
  });
});

describe("normalizeRealtimeSymbols", () => {
  it("uppercases, trims, and dedupes", () => {
    assert.deepEqual(normalizeRealtimeSymbols([" aapl.us ", "AAPL.US", "MSFT.US"]), [
      "AAPL.US",
      "MSFT.US",
    ]);
  });
});
