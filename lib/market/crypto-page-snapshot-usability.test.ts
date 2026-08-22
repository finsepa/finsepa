/**
 * Run: npx tsx --test lib/market/crypto-page-snapshot-usability.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { isUsableCryptoPageSnapshot } from "./crypto-page-snapshot-usability.ts";

test("isUsableCryptoPageSnapshot rejects chart-only rows without price", () => {
  assert.equal(
    isUsableCryptoPageSnapshot({
      routeSymbol: "XRP",
      asset: null,
      chart: { range: "1Y", points: [{ date: "2026-01-01", value: 1 }] },
      sessionChart: { range: "1D", points: [] },
      performance: {
        ticker: "XRP",
        price: null,
        d1: null,
        d5: null,
        d7: null,
        m1: null,
        m6: null,
        ytd: null,
        y1: null,
        y5: null,
        y10: null,
        all: null,
        annualReturns: [],
      },
      news: [],
    }),
    false,
  );
});

test("isUsableCryptoPageSnapshot accepts asset or performance price", () => {
  const base = {
    routeSymbol: "XRP",
    chart: { range: "1Y" as const, points: [] },
    sessionChart: { range: "1D" as const, points: [] },
    performance: {
      ticker: "XRP",
      price: null,
      d1: null,
      d5: null,
      d7: null,
      m1: null,
      m6: null,
      ytd: null,
      y1: null,
      y5: null,
      y10: null,
      all: null,
      annualReturns: [],
    },
    news: [],
  };

  assert.equal(
    isUsableCryptoPageSnapshot({
      ...base,
      asset: {
        symbol: "XRP",
        name: "XRP",
        price: 1.45,
        changePercent1D: null,
        changePercent1M: null,
        changePercentYTD: null,
        marketCap: "100B",
        fullyDilutedMarketCap: "-",
        athMarketCap: "-",
        totalSupply: "-",
        circulatingSupply: "-",
        maxSupply: "-",
        volume24h: "-",
        volumeToMarketCap24h: "-",
        sparkline5d: [],
        logoUrl: "",
        links: {
          website: null,
          whitepaper: null,
          github: null,
          twitter: null,
          reddit: null,
          telegram: null,
          discord: null,
          explorers: [],
          wallets: [],
        },
      },
    }),
    true,
  );

  assert.equal(
    isUsableCryptoPageSnapshot({
      ...base,
      asset: null,
      performance: { ...base.performance, price: 1.45 },
    }),
    true,
  );
});
