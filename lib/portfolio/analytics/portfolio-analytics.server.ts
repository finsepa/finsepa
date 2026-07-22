/**
 * Portfolio analytics orchestrator (Phase 4) — server only.
 */
import "server-only";

import { format, subYears } from "date-fns";

import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { isSupportedCryptoAssetSymbol } from "@/lib/crypto/crypto-logo-url";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchFedFundsTargetSeriesCached } from "@/lib/market/eodhd-fed-funds-macro";
import { fetchShillerIeMacroSeriesCached } from "@/lib/market/shiller-ie-macro";
import {
  BENCHMARK_DEFAULT_TICKER,
  extractAllExternalCashFlows,
} from "@/lib/portfolio/benchmark/benchmark-engine";
import { makePriceOnOrBefore } from "@/lib/portfolio/benchmark/benchmark-compare.server";
import { holdingFundamentalsFromRoot } from "@/lib/portfolio/analytics/portfolio-fundamentals-from-eodhd";
import { computeSpyBenchmarkMetrics, buildSpyPriceDailyReturns } from "@/lib/portfolio/analytics/portfolio-spy-benchmark";
import {
  buildHoldingsLookthroughDailyReturns,
  pickRiskReturnSeries,
} from "@/lib/portfolio/analytics/portfolio-lookthrough-returns";
import {
  aggregatePortfolioPe,
  aggregateWeightedCashConversion,
  aggregateWeightedMargin,
  aggregateWeightedRoce,
} from "@/lib/portfolio/analytics/portfolio-fundamentals";
import {
  ANALYTICS_ANNUALIZATION,
  ANALYTICS_MIN_DAILY_OBS,
  unavailableMetric,
  type PortfolioAnalyticsSnapshot,
} from "@/lib/portfolio/analytics/portfolio-analytics-types";
import {
  loadPortfolioBenchmarkEodBars,
  loadPortfolioEodBars,
} from "@/lib/portfolio/data/load-portfolio-eod-bars";
import {
  alignPairedReturns,
  buildFlowAwareDailyReturns,
  type DailyReturnPoint,
  type NavMark,
} from "@/lib/portfolio/analytics/portfolio-return-series";
import {
  computeAnnualizedVolatility,
  computeBeta,
  computeSharpeRatio,
  computeSortinoRatio,
} from "@/lib/portfolio/analytics/portfolio-risk-metrics";
import {
  computePortfolioTurnover,
  turnoverAverageEquityFromHoldings,
} from "@/lib/portfolio/analytics/portfolio-turnover";
import { lastCloseOnOrBefore, portfolioNetWorthOnDate } from "@/lib/portfolio/returns/portfolio-nav.server";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";
import { parseBodyTransactions } from "@/lib/portfolio/portfolio-value-history.server";

const MAX_TX = 4000;
const MAX_HOLDINGS = 500;

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function tradeSymbols(transactions: PortfolioTransaction[]): string[] {
  const s = new Set<string>();
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    const u = t.symbol.trim().toUpperCase();
    if (u) s.add(u);
  }
  return [...s];
}

async function loadBars(
  symbols: string[],
  fromYmd: string,
  toYmd: string,
): Promise<Map<string, EodhdDailyBar[]>> {
  return loadPortfolioEodBars(symbols, fromYmd, toYmd, { retry: true });
}

function equityCoverageOnDate(
  transactions: PortfolioTransaction[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  asOfYmd: string,
): number {
  const holdings = replayTradeTransactionsToHoldingsUpTo(transactions, asOfYmd);
  if (holdings.length === 0) return 1;
  let total = 0;
  let marked = 0;
  for (const h of holdings) {
    if (h.shares <= 0) continue;
    const bars = barsBySymbol.get(h.symbol.toUpperCase()) ?? [];
    const px = lastCloseOnOrBefore(bars, asOfYmd);
    const weight = h.shares;
    total += weight;
    if (px != null && Number.isFinite(px) && px > 0) marked += weight;
  }
  if (total <= 0) return 1;
  return marked / total;
}

function sampleSessionDates(benchBars: EodhdDailyBar[], fromYmd: string, toYmd: string): string[] {
  return benchBars
    .map((b) => b.date)
    .filter((d) => d >= fromYmd && d <= toYmd)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Contribution-model daily returns on the session calendar.
 *
 * Flows before the first available SPY bar are seeded at the window-start mark so
 * truncated EOD history does not zero out shares (which starved beta overlap).
 */
function buildBenchmarkDailyReturns(
  flows: ReturnType<typeof extractAllExternalCashFlows>,
  benchBars: EodhdDailyBar[],
  sampleDates: string[],
): DailyReturnPoint[] {
  if (sampleDates.length === 0) return [];
  const price = makePriceOnOrBefore(benchBars);
  const windowStart = sampleDates[0]!;
  const priceForFlow = (flowDate: string): number | null => {
    const direct = price(flowDate);
    if (direct != null && direct > 0) return direct;
    // Pre-history deposits: treat as invested at the first in-window mark.
    if (flowDate < windowStart) {
      const startPx = price(windowStart);
      return startPx != null && startPx > 0 ? startPx : null;
    }
    return null;
  };

  const marks: NavMark[] = [];
  for (const d of sampleDates) {
    let shares = 0;
    for (const f of flows) {
      if (f.date > d) break;
      const px = priceForFlow(f.date);
      if (px == null || px <= 0) continue;
      if (f.amount > 0) shares += f.amount / px;
      else shares = Math.max(0, shares - Math.abs(f.amount) / px);
    }
    const px = price(d);
    const nav = px != null && px > 0 ? shares * px : 0;
    marks.push({ date: d, nav, coverage: 1 });
  }
  return buildFlowAwareDailyReturns(marks, flows, { minCoverage: 0.5 });
}

/**
 * Risk-free: latest FRED FEDFUNDS annual % → daily = (rate/100) / 252.
 * Documented temporary policy when 3M T-bill series is not wired.
 */
export async function resolveDailyRiskFreeRate(): Promise<{
  dailyRf: number | null;
  annualPct: number | null;
  asOf: string | null;
}> {
  try {
    const series = await fetchFedFundsTargetSeriesCached();
    if (!series.length) return { dailyRf: null, annualPct: null, asOf: null };
    const last = series[series.length - 1]!;
    const annualPct = last.value;
    if (!Number.isFinite(annualPct)) return { dailyRf: null, annualPct: null, asOf: null };
    return {
      dailyRf: annualPct / 100 / ANALYTICS_ANNUALIZATION,
      annualPct,
      asOf: last.time,
    };
  } catch {
    return { dailyRf: null, annualPct: null, asOf: null };
  }
}

export async function computePortfolioAnalyticsSnapshot(args: {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  benchmarkTicker?: string;
}): Promise<PortfolioAnalyticsSnapshot> {
  const asOf = ymd(new Date());
  const emptyRisk = unavailableMetric("INSUFFICIENT_HISTORY", { asOf, observations: 0 });
  const emptyFund = unavailableMetric("NO_HOLDINGS", { asOf });

  const base: PortfolioAnalyticsSnapshot = {
    asOf,
    sharpe: emptyRisk,
    sortino: emptyRisk,
    volatility: emptyRisk,
    beta: emptyRisk,
    turnover: computePortfolioTurnover({
      transactions: args.transactions,
      averageEquityUsd: turnoverAverageEquityFromHoldings(args.holdings),
      asOfYmd: asOf,
    }),
    pe: emptyFund,
    grossMargin: emptyFund,
    operatingMargin: emptyFund,
    roce: emptyFund,
    cashConversion: emptyFund,
    benchmark: null,
  };

  try {
    const fromYmd = ymd(subYears(new Date(), 1));
    const symbols = [
      ...new Set([
        ...tradeSymbols(args.transactions),
        ...args.holdings.map((h) => h.symbol.trim().toUpperCase()).filter(Boolean),
      ]),
    ].slice(0, MAX_HOLDINGS);

    const benchTicker = args.benchmarkTicker?.trim().toUpperCase() || BENCHMARK_DEFAULT_TICKER;
    const [barsBySymbol, benchBars, rf, fundamentalsEntries, spyFundRoot, spxPeSeries] =
      await Promise.all([
      loadBars(symbols, fromYmd, asOf),
      loadPortfolioBenchmarkEodBars(benchTicker, fromYmd, asOf, { retry: true }),
      resolveDailyRiskFreeRate(),
      Promise.all(
        args.holdings.slice(0, MAX_HOLDINGS).map(async (h) => {
          const sym = h.symbol.trim().toUpperCase();
          const routeKey = cryptoRouteBase(sym);
          const isCrypto = isSupportedCryptoAssetSymbol(routeKey);
          if (isCrypto) {
            return holdingFundamentalsFromRoot({
              symbol: sym,
              marketValue: h.currentValue,
              root: null,
              isCrypto: true,
            });
          }
          try {
            const root = await fetchEodhdFundamentalsJson(sym);
            return holdingFundamentalsFromRoot({
              symbol: sym,
              marketValue: h.currentValue,
              root,
              isCrypto: false,
            });
          } catch {
            return holdingFundamentalsFromRoot({
              symbol: sym,
              marketValue: h.currentValue,
              root: null,
              isCrypto: false,
            });
          }
        }),
      ),
      fetchEodhdFundamentalsJson(benchTicker).catch(() => null),
      fetchShillerIeMacroSeriesCached("sp500_pe").catch(() => [] as { time: string; value: number }[]),
    ]);

    const spyFundamentals = holdingFundamentalsFromRoot({
      symbol: benchTicker,
      marketValue: 1,
      root: spyFundRoot,
      isCrypto: false,
    });
    const lastSpxPe = spxPeSeries.length > 0 ? spxPeSeries[spxPeSeries.length - 1]!.value : null;
    const sp500TrailingPe =
      lastSpxPe != null && Number.isFinite(lastSpxPe) && lastSpxPe > 0 ? lastSpxPe : null;

    const buildBenchmark = () =>
      computeSpyBenchmarkMetrics({
        asOf,
        benchBars,
        dailyRf: rf.dailyRf,
        spyFundamentals,
        sp500TrailingPe,
      });

    // Fundamentals
    const peAgg = aggregatePortfolioPe(fundamentalsEntries, asOf);
    const gmAgg = aggregateWeightedMargin(fundamentalsEntries, "grossMargin", asOf);
    const omAgg = aggregateWeightedMargin(fundamentalsEntries, "operatingMargin", asOf);
    const roceAgg = aggregateWeightedRoce(fundamentalsEntries, asOf);
    const ccAgg = aggregateWeightedCashConversion(fundamentalsEntries, asOf);
    base.pe = peAgg.metric;
    base.grossMargin = gmAgg.metric;
    base.operatingMargin = omAgg.metric;
    base.roce = roceAgg.metric;
    base.cashConversion = ccAgg.metric;

    if (benchBars.length === 0) {
      base.sharpe = unavailableMetric("PROVIDER_FAILURE", { asOf });
      base.sortino = unavailableMetric("PROVIDER_FAILURE", { asOf });
      base.volatility = unavailableMetric("PROVIDER_FAILURE", { asOf });
      base.beta = unavailableMetric("PROVIDER_FAILURE", { asOf });
      base.benchmark = buildBenchmark();
      return base;
    }

    const sampleDates = sampleSessionDates(benchBars, fromYmd, asOf);
    const flows = extractAllExternalCashFlows(args.transactions);
    const portfolioMarks: NavMark[] = [];
    for (const d of sampleDates) {
      const nav = portfolioNetWorthOnDate(args.transactions, barsBySymbol, d);
      const coverage = equityCoverageOnDate(args.transactions, barsBySymbol, d);
      portfolioMarks.push({ date: d, nav, coverage });
    }

    const ledgerReturns = buildFlowAwareDailyReturns(portfolioMarks, flows);
    const lookthroughReturns = buildHoldingsLookthroughDailyReturns({
      holdings: args.holdings.map((h) => ({
        symbol: h.symbol,
        marketValue: h.currentValue,
      })),
      barsBySymbol,
      sampleDates,
    });
    const { returns: portReturns, source: riskSource } = pickRiskReturnSeries({
      ledgerReturns,
      lookthroughReturns,
      minObs: ANALYTICS_MIN_DAILY_OBS,
    });

    // Contribution-model bench matches ledger Dietz; price returns match lookthrough weights.
    const benchReturns =
      riskSource === "lookthrough" ?
        buildSpyPriceDailyReturns(benchBars)
      : buildBenchmarkDailyReturns(flows, benchBars, sampleDates);

    // Trailing window: last ~252 observations when available
    const portTrim = portReturns.slice(-ANALYTICS_ANNUALIZATION);
    // Beta: pair on calendar dates first, then take the trailing overlap window.
    // Trimming each series independently desynchronizes contribution-model dates.
    const pairedForBeta = alignPairedReturns(portReturns, benchReturns).slice(-ANALYTICS_ANNUALIZATION);
    const portForBeta = pairedForBeta.map((p) => ({ date: p.date, r: p.rp, coverage: 1 }));
    const benchForBeta = pairedForBeta.map((p) => ({ date: p.date, r: p.rb, coverage: 1 }));

    base.volatility = computeAnnualizedVolatility(portTrim, asOf);
    base.sharpe = computeSharpeRatio(portTrim, rf.dailyRf, asOf);
    base.sortino = computeSortinoRatio(portTrim, rf.dailyRf, asOf);
    base.beta = computeBeta(portForBeta, benchForBeta, asOf);
    base.benchmark = buildBenchmark();

    return base;
  } catch (e) {
    console.error("[portfolio analytics]", e instanceof Error ? e.message : e);
    return {
      ...base,
      sharpe: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      sortino: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      volatility: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      beta: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      pe: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      grossMargin: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      operatingMargin: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      roce: unavailableMetric("PROVIDER_FAILURE", { asOf }),
      cashConversion: unavailableMetric("PROVIDER_FAILURE", { asOf }),
    };
  }
}

export function parsePortfolioAnalyticsBody(body: unknown): {
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  benchmark: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const rawTx = o.transactions;
  if (!Array.isArray(rawTx) || rawTx.length > MAX_TX) return null;
  const transactions = parseBodyTransactions(rawTx);
  if (transactions == null) return null;

  const holdings: PortfolioHolding[] = [];
  if (Array.isArray(o.holdings)) {
    for (const row of o.holdings) {
      if (!row || typeof row !== "object") continue;
      const h = row as Record<string, unknown>;
      const symbol = typeof h.symbol === "string" ? h.symbol.trim().toUpperCase() : "";
      if (!symbol) continue;
      const shares = typeof h.shares === "number" ? h.shares : Number(h.shares);
      const currentValue =
        typeof h.currentValue === "number" ? h.currentValue : Number(h.currentValue);
      const avgPrice = typeof h.avgPrice === "number" ? h.avgPrice : Number(h.avgPrice) || 0;
      const costBasis = typeof h.costBasis === "number" ? h.costBasis : Number(h.costBasis) || 0;
      const marketPrice =
        typeof h.marketPrice === "number" ? h.marketPrice : Number(h.marketPrice) || 0;
      if (!Number.isFinite(shares) || !Number.isFinite(currentValue)) continue;
      holdings.push({
        id: typeof h.id === "string" ? h.id : symbol,
        symbol,
        name: typeof h.name === "string" ? h.name : symbol,
        logoUrl: typeof h.logoUrl === "string" ? h.logoUrl : null,
        shares,
        avgPrice: Number.isFinite(avgPrice) ? avgPrice : 0,
        costBasis: Number.isFinite(costBasis) ? costBasis : 0,
        currentValue,
        marketPrice: Number.isFinite(marketPrice) ? marketPrice : 0,
      });
    }
  }

  const b = o.benchmark;
  const benchmark = typeof b === "string" && b.trim() ? b.trim().toUpperCase() : BENCHMARK_DEFAULT_TICKER;
  return { holdings, transactions, benchmark };
}
