import assert from "node:assert/strict";
import test from "node:test";

import {
  isStock1DLiveMinuteChartTicker,
  STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS,
} from "@/lib/market/stock-1d-live-minute-chart-tickers";

test("live 1D allowlist covers ~48 mega-caps + core ETFs (EODHD WS budget after crypto carve-out)", () => {
  assert.equal(STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS.length, 48);
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
    "MU",
    "LLY",
    "JPM",
    "WMT",
    "AMD",
    "V",
    "XOM",
    "JNJ",
    "ASML",
    "INTC",
    "UNH",
    "MA",
    "PG",
    "HD",
    "COST",
    "ABBV",
    "NFLX",
    "CRM",
    "BAC",
    "KO",
    "MRK",
    "ORCL",
    "PEP",
    "CVX",
    "TMO",
    "ACN",
    "CSCO",
    "MCD",
    "ADBE",
    "LIN",
    "DIS",
    "INTU",
    "QCOM",
    "TXN",
    "AMGN",
    "HON",
  ]);
  for (const t of STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS) {
    assert.equal(isStock1DLiveMinuteChartTicker(t), true);
  }
  assert.equal(isStock1DLiveMinuteChartTicker("MA"), true);
  assert.equal(isStock1DLiveMinuteChartTicker("GOOG"), false);
  assert.equal(isStock1DLiveMinuteChartTicker("SBUX"), false);
});
