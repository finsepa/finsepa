import assert from "node:assert/strict";
import test from "node:test";

import {
  isUsEquityExchangeHolidayYmd,
  usEquityExchangeHolidayYmdsForYear,
} from "@/lib/market/us-equity-exchange-holidays";
import {
  getUsEquityMarketSession,
  lastCompletedUsRegularSessionYmd,
  previousUsTradingSessionYmd,
  usEquitySessionBoundaryPullKind,
  usEquityTodayRegularSessionComplete,
} from "@/lib/market/us-equity-market-session";
import { usesStock1DLiveWsMinutePipeline } from "@/lib/market/stock-1d-live-minute-chart-tickers";

test("2026 US equity holidays include Labor Day and Good Friday", () => {
  const holidays = usEquityExchangeHolidayYmdsForYear(2026);
  assert.ok(holidays.includes("2026-09-07")); // Labor Day
  assert.ok(holidays.includes("2026-04-03")); // Good Friday
  assert.ok(holidays.includes("2026-01-01"));
  assert.ok(holidays.includes("2026-07-03")); // Independence Day observed (Sat Jul 4)
  assert.equal(isUsEquityExchangeHolidayYmd("2026-09-07"), true);
  assert.equal(isUsEquityExchangeHolidayYmd("2026-09-08"), false);
});

test("Labor Day 2026 regular clock is closed — no live 1D WS pipeline", () => {
  // 2026-09-07 15:00 ET = 19:00 UTC (EDT)
  const laborAfternoon = new Date("2026-09-07T19:00:00.000Z");
  assert.equal(getUsEquityMarketSession(laborAfternoon), "closed");
  assert.equal(usesStock1DLiveWsMinutePipeline("NVDA", laborAfternoon), false);
  assert.equal(usEquityTodayRegularSessionComplete(laborAfternoon), false);
  assert.equal(lastCompletedUsRegularSessionYmd(laborAfternoon), "2026-09-04");
  assert.equal(previousUsTradingSessionYmd("2026-09-07"), "2026-09-04");
});

test("Independence Day observed 2026 skips holiday in prior-session walk", () => {
  // Fri Jul 3 2026 is Independence Day observed; prior session is Jul 2.
  assert.equal(previousUsTradingSessionYmd("2026-07-06"), "2026-07-02");
});

test("normal Tuesday regular session still live for allowlist", () => {
  const tue = new Date("2026-09-08T15:00:00.000Z"); // 11:00 ET
  assert.equal(getUsEquityMarketSession(tue), "regular");
  assert.equal(usesStock1DLiveWsMinutePipeline("NVDA", tue), true);
});

test("IR vault pull is open+1 and close+1 ET, with DST twin UTC times", () => {
  // 2026-09-08 is EDT (UTC−4): 9:31 ET = 13:31 UTC, 16:01 ET = 20:01 UTC
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-08T13:31:00.000Z")), "open");
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-08T13:33:00.000Z")), "open");
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-08T20:01:00.000Z")), "close");
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-08T15:00:00.000Z")), null);
  // Off-season twin cron (14:31 UTC) is 10:31 ET in September — skip
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-08T14:31:00.000Z")), null);

  // 2026-01-12 is EST (UTC−5): 9:31 ET = 14:31 UTC, 16:01 ET = 21:01 UTC
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-01-12T14:31:00.000Z")), "open");
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-01-12T21:01:00.000Z")), "close");
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-01-12T13:31:00.000Z")), null);
});

test("IR vault pull skips weekends and full exchange holidays", () => {
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-07T13:31:00.000Z")), null); // Labor Day
  assert.equal(usEquitySessionBoundaryPullKind(new Date("2026-09-05T13:31:00.000Z")), null); // Saturday
});
