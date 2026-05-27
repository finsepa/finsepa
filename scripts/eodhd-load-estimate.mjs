#!/usr/bin/env node
/**
 * P6 — print analytical daily EODHD estimates (no HTTP / no API key).
 * Keep in sync with `lib/market/eodhd-daily-load-model.ts`.
 * Exit 1 when any scenario exceeds the 80k target.
 */

const EODHD_DAILY_BUDGET_TARGET = 80_000;
const EODHD_DAILY_PLAN_CEILING = 100_000;

const SCENARIO_1000_DAU_MODERATE = {
  name: "1000_dau_moderate",
  dau: 1000,
  cronMarketIngestsPerDay: 28,
  eodhdPerMarketIngest: 380,
  cronHubIngestRunsPerDay: 32,
  eodhdPerHubIngestRun: 120,
  listPageViewsPerUser: 4,
  eodhdPerListPageView: 0,
  uniqueAssetTickersPerDay: 180,
  assetColdLoadsPerTickerPerDay: 3,
  eodhdPerAssetColdLoad: 11,
  assetWarmLoadsPerTickerPerDay: 12,
  eodhdPerAssetWarmLoad: 2,
  stockLivePricePollsPerUser: 8,
  eodhdPerStockLivePricePoll: 1,
  remoteSearchCallsPerUser: 1.5,
  eodhdPerRemoteSearch: 1,
  chartingSessionsPerUser: 0.2,
  eodhdPerChartingSession: 8,
  watchlistEnrichPerUser: 0.5,
  eodhdPerWatchlistEnrich: 3,
  fixedOverheadPerDay: 2000,
};

const SCENARIO_1000_DAU_HEAVY = {
  ...SCENARIO_1000_DAU_MODERATE,
  name: "1000_dau_heavy",
  uniqueAssetTickersPerDay: 350,
  assetColdLoadsPerTickerPerDay: 5,
  assetWarmLoadsPerTickerPerDay: 25,
  remoteSearchCallsPerUser: 4,
  chartingSessionsPerUser: 0.8,
  eodhdPerChartingSession: 12,
  stockLivePricePollsPerUser: 15,
};

function estimateDailyEodhdUsage(scenario) {
  const breakdown = {
    cron_market: Math.round(scenario.cronMarketIngestsPerDay * scenario.eodhdPerMarketIngest),
    cron_hub: Math.round(scenario.cronHubIngestRunsPerDay * scenario.eodhdPerHubIngestRun),
    list_pages: Math.round(scenario.dau * scenario.listPageViewsPerUser * scenario.eodhdPerListPageView),
    asset_cold: Math.round(
      scenario.uniqueAssetTickersPerDay *
        scenario.assetColdLoadsPerTickerPerDay *
        scenario.eodhdPerAssetColdLoad,
    ),
    asset_warm: Math.round(
      scenario.uniqueAssetTickersPerDay *
        scenario.assetWarmLoadsPerTickerPerDay *
        scenario.eodhdPerAssetWarmLoad,
    ),
    stock_live_price: Math.round(
      scenario.dau * scenario.stockLivePricePollsPerUser * scenario.eodhdPerStockLivePricePoll,
    ),
    search: Math.round(scenario.dau * scenario.remoteSearchCallsPerUser * scenario.eodhdPerRemoteSearch),
    charting_comparison: Math.round(
      scenario.dau * scenario.chartingSessionsPerUser * scenario.eodhdPerChartingSession,
    ),
    watchlist_enrich: Math.round(scenario.dau * scenario.watchlistEnrichPerUser * scenario.eodhdPerWatchlistEnrich),
    fixed_overhead: Math.round(scenario.fixedOverheadPerDay),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return {
    scenario: scenario.name,
    total,
    underBudget: total <= EODHD_DAILY_BUDGET_TARGET,
    budgetTarget: EODHD_DAILY_BUDGET_TARGET,
    headroom: EODHD_DAILY_BUDGET_TARGET - total,
    breakdown,
  };
}

function formatLoadEstimateReport(estimates) {
  const lines = [
    `EODHD daily load model (target ≤${EODHD_DAILY_BUDGET_TARGET.toLocaleString()}, plan ${EODHD_DAILY_PLAN_CEILING.toLocaleString()})`,
    "",
  ];
  for (const e of estimates) {
    lines.push(`## ${e.scenario}`);
    lines.push(
      `Total: ${e.total.toLocaleString()} — ${e.underBudget ? "PASS" : "FAIL"} (headroom ${e.headroom.toLocaleString()})`,
    );
    lines.push("");
    for (const [k, v] of Object.entries(e.breakdown).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${k.padEnd(22)} ${v.toLocaleString()}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const estimates = [
  estimateDailyEodhdUsage(SCENARIO_1000_DAU_MODERATE),
  estimateDailyEodhdUsage(SCENARIO_1000_DAU_HEAVY),
];

console.log(formatLoadEstimateReport(estimates));
console.log("Calibrate scenario constants with: npm run eodhd:probe");
console.log(`Budget target: ${EODHD_DAILY_BUDGET_TARGET.toLocaleString()} traced HTTP calls / day (single-host model).`);

const moderate = estimates.find((e) => e.scenario === "1000_dau_moderate");
if (!moderate?.underBudget) {
  console.error("Moderate 1k DAU scenario exceeds budget — adjust traffic or constants.");
  process.exit(1);
}
const heavy = estimates.find((e) => e.scenario === "1000_dau_heavy");
if (heavy && !heavy.underBudget) {
  console.warn("Heavy stress scenario exceeds budget (informational only).");
}
process.exit(0);
