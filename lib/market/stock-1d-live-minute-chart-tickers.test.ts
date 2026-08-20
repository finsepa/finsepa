import assert from "node:assert/strict";
import test from "node:test";

import {
  isStock1DLiveMinuteChartTicker,
  STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS,
} from "@/lib/market/stock-1d-live-minute-chart-tickers";

test("live 1D allowlist includes GOOGL and keeps AAPL/NVDA/SPY/QQQ", () => {
  assert.deepEqual([...STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS], [
    "NVDA",
    "AAPL",
    "GOOGL",
    "QQQ",
    "SPY",
  ]);
  for (const t of ["NVDA", "AAPL", "GOOGL", "QQQ", "SPY"]) {
    assert.equal(isStock1DLiveMinuteChartTicker(t), true);
  }
  assert.equal(isStock1DLiveMinuteChartTicker("MSFT"), false);
  assert.equal(isStock1DLiveMinuteChartTicker("GOOG"), false);
});
