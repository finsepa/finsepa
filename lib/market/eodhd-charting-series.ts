import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  enrichChartingPointsWithImpliedValuationMultiplesFromMarketCap,
  enrichChartingPointsWithPriceImpliedMarketCap,
  enrichChartingPointsWithTrailingPeFromImpliedMarketCap,
} from "@/lib/market/charting-price-implied-market-cap";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_IDS,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";

function comparePeriodKeys(a: string, b: string): number {
  const ta = Date.parse(a.includes("T") ? a : `${a}T12:00:00.000Z`);
  const tb = Date.parse(b.includes("T") ? b : `${b}T12:00:00.000Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return a.localeCompare(b);
}

const MS_PER_DAY = 86400000;
/** Max |date(income key) − date(other block key)| when EODHD uses different period-end strings across statements. */
const MAX_PERIOD_SLIP_MS: Record<FundamentalsSeriesMode, number> = {
  annual: 200 * MS_PER_DAY,
  /** EODHD often offsets statement vs ratio period-end strings by more than one quarter. */
  quarterly: 120 * MS_PER_DAY,
};

function countObjectRowKeys(block: Record<string, unknown>): number {
  return Object.keys(block).filter((k) => {
    const v = block[k];
    return v != null && typeof v === "object" && !Array.isArray(v);
  }).length;
}

/**
 * When `yearly` is empty but `quarterly` has rows (common for Ratios), still merge by fuzzy period key.
 * Income statement stays strict yearly vs quarterly so period labels match the requested mode.
 */
function pickYearlyOrQuarterlyBlock(
  wrapper: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
): Record<string, unknown> | null {
  const yRaw = wrapper.yearly;
  const qRaw = wrapper.quarterly;
  const yearly =
    yRaw && typeof yRaw === "object" && !Array.isArray(yRaw) ? (yRaw as Record<string, unknown>) : null;
  const quarterly =
    qRaw && typeof qRaw === "object" && !Array.isArray(qRaw) ? (qRaw as Record<string, unknown>) : null;
  const yN = yearly ? countObjectRowKeys(yearly) : 0;
  const qN = quarterly ? countObjectRowKeys(quarterly) : 0;
  if (mode === "annual") {
    if (yN > 0) return yearly;
    if (qN > 0) return quarterly;
    return null;
  }
  if (qN > 0) return quarterly;
  if (yN > 0) return yearly;
  return null;
}

function strictYearlyOrQuarterlyBlock(
  wrapper: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
): Record<string, unknown> | null {
  const block = mode === "annual" ? wrapper.yearly : wrapper.quarterly;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  return block as Record<string, unknown>;
}

/** Keys that wrap period tables — not fiscal period rows (matches `pickLatestFinancialSubTable` fallbacks). */
const FINANCIAL_SUBTABLE_WRAPPER_KEYS = new Set(
  [
    "yearly",
    "quarterly",
    "ttm",
    "TTM",
    "trailing_twelve_months",
    "General",
    "FiscalYearEnd",
    "CurrencySymbol",
    "currency_symbol",
  ].map((k) => k.toLowerCase()),
);

function periodKeyToUtcMs(key: string): number | null {
  const raw = key.trim();
  if (!raw) return null;
  const ts = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isFinite(ts) ? ts : null;
}

/**
 * EODHD often stores `Financials.Ratios` as a flat `periodEnd → row` map with no `yearly` / `quarterly`
 * children. Charting previously only read nested blocks, so valuation ratios never merged (Cash/Debt
 * still worked via balance sheet).
 */
function pickFlatDateKeyedStatementBlock(wrapper: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(wrapper)) {
    if (FINANCIAL_SUBTABLE_WRAPPER_KEYS.has(key.toLowerCase())) continue;
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    if (periodKeyToUtcMs(key) == null) continue;
    out[key] = val;
  }
  return countObjectRowKeys(out) > 0 ? out : null;
}

/**
 * Merge BS / CF / Ratios onto income periods: exact key first, else closest date within slip window.
 */
function findRowForPeriodKey(
  periodKey: string,
  block: Record<string, unknown> | null,
  mode: FundamentalsSeriesMode,
): Record<string, unknown> | null {
  if (!block) return null;
  const direct = block[periodKey];
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const t0 = periodKeyToUtcMs(periodKey);
  if (t0 == null) return null;

  const maxSlip = MAX_PERIOD_SLIP_MS[mode];
  let best: { slip: number; row: Record<string, unknown> } | null = null;

  for (const bk of Object.keys(block)) {
    const candidate = block[bk];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const t1 = periodKeyToUtcMs(bk);
    if (t1 == null) continue;
    const slip = Math.abs(t0 - t1);
    if (slip > maxSlip) continue;
    if (!best || slip < best.slip) best = { slip, row: candidate as Record<string, unknown> };
  }

  return best?.row ?? null;
}

/** Reject absurd multiples from bad merges (keeps charts usable). */
const MAX_DERIVED_VALUATION_MULTIPLE = 5000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numFromRow(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

function getFinancialBlock(
  root: Record<string, unknown>,
  statement: "Income_Statement" | "Balance_Sheet" | "Cash_Flow",
  mode: FundamentalsSeriesMode,
): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const aliases: Record<string, string[]> = {
    Income_Statement: ["Income_Statement", "IncomeStatement"],
    Balance_Sheet: ["Balance_Sheet", "BalanceSheet"],
    Cash_Flow: ["Cash_Flow", "CashFlow"],
  };
  let raw: unknown = null;
  for (const a of aliases[statement]) {
    raw = f[a];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) break;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const st = raw as Record<string, unknown>;
  if (statement === "Income_Statement") {
    const strict = strictYearlyOrQuarterlyBlock(st, mode);
    if (strict && countObjectRowKeys(strict) > 0) return strict;
    const flatIs = pickFlatDateKeyedStatementBlock(st);
    if (flatIs && countObjectRowKeys(flatIs) > 0) return flatIs;
    return null;
  }
  const nested = pickYearlyOrQuarterlyBlock(st, mode);
  if (nested && countObjectRowKeys(nested) > 0) return nested;
  const flatSt = pickFlatDateKeyedStatementBlock(st);
  if (flatSt && countObjectRowKeys(flatSt) > 0) return flatSt;
  return null;
}

function getRatiosBlock(root: Record<string, unknown>, mode: FundamentalsSeriesMode): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const raw = (f.Ratios ?? f.Financial_Ratios) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const nested = pickYearlyOrQuarterlyBlock(r, mode);
  if (nested && countObjectRowKeys(nested) > 0) return nested;
  const flat = pickFlatDateKeyedStatementBlock(r);
  if (flat && countObjectRowKeys(flat) > 0) return flat;
  return null;
}

function mergeIncomeRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  p.revenue = numFromRow(row, [
    "totalRevenue",
    "TotalRevenue",
    "revenue",
    "Revenue",
    "totalRevenueFromOperations",
    "Sales",
  ]);
  p.grossProfit = numFromRow(row, ["grossProfit", "GrossProfit", "grossIncome", "GrossIncome"]);
  p.operatingIncome = numFromRow(row, [
    "operatingIncome",
    "OperatingIncome",
    "operationIncome",
    "operatingIncomeLoss",
    "OperatingIncomeLoss",
  ]);
  p.netIncome = numFromRow(row, [
    "netIncome",
    "NetIncome",
    "netIncomeApplicableToCommonShares",
    "NetIncomeApplicableToCommonShares",
  ]);
  p.ebitda = numFromRow(row, ["ebitda", "EBITDA"]);
  p.eps = numFromRow(row, [
    "dilutedEPS",
    "DilutedEPS",
    "epsDiluted",
    "dilutedEps",
    "DilutedEps",
    "normalizedDilutedEPS",
    "NormalizedDilutedEPS",
    "trailingEPS",
    "TrailingEPS",
    "EpsDiluted",
    "EarningsShare",
    "earningsShare",
    "eps",
    "EPS",
    "basicEPS",
    "BasicEPS",
    "basicEps",
    "BasicEps",
  ]);
  p.incomeBeforeTax = numFromRow(row, [
    "incomeBeforeTax",
    "IncomeBeforeTax",
    "incomeBeforeTaxes",
    "IncomeBeforeTaxes",
    "pretaxIncome",
    "PretaxIncome",
    "incomeBeforeIncomeTaxes",
    "IncomeBeforeIncomeTaxes",
  ]);
  const sh = numFromRow(row, [
    "weightedAverageShsOutDil",
    "weightedAverageShsOut",
    "weightedAverageSharesDiluted",
    "WeightedAverageSharesDiluted",
    "weightedAverageShsOutDilution",
    "sharesOutstandingDiluted",
  ]);
  if (sh != null) p.sharesOutstanding = sh;

  const mcFromInc = numFromRow(row, [
    "marketCapitalization",
    "MarketCapitalization",
    "marketCap",
    "MarketCap",
    "MarketCapMRQ",
    "marketCapitalisation",
    "MarketCapitalisation",
    "MarketCapUSD",
  ]);
  if (mcFromInc != null && Number.isFinite(mcFromInc) && mcFromInc > 0) p.marketCap = mcFromInc;

  const evFromInc = numFromRow(row, [
    "enterpriseValue",
    "EnterpriseValue",
    "EnterpriseValueUSD",
    "EnterpriseValueMRQ",
  ]);
  if (evFromInc != null && Number.isFinite(evFromInc) && evFromInc > 0) p.enterpriseValue = evFromInc;
}

function mergeBalanceRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  p.totalAssets = numFromRow(row, ["totalAssets", "TotalAssets"]);
  p.totalLiabilities = numFromRow(row, ["totalLiab", "TotalLiab", "totalLiabilities", "TotalLiabilities"]);
  p.cashOnHand = numFromRow(row, [
    "cashAndCashEquivalents",
    "CashAndCashEquivalents",
    "cash",
    "Cash",
    "cashAndShortTermInvestments",
    "CashAndShortTermInvestments",
  ]);
  p.longTermDebt = numFromRow(row, ["longTermDebt", "LongTermDebt", "longTermDebtNoncurrent"]);
  p.shareholderEquity = numFromRow(row, [
    "totalStockholderEquity",
    "TotalStockholderEquity",
    "totalStockholdersEquity",
    "ShareholdersEquity",
    "ShareHolderEquity",
  ]);
  p.currentLiabilities = numFromRow(row, ["totalCurrentLiabilities", "TotalCurrentLiabilities", "currentLiabilities"]);
  const td = numFromRow(row, ["shortLongTermDebtTotal", "totalDebt", "TotalDebt", "LongTermDebtTotal"]);
  if (td != null) p.totalDebt = td;
  else {
    const st = numFromRow(row, ["shortTermDebt", "ShortTermDebt"]);
    const lt = numFromRow(row, ["longTermDebt", "LongTermDebt"]);
    if (st != null || lt != null) p.totalDebt = (st ?? 0) + (lt ?? 0);
  }
  const sh = numFromRow(row, [
    "commonStockSharesOutstanding",
    "CommonStockSharesOutstanding",
    "commonStockTotalSharesOutstanding",
  ]);
  if (sh != null && p.sharesOutstanding == null) p.sharesOutstanding = sh;
}

function mergeCashFlowRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  const fcf = numFromRow(row, [
    "freeCashFlow",
    "FreeCashFlow",
    "freeCashFlowFromContinuingOperations",
    "FreeCashFlows",
  ]);
  if (fcf != null) p.freeCashFlow = fcf;
  const div = numFromRow(row, [
    "dividendsPaid",
    "DividendsPaid",
    "cashDividendsPaid",
    "CashDividendsPaid",
    "commonDividendsPaid",
  ]);
  if (div != null) p.dividendsPaid = div;
}

function mergeRatiosRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  /** EPS is sometimes only present on Ratios (yearly) while income statement omits it. */
  const epsFromRatios = numFromRow(row, [
    "EPS",
    "eps",
    "EarningsShare",
    "EarningsPerShare",
    "DilutedEPS",
    "dilutedEPS",
    "TrailingEPS",
    "trailingEPS",
  ]);
  if (epsFromRatios != null && p.eps == null) p.eps = epsFromRatios;

  p.peRatio = numFromRow(row, [
    "PERatio",
    "PE",
    "peRatio",
    "PeRatio",
    "PriceToEarnings",
    "PriceEarnings",
    "PEBasic",
    "PEDiluted",
    "PERatioTTM",
    "PriceToEarningsRatioTTM",
  ]);
  p.trailingPe = numFromRow(row, ["TrailingPE", "TrailingPe", "trailingPE", "TrailingPeRatio", "PETrailing"]);
  const forwardPeFromRow = numFromRow(row, [
    "ForwardPE",
    "ForwardPe",
    "forwardPE",
    "ForwardPeRatio",
    /** EODHD sometimes labels the forward multiple this way (same numeric field family as Highlights). */
    "ForwardPEPS",
    "ForwardPE_TTM",
    "ForwardPEttm",
  ]);
  if (forwardPeFromRow != null && Number.isFinite(forwardPeFromRow) && forwardPeFromRow > 0) {
    p.forwardPe = forwardPeFromRow;
  }

  const forwardEpsFromRow = numFromRow(row, [
    "ForwardEPS",
    "ForwardEps",
    "forwardEPS",
    "EPSEstimateNextYear",
    "EarningsShareForward",
    "EPSNextYear",
    "EstimatedEPS",
    "EPSEstimate",
    "epsForward",
    "ForwardEarningsPerShare",
  ]);

  p.psRatio = numFromRow(row, [
    "PriceSalesTTM",
    "PriceToSalesTTM",
    "PSRatio",
    "PriceSales",
    "PriceToSales",
    "priceToSales",
    "PSRatioTTM",
  ]);
  p.priceBook = numFromRow(row, [
    "PriceBookMRQ",
    "PriceToBookMRQ",
    "PriceBook",
    "PBRatio",
    "PriceToBook",
    "priceToBook",
  ]);
  p.priceFcf = numFromRow(row, [
    "PriceFreeCashFlow",
    "PriceFCF",
    "PriceToFreeCashFlow",
    "PriceToFCF",
    "PriceToFreeCashFlowsTTM",
    "PriceToFreeCashFlowTTM",
    "PriceCashFlow",
    "PFCFRatio",
    "PriceToCashFlow",
  ]);
  p.evEbitda = numFromRow(row, ["EnterpriseValueEbitda", "EnterpriseValueEBITDA", "EVToEBITDA", "evEbitda"]);
  p.evSales = numFromRow(row, ["EnterpriseValueRevenue", "EnterpriseValueSales", "EVToSales", "evSales"]);
  p.dividendYield = numFromRow(row, ["DividendYield", "ForwardAnnualDividendYield", "Yield"]);

  const evFromRatios = numFromRow(row, [
    "EnterpriseValue",
    "EnterpriseValueUSD",
    "EnterpriseValueMRQ",
    "EnterpriseValueTTM",
    "enterpriseValue",
    "TotalEnterpriseValue",
    "EV",
  ]);
  if (
    evFromRatios != null &&
    Number.isFinite(evFromRatios) &&
    evFromRatios > 0 &&
    (p.enterpriseValue == null || !Number.isFinite(p.enterpriseValue) || p.enterpriseValue <= 0)
  ) {
    p.enterpriseValue = evFromRatios;
  }

  const mc = numFromRow(row, [
    "MarketCapitalization",
    "MarketCapitalisation",
    "MarketCap",
    "marketCap",
    "MarketCapUSD",
    "MarketCapitalizationUSD",
  ]);
  if (
    mc != null &&
    Number.isFinite(mc) &&
    mc > 0 &&
    (p.marketCap == null || !Number.isFinite(p.marketCap) || p.marketCap <= 0)
  ) {
    p.marketCap = mc;
  }

  if (
    (p.forwardPe == null || !Number.isFinite(p.forwardPe) || p.forwardPe <= 0) &&
    forwardEpsFromRow != null &&
    Number.isFinite(forwardEpsFromRow) &&
    forwardEpsFromRow > 0 &&
    p.marketCap != null &&
    Number.isFinite(p.marketCap) &&
    p.marketCap > 0 &&
    p.sharesOutstanding != null &&
    Number.isFinite(p.sharesOutstanding) &&
    p.sharesOutstanding > 1e-6
  ) {
    const v = p.marketCap / (p.sharesOutstanding * forwardEpsFromRow);
    if (Number.isFinite(v) && v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.forwardPe = v;
  }
}

/** When the provider omits market cap on the ratios row, derive from P/S, P/B, or trailing P/E × NI. */
function fillDerivedMarketCap(p: ChartingSeriesPoint): void {
  if (p.marketCap != null && Number.isFinite(p.marketCap) && p.marketCap > 0) return;
  const rev = p.revenue;
  const ps = p.psRatio;
  if (rev != null && ps != null && Number.isFinite(rev) && Number.isFinite(ps) && rev > 0 && ps > 0) {
    p.marketCap = rev * ps;
    return;
  }
  const pb = p.priceBook;
  const eq = p.shareholderEquity;
  if (pb != null && eq != null && Number.isFinite(pb) && Number.isFinite(eq) && Math.abs(eq) > 1e-9 && pb > 0) {
    p.marketCap = pb * Math.abs(eq);
    return;
  }
  const trailPe = p.trailingPe ?? p.peRatio;
  const ni = p.netIncome;
  if (
    trailPe != null &&
    ni != null &&
    ni > 1e-6 &&
    trailPe > 0 &&
    trailPe < MAX_DERIVED_VALUATION_MULTIPLE &&
    Number.isFinite(trailPe) &&
    Number.isFinite(ni)
  ) {
    p.marketCap = trailPe * ni;
  }
}

function computeDerivedMarginsAndReturns(p: ChartingSeriesPoint): void {
  const rev = p.revenue;
  if (rev != null && rev !== 0) {
    if (p.grossProfit != null) p.grossMargin = p.grossProfit / rev;
    if (p.operatingIncome != null) p.operatingMargin = p.operatingIncome / rev;
    if (p.ebitda != null) p.ebitdaMargin = p.ebitda / rev;
    if (p.netIncome != null) p.netMargin = p.netIncome / rev;
    if (p.incomeBeforeTax != null) p.preTaxMargin = p.incomeBeforeTax / rev;
    if (p.freeCashFlow != null) p.fcfMargin = p.freeCashFlow / rev;
  }
  const eq = p.shareholderEquity;
  if (p.netIncome != null && eq != null && Math.abs(eq) > 1e-9) p.returnOnEquity = p.netIncome / Math.abs(eq);
  const ta = p.totalAssets;
  if (p.netIncome != null && ta != null && Math.abs(ta) > 1e-9) p.returnOnAssets = p.netIncome / Math.abs(ta);
  const cl = p.currentLiabilities;
  if (p.operatingIncome != null && ta != null && cl != null) {
    const cap = ta - cl;
    if (Number.isFinite(cap) && Math.abs(cap) > 1e-9) p.returnOnCapitalEmployed = p.operatingIncome / cap;
  }
  const debt = p.totalDebt;
  if (p.netIncome != null && debt != null && eq != null) {
    const invested = Math.abs(debt) + Math.abs(eq);
    if (invested > 1e-9) p.returnOnInvestment = p.netIncome / invested;
  }
  if (debt != null && eq != null && Math.abs(eq) > 1e-9) p.debtToEquity = debt / Math.abs(eq);

  const ni = p.netIncome;
  const dp = p.dividendsPaid;
  if (ni != null && Math.abs(ni) > 1e-9 && dp != null) {
    p.payoutRatio = Math.abs(dp) / Math.abs(ni);
  }

  const cash = p.cashOnHand;
  const td = p.totalDebt;
  if (cash != null && td != null && td > 1e-9) p.cashDebt = cash / td;

  const mcCap = p.marketCap;
  const fcf = p.freeCashFlow;
  if (p.priceFcf == null && mcCap != null && fcf != null && Number.isFinite(mcCap) && Number.isFinite(fcf) && fcf > 1e-9) {
    p.priceFcf = mcCap / fcf;
  }
}

/**
 * When the provider omits reported EPS, approximate diluted EPS as net income ÷ diluted weighted-average
 * shares (preferred) or ÷ period shares outstanding. Good enough for charts when `eps` is absent.
 */
function fillDerivedEpsIfMissing(p: ChartingSeriesPoint): void {
  if (p.eps != null && Number.isFinite(p.eps)) return;
  const ni = p.netIncome;
  const sh = p.sharesOutstanding;
  if (ni == null || sh == null || !Number.isFinite(ni) || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) return;
  p.eps = ni / sh;
}

/**
 * EODHD often omits per-fiscal-period valuation ratios in `Ratios` while statements have revenue, NI, etc.
 * Derive standard multiples from market cap + statements so Key Stats modals can chart history.
 */
function fillDerivedValuationMultiples(p: ChartingSeriesPoint): void {
  const mc = p.marketCap;
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return;

  const ni = p.netIncome;
  let peFromEarnings: number | null = null;
  if (ni != null && Number.isFinite(ni) && ni > 1e-6) {
    const pe = mc / ni;
    if (Number.isFinite(pe) && pe > 0 && pe < MAX_DERIVED_VALUATION_MULTIPLE) peFromEarnings = pe;
  } else {
    const eps = p.eps;
    const sh = p.sharesOutstanding;
    if (eps != null && sh != null && Number.isFinite(eps) && Number.isFinite(sh)) {
      const denom = eps * sh;
      if (denom > 1e-6) {
        const pe = mc / denom;
        if (Number.isFinite(pe) && pe > 0 && pe < MAX_DERIVED_VALUATION_MULTIPLE) peFromEarnings = pe;
      }
    }
  }
  if (peFromEarnings != null) {
    if (p.peRatio == null) p.peRatio = peFromEarnings;
    if (p.trailingPe == null) p.trailingPe = peFromEarnings;
  }

  if (p.peRatio != null && p.trailingPe == null) p.trailingPe = p.peRatio;
  if (p.trailingPe != null && p.peRatio == null) p.peRatio = p.trailingPe;

  const rev = p.revenue;
  if (p.psRatio == null && rev != null && Math.abs(rev) > 1e-9) {
    const ps = mc / Math.abs(rev);
    if (Number.isFinite(ps) && ps > 0 && ps < MAX_DERIVED_VALUATION_MULTIPLE) p.psRatio = ps;
  }

  const eq = p.shareholderEquity;
  if (p.priceBook == null && eq != null && Math.abs(eq) > 1e-9) {
    const pb = mc / Math.abs(eq);
    if (Number.isFinite(pb) && pb > 0 && pb < MAX_DERIVED_VALUATION_MULTIPLE) p.priceBook = pb;
  }

  const debt = p.totalDebt ?? 0;
  const cash = p.cashOnHand ?? 0;
  const ev = mc + debt - cash;
  if (Number.isFinite(ev) && ev > 0) {
    const ebitda = p.ebitda;
    if (p.evEbitda == null && ebitda != null && Math.abs(ebitda) > 1e-9) {
      const v = ev / Math.abs(ebitda);
      if (Number.isFinite(v) && v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.evEbitda = v;
    }
    if (p.evSales == null && rev != null && Math.abs(rev) > 1e-9) {
      const v = ev / Math.abs(rev);
      if (Number.isFinite(v) && v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.evSales = v;
    }
  }
}

/** EV from ratios when present; else MC + debt − cash (same construction as EV ratio helpers). */
function fillDerivedEnterpriseValue(p: ChartingSeriesPoint): void {
  if (p.enterpriseValue != null && Number.isFinite(p.enterpriseValue) && p.enterpriseValue > 0) return;
  const mc = p.marketCap;
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return;
  const ev = mc + (p.totalDebt ?? 0) - (p.cashOnHand ?? 0);
  if (Number.isFinite(ev) && ev > 0) p.enterpriseValue = ev;
}

/**
 * Highlights / Valuation expose a single live forward multiple, but `Financials.Ratios` usually omit
 * `ForwardPE` per fiscal row. After MC + trailing multiples exist, approximate missing fiscal forward
 * P/E with trailing P/E so Key Stats modals can show the same bar pattern as other valuation metrics.
 */
function fillDerivedForwardPe(p: ChartingSeriesPoint): void {
  if (p.forwardPe != null && Number.isFinite(p.forwardPe) && p.forwardPe > 0) return;
  const trail = p.trailingPe ?? p.peRatio;
  if (trail != null && Number.isFinite(trail) && trail > 0 && trail < MAX_DERIVED_VALUATION_MULTIPLE) {
    p.forwardPe = trail;
  }
}

function computeGrowthSeries(points: ChartingSeriesPoint[], mode: FundamentalsSeriesMode): void {
  const yoyLag = mode === "annual" ? 1 : 4;
  const cagrLag = mode === "annual" ? 3 : 12;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i >= yoyLag) {
      const prev = points[i - yoyLag]!;
      if (p.revenue != null && prev.revenue != null && Math.abs(prev.revenue) > 1e-9) {
        p.revenueYoy = (p.revenue - prev.revenue) / Math.abs(prev.revenue);
      }
      if (p.eps != null && prev.eps != null && Math.abs(prev.eps) > 1e-9) {
        p.epsYoy = (p.eps - prev.eps) / Math.abs(prev.eps);
      }
    }
    if (i >= cagrLag) {
      const prev = points[i - cagrLag]!;
      if (p.revenue != null && prev.revenue != null && prev.revenue > 0 && p.revenue > 0) {
        p.revenue3yCagr = Math.pow(p.revenue / prev.revenue, 1 / 3) - 1;
      }
      if (p.eps != null && prev.eps != null && Math.abs(prev.eps) > 1e-9 && p.eps !== 0) {
        p.eps3yCagr = Math.pow(Math.abs(p.eps / prev.eps), 1 / 3) - 1;
        if ((p.eps < 0) !== (prev.eps < 0)) p.eps3yCagr = null;
      }
    }
  }
}

function emptyPoint(periodEnd: string): ChartingSeriesPoint {
  const z = null;
  return {
    periodEnd,
    revenue: z,
    grossProfit: z,
    operatingIncome: z,
    netIncome: z,
    ebitda: z,
    eps: z,
    incomeBeforeTax: z,
    freeCashFlow: z,
    dividendsPaid: z,
    totalAssets: z,
    totalLiabilities: z,
    cashOnHand: z,
    longTermDebt: z,
    shareholderEquity: z,
    currentLiabilities: z,
    totalDebt: z,
    debtToEquity: z,
    sharesOutstanding: z,
    marketCap: z,
    enterpriseValue: z,
    grossMargin: z,
    operatingMargin: z,
    ebitdaMargin: z,
    netMargin: z,
    preTaxMargin: z,
    fcfMargin: z,
    revenueYoy: z,
    revenue3yCagr: z,
    epsYoy: z,
    eps3yCagr: z,
    peRatio: z,
    trailingPe: z,
    forwardPe: z,
    psRatio: z,
    priceBook: z,
    priceFcf: z,
    evEbitda: z,
    evSales: z,
    cashDebt: z,
    dividendYield: z,
    payoutRatio: z,
    returnOnEquity: z,
    returnOnAssets: z,
    returnOnCapitalEmployed: z,
    returnOnInvestment: z,
  };
}

/**
 * Build charting series points from an already-fetched fundamentals root.
 * Use this when you need both annual and quarterly to avoid multiple EODHD fundamentals calls.
 */
export function buildChartingPointsFromFundamentalsRoot(
  root: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
): ChartingSeriesPoint[] {
  return buildMergedPoints(root, mode) ?? [];
}

function buildMergedPoints(root: Record<string, unknown>, mode: FundamentalsSeriesMode): ChartingSeriesPoint[] | null {
  const isBlock = getFinancialBlock(root, "Income_Statement", mode);
  if (!isBlock) return null;

  const bsBlock = getFinancialBlock(root, "Balance_Sheet", mode);
  const cfBlock = getFinancialBlock(root, "Cash_Flow", mode);
  const ratiosBlock = getRatiosBlock(root, mode);

  const keys = Object.keys(isBlock).filter((k) => {
    const v = isBlock[k];
    return v != null && typeof v === "object" && !Array.isArray(v);
  });
  if (!keys.length) return null;
  keys.sort(comparePeriodKeys);

  const out: ChartingSeriesPoint[] = [];
  for (const k of keys) {
    const isRow = isBlock[k];
    if (!isRow || typeof isRow !== "object" || Array.isArray(isRow)) continue;
    const p = emptyPoint(k);
    mergeIncomeRow(p, isRow as Record<string, unknown>);

    if (bsBlock) {
      const bsRow = findRowForPeriodKey(k, bsBlock, mode);
      if (bsRow) mergeBalanceRow(p, bsRow);
    }
    if (cfBlock) {
      const cfRow = findRowForPeriodKey(k, cfBlock, mode);
      if (cfRow) mergeCashFlowRow(p, cfRow);
    }
    if (ratiosBlock) {
      const rr = findRowForPeriodKey(k, ratiosBlock, mode);
      if (rr) mergeRatiosRow(p, rr);
    }

    fillDerivedMarketCap(p);
    computeDerivedMarginsAndReturns(p);
    fillDerivedEpsIfMissing(p);
    fillDerivedValuationMultiples(p);
    fillDerivedEnterpriseValue(p);
    fillDerivedForwardPe(p);
    out.push(p);
  }

  computeGrowthSeries(out, mode);
  return out.length ? out : null;
}

function metricHasSeries(points: ChartingSeriesPoint[], id: ChartingMetricId): boolean {
  const field = CHARTING_METRIC_FIELD[id];
  if (!field) return false;
  return points.some((p) => {
    const v = p[field];
    return typeof v === "number" && Number.isFinite(v);
  });
}

export function computeAvailableMetrics(points: ChartingSeriesPoint[]): ChartingMetricId[] {
  return CHARTING_METRIC_IDS.filter((id) => metricHasSeries(points, id));
}

async function fetchChartingSeriesUncached(
  ticker: string,
  mode: FundamentalsSeriesMode,
): Promise<{ points: ChartingSeriesPoint[]; availableMetrics: ChartingMetricId[] } | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const points = buildMergedPoints(root as Record<string, unknown>, mode);
  if (!points?.length) return null;

  await enrichChartingPointsWithPriceImpliedMarketCap(ticker, points);
  enrichChartingPointsWithTrailingPeFromImpliedMarketCap(points);
  enrichChartingPointsWithImpliedValuationMultiplesFromMarketCap(points);

  const availableMetrics = computeAvailableMetrics(points);
  return { points, availableMetrics };
}

export const fetchChartingSeries = unstable_cache(
  fetchChartingSeriesUncached,
  ["eodhd-charting-series-v16-pe-eps-shares-fallback"],
  { revalidate: REVALIDATE_WARM },
);
