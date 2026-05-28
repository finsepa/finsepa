/**
 * P6 — analytical daily EODHD budget (single-host / idealized sharing).
 * Calibrate `eodhdPer*` fields with `npm run eodhd:probe` on staging after deploy.
 */

export const EODHD_DAILY_BUDGET_TARGET = 80_000;
export const EODHD_DAILY_PLAN_CEILING = 100_000;

export type EodhdDailyLoadScenario = {
  name: string;
  /** Active users per calendar day */
  dau: number;
  /** Full market cron ingests / day (after skip logic; live hours only) */
  cronMarketIngestsPerDay: number;
  eodhdPerMarketIngest: number;
  /** Hub cron runs that actually write (not `skipped`) / day */
  cronHubIngestRunsPerDay: number;
  eodhdPerHubIngestRun: number;
  /** Screener + heatmap + watchlist list views per user / day (snapshot read → 0 upstream) */
  listPageViewsPerUser: number;
  eodhdPerListPageView: number;
  /** Distinct tickers with ≥1 `/stock/[ticker]` SSR / day */
  uniqueAssetTickersPerDay: number;
  /** Cold SSR loads per ticker / day (new 15m segment or first visit) */
  assetColdLoadsPerTickerPerDay: number;
  eodhdPerAssetColdLoad: number;
  /** Warm SSR loads per ticker / day (snapshot + live hot fields) */
  assetWarmLoadsPerTickerPerDay: number;
  eodhdPerAssetWarmLoad: number;
  /** Client `/api/stocks/.../live-price` polls per user / day on stock pages */
  stockLivePricePollsPerUser: number;
  eodhdPerStockLivePricePoll: number;
  /** Remote search calls per user / day (queries ≥2 chars, after debounce) */
  remoteSearchCallsPerUser: number;
  eodhdPerRemoteSearch: number;
  /** Charting/comparison sessions with tickers in URL / user / day */
  chartingSessionsPerUser: number;
  eodhdPerChartingSession: number;
  /** Watchlist enrich API calls / user / day */
  watchlistEnrichPerUser: number;
  eodhdPerWatchlistEnrich: number;
  /** Fixed overhead (experiments, preview, manual cron) */
  fixedOverheadPerDay: number;
};

/** Moderate browsing at 1k DAU — tune after `eodhd:probe`. */
export const SCENARIO_1000_DAU_MODERATE: EodhdDailyLoadScenario = {
  name: "1000_dau_moderate",
  dau: 1000,
  cronMarketIngestsPerDay: 28,
  /** Hot-only ingest (~4 keys); slow derived runs ~1×/session day during live hours. */
  eodhdPerMarketIngest: 220,
  cronHubIngestRunsPerDay: 12,
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

/** Heavier asset + search traffic — should still sit under 80k with P0–P5. */
export const SCENARIO_1000_DAU_HEAVY: EodhdDailyLoadScenario = {
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

export type EodhdDailyLoadEstimate = {
  scenario: string;
  total: number;
  underBudget: boolean;
  budgetTarget: number;
  headroom: number;
  breakdown: Record<string, number>;
};

export function estimateDailyEodhdUsage(scenario: EodhdDailyLoadScenario): EodhdDailyLoadEstimate {
  const cronMarket = scenario.cronMarketIngestsPerDay * scenario.eodhdPerMarketIngest;
  const cronHub = scenario.cronHubIngestRunsPerDay * scenario.eodhdPerHubIngestRun;
  const listViews = scenario.dau * scenario.listPageViewsPerUser * scenario.eodhdPerListPageView;
  const assetCold =
    scenario.uniqueAssetTickersPerDay *
    scenario.assetColdLoadsPerTickerPerDay *
    scenario.eodhdPerAssetColdLoad;
  const assetWarm =
    scenario.uniqueAssetTickersPerDay *
    scenario.assetWarmLoadsPerTickerPerDay *
    scenario.eodhdPerAssetWarmLoad;
  const livePrice =
    scenario.dau * scenario.stockLivePricePollsPerUser * scenario.eodhdPerStockLivePricePoll;
  const search = scenario.dau * scenario.remoteSearchCallsPerUser * scenario.eodhdPerRemoteSearch;
  const charting = scenario.dau * scenario.chartingSessionsPerUser * scenario.eodhdPerChartingSession;
  const watchlist = scenario.dau * scenario.watchlistEnrichPerUser * scenario.eodhdPerWatchlistEnrich;

  const breakdown: Record<string, number> = {
    cron_market: Math.round(cronMarket),
    cron_hub: Math.round(cronHub),
    list_pages: Math.round(listViews),
    asset_cold: Math.round(assetCold),
    asset_warm: Math.round(assetWarm),
    stock_live_price: Math.round(livePrice),
    search: Math.round(search),
    charting_comparison: Math.round(charting),
    watchlist_enrich: Math.round(watchlist),
    fixed_overhead: Math.round(scenario.fixedOverheadPerDay),
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const headroom = EODHD_DAILY_BUDGET_TARGET - total;

  return {
    scenario: scenario.name,
    total,
    underBudget: total <= EODHD_DAILY_BUDGET_TARGET,
    budgetTarget: EODHD_DAILY_BUDGET_TARGET,
    headroom,
    breakdown,
  };
}

export function formatLoadEstimateReport(estimates: EodhdDailyLoadEstimate[]): string {
  const lines: string[] = [
    `EODHD daily load model (target ≤${EODHD_DAILY_BUDGET_TARGET.toLocaleString()}, plan ${EODHD_DAILY_PLAN_CEILING.toLocaleString()})`,
    "",
  ];
  for (const e of estimates) {
    lines.push(`## ${e.scenario}`);
    lines.push(`Total: ${e.total.toLocaleString()} — ${e.underBudget ? "PASS" : "FAIL"} (headroom ${e.headroom.toLocaleString()})`);
    lines.push("");
    for (const [k, v] of Object.entries(e.breakdown).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${k.padEnd(22)} ${v.toLocaleString()}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
