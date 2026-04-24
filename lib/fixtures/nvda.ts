import "server-only";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdFundamentalsHighlights } from "@/lib/market/eodhd-fundamentals";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc, formatMarketCapDisplay, formatPeDisplay } from "@/lib/screener/eod-derived-metrics";
import { STOCK_CHART_ALL_LOOKBACK_YEARS, type StockChartPoint, type StockChartRange } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import type { StockEarningsEstimatesChart, StockEarningsTabPayload } from "@/lib/market/stock-earnings-types";

import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { TOP10_META } from "@/lib/screener/top10-config";
import { screenerStaticByTicker } from "@/lib/screener/screener-static";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";

const NVDA = "NVDA";

function utcSeconds(ms: number) {
  return Math.floor(ms / 1000);
}

function makeTrendPointSeries(count: number, startMs: number, stepMs: number, base: number, amplitude: number) {
  const pts: StockChartPoint[] = [];
  for (let i = 0; i < count; i++) {
    // deterministic waveform: no provider calls
    const t = startMs + i * stepMs;
    const phase = i / Math.max(1, count - 1);
    const wave = Math.sin(phase * Math.PI * 2) * amplitude;
    const drift = (phase - 0.5) * amplitude * 0.4;
    const v = base + wave + drift;
    pts.push({ time: utcSeconds(t), value: Math.max(1, v) });
  }
  return pts;
}

export function getNvdaHeaderMeta(): StockDetailHeaderMeta {
  const meta = TOP10_META[NVDA as keyof typeof TOP10_META];
  return {
    fullName: "NVIDIA Corporation",
    logoUrl: companyLogoUrlForTicker(NVDA, meta.domain),
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Semiconductors",
    earningsDateDisplay: "—",
    watchlistCount: null,
  };
}

export function getNvdaChartPoints(range: StockChartRange): StockChartPoint[] {
  const now = Date.now();
  if (range === "1D") return makeTrendPointSeries(60, now - 24 * 3600_000, 24 * 3600_000 / 60, 920, 45);
  if (range === "5D") return makeTrendPointSeries(30, now - 5 * 24 * 3600_000, 5 * 24 * 3600_000 / 30, 900, 55);
  // ~4 synthetic samples per calendar day over ~30d (mirrors intraday-dense 1M in live mode).
  if (range === "1M") return makeTrendPointSeries(120, now - 30 * 24 * 3600_000, (30 * 24 * 3600_000) / 120, 860, 70);
  if (range === "6M") return makeTrendPointSeries(80, now - 180 * 24 * 3600_000, (180 * 24 * 3600_000) / 80, 820, 85);
  if (range === "YTD") return makeTrendPointSeries(120, now - 220 * 24 * 3600_000, (220 * 24 * 3600_000) / 120, 780, 110);
  if (range === "1Y") return makeTrendPointSeries(160, now - 365 * 24 * 3600_000, (365 * 24 * 3600_000) / 160, 760, 120);
  if (range === "5Y") return makeTrendPointSeries(190, now - 5 * 365 * 24 * 3600_000, (5 * 365 * 24 * 3600_000) / 190, 735, 130);
  {
    const allSpanMs = STOCK_CHART_ALL_LOOKBACK_YEARS * 365 * 24 * 3600_000;
    const n = 240;
    return makeTrendPointSeries(n, now - allSpanMs, allSpanMs / n, 720, 140);
  }
}

function computePerformanceFromPoints(points: StockChartPoint[], ticker: string): StockPerformance {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const last = sorted[sorted.length - 1];
  const price = last ? last.value : null;
  if (price == null) {
    return {
      ticker,
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
    };
  }
  function pct(current: number | null, base: number | null): number | null {
    if (current == null || base == null || base === 0) return null;
    return ((current - base) / base) * 100;
  }

  const getAgo = (n: number) => {
    const idx = Math.max(0, sorted.length - 1 - n);
    return sorted[idx]?.value ?? null;
  };

  // Rough buckets based on point positions (fixture only).
  const d1 = pct(price, getAgo(2));
  const d5 = pct(price, getAgo(6));
  const d7 = pct(price, getAgo(8));
  const m1 = pct(price, getAgo(20));
  const m6 = pct(price, getAgo(60));
  const ytd = pct(price, getAgo(90));
  const y1 = pct(price, getAgo(120));
  const y5 = pct(price, getAgo(160));
  const y10 = pct(price, getAgo(175));
  const all = pct(price, sorted[0]?.value ?? null);

  return { ticker, price, d1, d5, d7, m1, m6, ytd, y1, y5, y10, all };
}

export function getNvdaPerformance(): StockPerformance {
  return computePerformanceFromPoints(getNvdaChartPoints("1Y"), NVDA);
}

export function getNvdaKeyStatsBundle(): StockKeyStatsBundle {
  return {
    basic: [
      { label: "Market Cap", value: "$2,000.00B" },
      { label: "Enterprise Value", value: "—" },
      { label: "Shares Outstanding", value: "—" },
      { label: "1Y Target Est", value: "—" },
      { label: "Fair Value", value: "—" },
      { label: "Earnings Date", value: "—" },
      { label: "Beta (5Y Monthly)", value: "—" },
      { label: "Employees", value: "—" },
    ],
    valuation: [
      { label: "P/E Ratio", value: "—" },
      { label: "Trailing P/E", value: "—" },
      { label: "Forward P/E", value: "—" },
      { label: "P/S Ratio", value: "—" },
      { label: "Price/Book Ratio", value: "—" },
      { label: "Price/FCF Ratio", value: "—" },
      { label: "EV/EBITDA", value: "—" },
      { label: "EV/Sales", value: "—" },
      { label: "Cash/Debt", value: "—" },
    ],
    revenueProfit: [
      { label: "Revenue", value: "—" },
      { label: "Gross Profit", value: "—" },
      { label: "Operating Income", value: "—" },
      { label: "Net Income", value: "—" },
      { label: "EBITDA", value: "—" },
      { label: "EPS", value: "—" },
      { label: "FCF", value: "—" },
    ],
    margins: [
      { label: "Gross Margin", value: "—" },
      { label: "Operating Margin", value: "—" },
      { label: "EBITDA Margin", value: "—" },
      { label: "Pre-Tax Margin", value: "—" },
      { label: "Net Margin", value: "—" },
      { label: "Free Cash Flow", value: "—" },
    ],
    growth: [
      { label: "Quarterly Revenue (YoY)", value: "—" },
      { label: "Revenue (3Y)", value: "—" },
      { label: "Quarterly EPS (YoY)", value: "—" },
      { label: "EPS (3Y)", value: "—" },
    ],
    assetsLiabilities: [
      { label: "Total Assets", value: "—" },
      { label: "Cash on Hand", value: "—" },
      { label: "Long Term Debt", value: "—" },
      { label: "Total Liabilities", value: "—" },
      { label: "Share Holder Equity", value: "—" },
      { label: "Debt/Equity", value: "—" },
    ],
    returns: [
      { label: "Return on Equity (ROE)", value: "—" },
      { label: "Return on Assets (ROA)", value: "—" },
      { label: "Return on Capital Employed (ROCE)", value: "—" },
      { label: "Return on Investments (ROI)", value: "—" },
    ],
    dividends: [
      { label: "Yield", value: "—" },
      { label: "Payout", value: "—" },
    ],
    risk: [
      { label: "Beta (5Y)", value: "—" },
      { label: "Max Drawdown (5Y)", value: "—" },
    ],
  };
}

function nvdaEstimatesChartFixture(): StockEarningsEstimatesChart {
  return {
    quarterly: [
      {
        sortKey: "2025-04-30",
        label: "Q1 2025",
        revenueEstimateUsd: 26e9,
        revenueActualUsd: 26.4e9,
        epsEstimate: 0.72,
        epsActual: 0.76,
        reported: true,
      },
      {
        sortKey: "2025-07-31",
        label: "Q2 2025",
        revenueEstimateUsd: 31e9,
        revenueActualUsd: 30.4e9,
        epsEstimate: 0.85,
        epsActual: 0.82,
        reported: true,
      },
      {
        sortKey: "2025-10-31",
        label: "Q3 2025",
        revenueEstimateUsd: 37e9,
        revenueActualUsd: 37.5e9,
        epsEstimate: 1.02,
        epsActual: 1.05,
        reported: true,
      },
    ],
    annual: [
      { sortKey: "2022-01-31", label: "2022", revenueEstimateUsd: 27e9, revenueActualUsd: 26.9e9, epsEstimate: 0.45, epsActual: 0.44, reported: true },
      { sortKey: "2023-01-31", label: "2023", revenueEstimateUsd: 45e9, revenueActualUsd: 44.9e9, epsEstimate: 0.75, epsActual: 0.74, reported: true },
      { sortKey: "2024-01-31", label: "2024", revenueEstimateUsd: 96e9, revenueActualUsd: 96.3e9, epsEstimate: 1.2, epsActual: 1.19, reported: true },
      { sortKey: "2025-01-31", label: "2025", revenueEstimateUsd: 130e9, revenueActualUsd: null, epsEstimate: 2.1, epsActual: null, reported: false },
      { sortKey: "2026-01-31", label: "2026", revenueEstimateUsd: 165e9, revenueActualUsd: null, epsEstimate: 2.65, epsActual: null, reported: false },
      { sortKey: "2027-01-31", label: "2027", revenueEstimateUsd: 195e9, revenueActualUsd: null, epsEstimate: 3.05, epsActual: null, reported: false },
    ],
  };
}

export function getNvdaStockEarningsTabPayload(): StockEarningsTabPayload {
  return {
    ticker: NVDA,
    upcoming: {
      reportDateDisplay: "Feb 26, 2026",
      reportDateYmd: "2026-02-26",
      timing: "amc",
      timingShortLabel: "AMC",
      timingPhrase: "After market",
      fiscalPeriodLabel: "Q4 2026",
      epsEstimateDisplay: "1.05",
      revenueEstimateDisplay: "$38.2B",
    },
    history: [
      {
        fiscalPeriodEndYmd: "2025-10-31",
        fiscalPeriodLabel: "Q3 2025",
        reportDateDisplay: "Nov 19, 2025",
        epsEstimateDisplay: "1.02",
        epsActualDisplay: "1.05",
        surprisePct: 2.9,
        surpriseDisplay: "+2.9%",
        revenueEstimateDisplay: "$37.0B",
        revenueActualDisplay: "$37.5B",
        reported: true,
        revenueEstimateUsd: 37e9,
        revenueActualUsd: 37.5e9,
        epsEstimateRaw: 1.02,
        epsActualRaw: 1.05,
      },
      {
        fiscalPeriodEndYmd: "2025-07-31",
        fiscalPeriodLabel: "Q2 2025",
        reportDateDisplay: "Aug 28, 2025",
        epsEstimateDisplay: "0.85",
        epsActualDisplay: "0.82",
        surprisePct: -3.5,
        surpriseDisplay: "-3.5%",
        revenueEstimateDisplay: "$31.0B",
        revenueActualDisplay: "$30.4B",
        reported: true,
        revenueEstimateUsd: 31e9,
        revenueActualUsd: 30.4e9,
        epsEstimateRaw: 0.85,
        epsActualRaw: 0.82,
      },
      {
        fiscalPeriodEndYmd: "2025-04-30",
        fiscalPeriodLabel: "Q1 2025",
        reportDateDisplay: "May 29, 2025",
        epsEstimateDisplay: "0.72",
        epsActualDisplay: "0.76",
        surprisePct: 5.6,
        surpriseDisplay: "+5.6%",
        revenueEstimateDisplay: "$26.0B",
        revenueActualDisplay: "$26.4B",
        reported: true,
        revenueEstimateUsd: 26e9,
        revenueActualUsd: 26.4e9,
        epsEstimateRaw: 0.72,
        epsActualRaw: 0.76,
      },
    ],
    estimatesChart: nvdaEstimatesChartFixture(),
  };
}

export function getNvdaProfile(): StockProfilePayload {
  return {
    description: "NVDA fixture profile for single-asset mode.",
    website: "https://www.nvidia.com",
    irWebsite: "https://investor.nvidia.com",
    foundedYear: "1993",
    headquarters: "Santa Clara, California",
    hqState: "CA",
    sector: "Technology",
    industry: "Semiconductors",
    employees: "—",
    phone: "—",
    equityStyle: "—",
    nextEarningsDate: null,
    lastEarningsDate: null,
  };
}

export function getNvdaChartingSeriesPoints(mode: "annual" | "quarterly"): ChartingSeriesPoint[] {
  const base = mode === "quarterly" ? 4 : 4;
  const points: ChartingSeriesPoint[] = [];
  for (let i = 0; i < base; i++) {
    const periodEnd = mode === "quarterly" ? `202${i}-03-31` : `202${i}-12-31`;
    const revenue = 40 + i * 6;
    const eps = 3 + i * 0.3;
    points.push({
      periodEnd,
      revenue,
      grossProfit: revenue * 0.6,
      operatingIncome: revenue * 0.4,
      netIncome: revenue * 0.28,
      ebitda: revenue * 0.5,
      eps,
      incomeBeforeTax: revenue * 0.3,
      freeCashFlow: revenue * 0.25,
      dividendsPaid: null,
      totalAssets: revenue * 2,
      totalLiabilities: revenue * 1.1,
      cashOnHand: revenue * 0.3,
      longTermDebt: null,
      shareholderEquity: revenue * 0.9,
      currentLiabilities: null,
      totalDebt: null,
      debtToEquity: null,
      sharesOutstanding: null,
      marketCap: revenue * 25,
      enterpriseValue: revenue * 24.2,
      grossMargin: 0.6,
      operatingMargin: 0.4,
      ebitdaMargin: 0.5,
      netMargin: 0.28,
      preTaxMargin: 0.3,
      fcfMargin: 0.25,
      revenueYoy: null,
      revenue3yCagr: null,
      epsYoy: null,
      eps3yCagr: null,
      peRatio: null,
      trailingPe: null,
      forwardPe: null,
      psRatio: null,
      priceBook: null,
      priceFcf: null,
      evEbitda: null,
      evSales: null,
      cashDebt: null,
      dividendYield: null,
      payoutRatio: null,
      returnOnEquity: null,
      returnOnAssets: null,
      returnOnCapitalEmployed: null,
      returnOnInvestment: null,
    });
  }
  return points;
}

export function getNvdaStockNews(): StockNewsArticle[] {
  return [];
}

export async function getNvdaScreenerRow(): Promise<ScreenerTableRow> {
  const staticRow = screenerStaticByTicker[NVDA as keyof typeof screenerStaticByTicker];
  const meta = TOP10_META[NVDA as keyof typeof TOP10_META];

  const { from, to } = eodFetchWindowUtc();
  const bars = await fetchEodhdEodDaily(NVDA, from, to);

  // If provider is unavailable, keep numeric fields blank (testability).
  if (!bars || bars.length < 2) {
    return {
      id: staticRow.id,
      name: staticRow.name,
      ticker: staticRow.ticker,
      logoUrl: companyLogoUrlForTicker(NVDA, meta.domain),
      price: null,
      change1D: null,
      change1M: null,
      changeYTD: null,
      marketCap: "-",
      pe: "-",
      trend: [],
    };
  }

  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const prev = sorted[sorted.length - 2]!;
  const currentPrice = Number.isFinite(last.close) ? last.close : null;

  const change1D =
    currentPrice != null && Number.isFinite(prev.close) && prev.close > 0 ? ((currentPrice - prev.close) / prev.close) * 100 : null;

  const derived = currentPrice != null ? deriveMetricsFromDailyBars(sorted, currentPrice) : null;
  const change1M = derived?.changePercent1M ?? null;
  const changeYTD = derived?.changePercentYTD ?? null;
  const trend = derived?.sparkline5d ?? [];

  const highlights = await fetchEodhdFundamentalsHighlights(NVDA);
  const marketCap = formatMarketCapDisplay(highlights?.marketCapUsd ?? null);
  const pe = formatPeDisplay(highlights?.peTrailing ?? null, highlights?.peForward ?? null);

  return {
    id: staticRow.id,
    name: staticRow.name,
    ticker: staticRow.ticker,
    // Logo is derived from known domain (no EODHD logo callback).
    logoUrl: companyLogoUrlForTicker(NVDA, meta.domain),
    price: currentPrice,
    change1D,
    change1M,
    changeYTD,
    marketCap,
    pe,
    trend,
  };
}

