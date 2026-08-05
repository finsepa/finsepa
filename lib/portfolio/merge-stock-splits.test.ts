import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PortfolioTransaction } from "../../components/portfolio/portfolio-types.ts";
import {
  buildMissingSplitTransactions,
  previousCalendarDayYmd,
  stockSplitEventsFromEodhdRows,
} from "./merge-stock-splits.ts";
import { parseEodhdSplitRatioLabel } from "../market/parse-eodhd-split-ratio.ts";
import { replayTradeTransactionsToHoldings } from "./rebuild-holdings-from-trades.ts";

function tx(
  partial: Partial<PortfolioTransaction> & Pick<PortfolioTransaction, "id" | "operation" | "date">,
): PortfolioTransaction {
  return {
    portfolioId: "p1",
    kind: partial.kind ?? "trade",
    symbol: partial.symbol ?? "NFLX",
    name: partial.name ?? partial.symbol ?? "NFLX",
    logoUrl: null,
    shares: partial.shares ?? 0,
    price: partial.price ?? 0,
    fee: partial.fee ?? 0,
    sum: partial.sum ?? 0,
    profitPct: null,
    profitUsd: null,
    ...partial,
  };
}

describe("parseEodhdSplitRatioLabel", () => {
  it("parses forward and reverse labels", () => {
    assert.equal(parseEodhdSplitRatioLabel("10/1"), 10);
    assert.equal(parseEodhdSplitRatioLabel("2:1"), 2);
    assert.equal(parseEodhdSplitRatioLabel("1/10"), 0.1);
    assert.equal(parseEodhdSplitRatioLabel("1"), null);
  });
});

describe("buildMissingSplitTransactions", () => {
  it("inserts split and multiplies shares / divides avg cost", () => {
    const buys = [
      tx({
        id: "c",
        kind: "cash",
        operation: "Cash In",
        date: "2023-01-01",
        shares: 10_000,
        price: 1,
        sum: 10_000,
        symbol: "USD",
        name: "USD",
      }),
      tx({
        id: "b1",
        operation: "Buy",
        date: "2023-03-01",
        symbol: "NFLX",
        name: "Netflix",
        shares: 10,
        price: 300,
        sum: -3000,
        sequence: 1,
      }),
    ];

    const missing = buildMissingSplitTransactions({
      portfolioId: "p1",
      transactions: buys,
      events: [{ symbol: "NFLX", date: "2024-07-15", ratio: 10, name: "Netflix" }],
    });
    assert.equal(missing.length, 1);
    assert.equal(missing[0]!.operation, "Split");
    assert.equal(missing[0]!.price, 10);

    const holdings = replayTradeTransactionsToHoldings([...buys, ...missing]);
    const nflx = holdings.find((h) => h.symbol === "NFLX");
    assert.ok(nflx);
    assert.equal(nflx!.shares, 100);
    assert.ok(Math.abs(nflx!.avgPrice - 30) < 1e-6);
    assert.ok(Math.abs(nflx!.costBasis - 3000) < 1e-6);
  });

  it("is idempotent when split already present", () => {
    const base = [
      tx({
        id: "b1",
        operation: "Buy",
        date: "2023-03-01",
        shares: 10,
        price: 300,
        sum: -3000,
      }),
      tx({
        id: "s1",
        operation: "Split",
        date: "2024-07-15",
        shares: 0,
        price: 10,
        sum: 0,
      }),
    ];
    const missing = buildMissingSplitTransactions({
      portfolioId: "p1",
      transactions: base,
      events: [{ symbol: "NFLX", date: "2024-07-15", ratio: 10 }],
    });
    assert.equal(missing.length, 0);
  });

  it("skips when no open position before the split", () => {
    const sold = [
      tx({ id: "b1", operation: "Buy", date: "2023-03-01", shares: 10, price: 300, sum: -3000 }),
      tx({ id: "s1", operation: "Sell", date: "2023-06-01", shares: 10, price: 310, sum: 3100 }),
    ];
    const missing = buildMissingSplitTransactions({
      portfolioId: "p1",
      transactions: sold,
      events: [{ symbol: "NFLX", date: "2024-07-15", ratio: 10 }],
    });
    assert.equal(missing.length, 0);
  });

  it("maps EODHD rows", () => {
    const events = stockSplitEventsFromEodhdRows("COST", [{ date: "2024-06-01", split: "2/1" }]);
    assert.deepEqual(events, [{ symbol: "COST", date: "2024-06-01", ratio: 2 }]);
  });

  it("previous day helper", () => {
    assert.equal(previousCalendarDayYmd("2024-01-01"), "2023-12-31");
  });
});
