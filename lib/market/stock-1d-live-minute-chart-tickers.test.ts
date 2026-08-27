import assert from "node:assert/strict";
import test from "node:test";

import {
  isStock1DLiveMinuteChartTicker,
  STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS,
} from "@/lib/market/stock-1d-live-minute-chart-tickers";

test("live 1D allowlist includes MSFT/AMZN and keeps core mega-caps + ETFs", () => {
  assert.deepEqual([...STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS], [
    "NVDA",
    "AAPL",
    "GOOGL",
    "QQQ",
    "SPY",
    "MSFT",
    "AMZN",
  ]);
  for (const t of ["NVDA", "AAPL", "GOOGL", "QQQ", "SPY", "MSFT", "AMZN"]) {
    assert.equal(isStock1DLiveMinuteChartTicker(t), true);
  }
  assert.equal(isStock1DLiveMinuteChartTicker("META"), false);
  assert.equal(isStock1DLiveMinuteChartTicker("GOOG"), false);
});
