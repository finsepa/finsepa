import assert from "node:assert/strict";
import test from "node:test";

import {
  isStock1DLiveMinuteChartTicker,
  STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS,
} from "@/lib/market/stock-1d-live-minute-chart-tickers";

test("live 1D allowlist includes next mega-caps by mcap + core ETFs", () => {
  assert.deepEqual([...STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS], [
    "NVDA",
    "AAPL",
    "GOOGL",
    "QQQ",
    "SPY",
    "MSFT",
    "AMZN",
    "TSM",
    "META",
    "AVGO",
    "TSLA",
    "BRK-B",
  ]);
  for (const t of STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS) {
    assert.equal(isStock1DLiveMinuteChartTicker(t), true);
  }
  assert.equal(isStock1DLiveMinuteChartTicker("LLY"), false);
  assert.equal(isStock1DLiveMinuteChartTicker("GOOG"), false);
});
