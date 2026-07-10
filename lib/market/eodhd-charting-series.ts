import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";

import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import {
  enrichChartingPointsWithImpliedValuationMultiplesFromMarketCap,
  enrichChartingPointsWithPriceImpliedMarketCap,
  enrichChartingPointsWithTrailingPeFromImpliedMarketCap,
  patchLatestChartingPointLiveTrailingPe,
} from "@/lib/market/charting-price-implied-market-cap";
import { dividendYieldRatioFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-dividends";
import { livePeRatioPartsFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-valuation";
import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import {
  type EarningsActualByPeriod,
  fetchFundamentalsRootForMetrics,
  overlayReportedEarningsOnChartingPoints,
  resolveReportedEarningsActuals,
} from "@/lib/market/earnings-reported-actuals-overlay";
import { limitFundamentalsHistoryPoints } from "@/lib/market/fundamentals-history-limit";
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

/** Provider may send rates as 0.28 or 28.13 — normalize to decimal. */
function normalizeRateDecimal(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const a = Math.abs(raw);
  if (a > 1.5) return raw / 100;
  return raw;
}

function fillDerivedEffectiveTaxRate(p: ChartingSeriesPoint): void {
  if (p.effectiveTaxRate != null && Number.isFinite(p.effectiveTaxRate)) return;
  const tax = p.incomeTaxExpense;
  const pretax = p.incomeBeforeTax;
  if (tax == null || pretax == null || !Number.isFinite(tax) || !Number.isFinite(pretax)) return;
  const denom = Math.abs(pretax);
  if (denom < 1e-9) return;
  p.effectiveTaxRate = Math.abs(tax) / denom;
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
  p.sga = numFromRow(row, [
    "sellingGeneralAdministrative",
    "SellingGeneralAdministrative",
    "sellingGeneralAndAdministrative",
    "SellingGeneralAndAdministrative",
    "sellingGeneralAdmin",
    "SellingGeneralAdmin",
    "generalAndAdministrativeExpense",
    "GeneralAndAdministrativeExpense",
  ]);
  p.researchAndDevelopment = numFromRow(row, [
    "researchDevelopment",
    "ResearchDevelopment",
    "researchAndDevelopment",
    "ResearchAndDevelopment",
    "researchAndDevelopmentExpense",
    "ResearchAndDevelopmentExpense",
  ]);
  p.otherOperatingExpense = numFromRow(row, [
    "otherOperatingExpense",
    "OtherOperatingExpense",
    "otherOperatingExpensesDetail",
    "OtherOperatingExpensesDetail",
    "otherOperatingCosts",
    "OtherOperatingCosts",
  ]);
  p.totalOperatingExpenses = numFromRow(row, [
    "totalOperatingExpenses",
    "TotalOperatingExpenses",
    "operatingExpenses",
    "OperatingExpenses",
  ]);
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
  p.epsBasic = numFromRow(row, [
    "basicEPS",
    "BasicEPS",
    "basicEps",
    "BasicEps",
    "epsBasic",
    "EpsBasic",
    "EPSBasic",
    "EarningsPerShareBasic",
    "earningsPerShareBasic",
  ]);
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
  p.incomeTaxExpense = numFromRow(row, [
    "incomeTaxExpense",
    "IncomeTaxExpense",
    "taxProvision",
    "TaxProvision",
    "provisionForIncomeTaxes",
    "ProvisionForIncomeTaxes",
    "incomeTax",
    "IncomeTax",
  ]);
  p.interestExpense = numFromRow(row, [
    "interestExpense",
    "InterestExpense",
    "interestAndDebtExpense",
    "InterestAndDebtExpense",
    "interestExpenseNet",
    "InterestExpenseNet",
    "netInterestExpense",
    "NetInterestExpense",
    "interestPaid",
    "InterestPaid",
  ]);
  p.effectiveTaxRate = normalizeRateDecimal(
    numFromRow(row, ["effectiveTaxRate", "EffectiveTaxRate", "TaxRate", "taxRate", "effectiveTax", "EffectiveTax"]),
  );
  p.ebit = numFromRow(row, ["ebit", "EBIT", "Ebit"]);
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

  mergeDividendsPerShareFromRow(p, row);
}

const DIVIDENDS_PER_SHARE_KEYS = [
  "dividendPerShare",
  "DividendPerShare",
  "dividendsPerShare",
  "DividendsPerShare",
  "dividendShare",
  "DividendShare",
  "AnnualDividend",
  "ForwardAnnualDividendRate",
  "DividendRate",
  "dividendRate",
];

function mergeDividendsPerShareFromRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  const dps = numFromRow(row, DIVIDENDS_PER_SHARE_KEYS);
  if (dps != null && p.dividendsPerShare == null) p.dividendsPerShare = Math.abs(dps);
}

function mergeBalanceRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  p.totalAssets = numFromRow(row, ["totalAssets", "TotalAssets"]);
  p.totalLiabilities = numFromRow(row, ["totalLiab", "TotalLiab", "totalLiabilities", "TotalLiabilities"]);
  p.cashEquivalents = numFromRow(row, [
    "cash",
    "Cash",
    "cashAndEquivalents",
    "CashAndEquivalents",
    "cashAndCashEquivalents",
    "CashAndCashEquivalents",
    "cashAndCashEquivalentsAtCarryingValue",
    "CashAndCashEquivalentsAtCarryingValue",
  ]);
  p.shortTermInvestments = numFromRow(row, ["shortTermInvestments", "ShortTermInvestments"]);
  p.cashAndShortTermInvestments = numFromRow(row, [
    "cashAndShortTermInvestments",
    "CashAndShortTermInvestments",
  ]);
  p.netReceivables = numFromRow(row, [
    "netReceivables",
    "NetReceivables",
    "accountsReceivable",
    "AccountsReceivable",
    "accountsReceivables",
    "AccountsReceivables",
  ]);
  p.otherReceivables = numFromRow(row, [
    "otherReceivables",
    "OtherReceivables",
    "nonTradeReceivables",
    "NonTradeReceivables",
  ]);
  p.otherCurrentAssets = numFromRow(row, ["otherCurrentAssets", "OtherCurrentAssets"]);
  p.totalCurrentAssets = numFromRow(row, ["totalCurrentAssets", "TotalCurrentAssets"]);
  p.propertyPlantEquipmentNet = numFromRow(row, [
    "propertyPlantEquipment",
    "PropertyPlantEquipment",
    "propertyPlantAndEquipmentNet",
    "PropertyPlantAndEquipmentNet",
    "propertyPlantEquipmentNet",
    "PropertyPlantEquipmentNet",
  ]);
  p.intangibleAssets = numFromRow(row, [
    "intangibleAssets",
    "IntangibleAssets",
    "intangiblesAssets",
    "IntangiblesAssets",
  ]);
  p.goodwill = numFromRow(row, ["goodWill", "GoodWill", "goodwill", "Goodwill"]);
  p.longTermInvestments = numFromRow(row, [
    "longTermInvestments",
    "LongTermInvestments",
    "longTermInvestmentsAndReceivables",
    "LongTermInvestmentsAndReceivables",
  ]);
  p.otherNonCurrentAssets = numFromRow(row, [
    "otherAssets",
    "OtherAssets",
    "otherNonCurrentAssets",
    "OtherNonCurrentAssets",
    "nonCurrentAssetsOther",
    "NonCurrentAssetsOther",
  ]);
  p.accountsPayable = numFromRow(row, ["accountsPayable", "AccountsPayable"]);
  p.accruedLiabilities = numFromRow(row, [
    "accruedLiabilities",
    "AccruedLiabilities",
    "accruedExpenses",
    "AccruedExpenses",
    "accruedLiabilitiesCurrent",
    "AccruedLiabilitiesCurrent",
    "totalAccruedExpenses",
    "TotalAccruedExpenses",
    "accruedExpensesTotal",
    "AccruedExpensesTotal",
  ]);
  p.otherCurrentLiabilities = numFromRow(row, [
    "otherCurrentLiab",
    "OtherCurrentLiab",
    "otherCurrentLiabilities",
    "OtherCurrentLiabilities",
  ]);
  p.longTermDebt = numFromRow(row, [
    "longTermDebt",
    "LongTermDebt",
    "longTermDebtNoncurrent",
    "LongTermDebtNoncurrent",
    "longTermDebtTotal",
    "LongTermDebtTotal",
  ]);
  p.shareholderEquity = numFromRow(row, [
    "totalStockholderEquity",
    "TotalStockholderEquity",
    "totalStockholdersEquity",
    "TotalStockholdersEquity",
    "ShareholdersEquity",
    "ShareHolderEquity",
    "totalEquity",
    "TotalEquity",
  ]);
  p.currentLiabilities = numFromRow(row, [
    "totalCurrentLiabilities",
    "TotalCurrentLiabilities",
    "currentLiabilities",
    "CurrentLiabilities",
  ]);
  p.nonCurrentLiabilities = numFromRow(row, [
    "nonCurrentLiabilitiesTotal",
    "NonCurrentLiabilitiesTotal",
    "nonCurrentLiabilities",
    "NonCurrentLiabilities",
    "totalNonCurrentLiabilities",
    "TotalNonCurrentLiabilities",
  ]);
  p.treasuryStock = numFromRow(row, [
    "treasuryStock",
    "TreasuryStock",
    "commonStockHeldByTreasury",
    "CommonStockHeldByTreasury",
    "treasuryShares",
    "TreasuryShares",
  ]);
  p.additionalPaidInCapital = numFromRow(row, [
    "additionalPaidInCapital",
    "AdditionalPaidInCapital",
    "capitalSurpluse",
    "CapitalSurpluse",
    "capitalSurplus",
    "CapitalSurplus",
  ]);
  p.netDebt = numFromRow(row, ["netDebt", "NetDebt"]);
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
  p.tangibleBookValue = numFromRow(row, [
    "tangibleBookValue",
    "TangibleBookValue",
    "netTangibleAssets",
    "NetTangibleAssets",
    "tangibleAssetsNet",
    "TangibleAssetsNet",
  ]);
}

function mergeCashFlowRow(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  const cfNi = numFromRow(row, [
    "netIncome",
    "NetIncome",
    "netIncomeApplicableToCommonShares",
    "NetIncomeApplicableToCommonShares",
  ]);
  if (cfNi != null) p.netIncome = cfNi;

  p.cfDepreciationAmortization = numFromRow(row, [
    "depreciation",
    "Depreciation",
    "depreciationAndAmortization",
    "DepreciationAndAmortization",
    "reconciledDepreciation",
    "ReconciledDepreciation",
  ]);
  p.cfStockBasedCompensation = numFromRow(row, [
    "stockBasedCompensation",
    "StockBasedCompensation",
    "stockBasedComp",
    "StockBasedComp",
  ]);
  p.cfOtherNonCashItems = numFromRow(row, [
    "otherNonCashItems",
    "OtherNonCashItems",
    "otherNonCashCharges",
    "OtherNonCashCharges",
    "effectOfAccountingCharges",
    "EffectOfAccountingCharges",
  ]);
  p.cfChangeInReceivables = numFromRow(row, [
    "changeToAccountReceivables",
    "ChangeToAccountReceivables",
    "changeReceivables",
    "ChangeReceivables",
    "changeInReceivables",
    "ChangeInReceivables",
  ]);
  p.cfChangeInAccountsPayable = numFromRow(row, [
    "changeToLiabilities",
    "ChangeToLiabilities",
    "changeInAccountsPayable",
    "ChangeInAccountsPayable",
    "changeInAccountsPayables",
    "ChangeInAccountsPayables",
  ]);
  p.cfChangeInOtherOperating = numFromRow(row, [
    "changeToOperatingActivities",
    "ChangeToOperatingActivities",
    "changeInOtherOperatingActivities",
    "ChangeInOtherOperatingActivities",
  ]);
  p.cfOtherOperatingCashFlow = numFromRow(row, [
    "cashFlowsOtherOperating",
    "CashFlowsOtherOperating",
    "otherOperatingCashFlow",
    "OtherOperatingCashFlow",
  ]);
  p.cfChangeInWorkingCapital = numFromRow(row, ["changeInWorkingCapital", "ChangeInWorkingCapital"]);
  p.operatingCashFlow = numFromRow(row, [
    "totalCashFromOperatingActivities",
    "TotalCashFromOperatingActivities",
    "netCashProvidedByOperatingActivities",
    "NetCashProvidedByOperatingActivities",
    "cashFromOperations",
    "CashFromOperations",
  ]);

  p.capitalExpenditures = numFromRow(row, [
    "capitalExpenditures",
    "CapitalExpenditures",
    "capitalExpenditure",
    "CapitalExpenditure",
    "capex",
    "Capex",
  ]);
  p.cfSaleOfPpe = numFromRow(row, [
    "saleOfPropertyPlantAndEquipment",
    "SaleOfPropertyPlantAndEquipment",
    "proceedsFromSaleOfPropertyPlantAndEquipment",
    "ProceedsFromSaleOfPropertyPlantAndEquipment",
    "salesOfPropertyPlantAndEquipment",
    "SalesOfPropertyPlantAndEquipment",
  ]);
  p.cfPurchasesOfInvestments = numFromRow(row, [
    "purchasesOfInvestments",
    "PurchasesOfInvestments",
    "purchaseOfInvestments",
    "PurchaseOfInvestments",
    "paymentsToAcquireInvestments",
    "PaymentsToAcquireInvestments",
  ]);
  p.cfProceedsFromInvestments = numFromRow(row, [
    "proceedsFromSaleOfInvestments",
    "ProceedsFromSaleOfInvestments",
    "salesOfInvestments",
    "SalesOfInvestments",
    "proceedsFromInvestments",
    "ProceedsFromInvestments",
  ]);
  p.cfPaymentsForAcquisitions = numFromRow(row, [
    "paymentsToAcquireBusinesses",
    "PaymentsToAcquireBusinesses",
    "acquisitionsNet",
    "AcquisitionsNet",
    "paymentsForBusinessAcquisitions",
    "PaymentsForBusinessAcquisitions",
  ]);
  p.cfProceedsFromDivestitures = numFromRow(row, [
    "proceedsFromDivestitures",
    "ProceedsFromDivestitures",
    "proceedsFromSaleOfBusiness",
    "ProceedsFromSaleOfBusiness",
    "divestitures",
    "Divestitures",
  ]);
  p.cfInvestments = numFromRow(row, ["investments", "Investments"]);
  p.cfOtherInvestingCashFlow = numFromRow(row, [
    "otherCashflowsFromInvestingActivities",
    "OtherCashflowsFromInvestingActivities",
    "otherInvestingCashFlow",
    "OtherInvestingCashFlow",
  ]);
  p.investingCashFlow = numFromRow(row, [
    "totalCashflowsFromInvestingActivities",
    "TotalCashflowsFromInvestingActivities",
    "netCashUsedForInvestingActivities",
    "NetCashUsedForInvestingActivities",
    "totalCashFromInvestingActivities",
    "TotalCashFromInvestingActivities",
  ]);

  p.cfShortTermDebtIssued = numFromRow(row, [
    "shortTermDebtIssued",
    "ShortTermDebtIssued",
    "issuanceOfShortTermDebt",
    "IssuanceOfShortTermDebt",
    "proceedsFromShortTermDebt",
    "ProceedsFromShortTermDebt",
  ]);
  p.cfShortTermDebtRepaid = numFromRow(row, [
    "shortTermDebtRepaid",
    "ShortTermDebtRepaid",
    "repaymentOfShortTermDebt",
    "RepaymentOfShortTermDebt",
    "paymentsOfShortTermDebt",
    "PaymentsOfShortTermDebt",
  ]);
  p.cfLongTermDebtIssued = numFromRow(row, [
    "longTermDebtIssued",
    "LongTermDebtIssued",
    "issuanceOfLongTermDebt",
    "IssuanceOfLongTermDebt",
    "proceedsFromLongTermDebt",
    "ProceedsFromLongTermDebt",
  ]);
  p.cfLongTermDebtRepaid = numFromRow(row, [
    "longTermDebtRepaid",
    "LongTermDebtRepaid",
    "repaymentOfLongTermDebt",
    "RepaymentOfLongTermDebt",
    "paymentsOfLongTermDebt",
    "PaymentsOfLongTermDebt",
  ]);
  p.cfNetDebtIssued = numFromRow(row, ["netBorrowings", "NetBorrowings", "netDebtIssued", "NetDebtIssued"]);
  p.cfIssuanceOfCommonStock = numFromRow(row, [
    "issuanceOfCapitalStock",
    "IssuanceOfCapitalStock",
    "issuanceOfCommonStock",
    "IssuanceOfCommonStock",
    "proceedsFromIssuanceOfCommonStock",
    "ProceedsFromIssuanceOfCommonStock",
  ]);
  p.cfRepurchaseOfCommonStock = numFromRow(row, [
    "repurchaseOfCommonStock",
    "RepurchaseOfCommonStock",
    "paymentsForRepurchaseOfCommonStock",
    "PaymentsForRepurchaseOfCommonStock",
    "commonStockRepurchased",
    "CommonStockRepurchased",
  ]);
  p.cfNetCommonStock = numFromRow(row, [
    "salePurchaseOfStock",
    "SalePurchaseOfStock",
    "netIssuanceOfCommonStock",
    "NetIssuanceOfCommonStock",
    "netCommonStockIssuance",
    "NetCommonStockIssuance",
  ]);
  p.cfOtherFinancingCashFlow = numFromRow(row, [
    "otherCashflowsFromFinancingActivities",
    "OtherCashflowsFromFinancingActivities",
    "otherFinancingCashFlow",
    "OtherFinancingCashFlow",
  ]);
  p.financingCashFlow = numFromRow(row, [
    "totalCashFromFinancingActivities",
    "TotalCashFromFinancingActivities",
    "netCashProvidedByFinancingActivities",
    "NetCashProvidedByFinancingActivities",
  ]);

  const div = numFromRow(row, [
    "dividendsPaid",
    "DividendsPaid",
    "cashDividendsPaid",
    "CashDividendsPaid",
    "commonDividendsPaid",
    "CommonDividendsPaid",
  ]);
  if (div != null) p.dividendsPaid = div;

  p.changeInCash = numFromRow(row, [
    "changeInCash",
    "ChangeInCash",
    "cashAndCashEquivalentsChanges",
    "CashAndCashEquivalentsChanges",
    "netChangeInCash",
    "NetChangeInCash",
  ]);
  p.cfExchangeRateEffect = numFromRow(row, [
    "exchangeRateChanges",
    "ExchangeRateChanges",
    "effectOfExchangeRateChanges",
    "EffectOfExchangeRateChanges",
  ]);

  const fcf = numFromRow(row, [
    "freeCashFlow",
    "FreeCashFlow",
    "freeCashFlowFromContinuingOperations",
    "FreeCashFlows",
  ]);
  if (fcf != null) p.freeCashFlow = fcf;

  p.leveredFreeCashFlow = numFromRow(row, [
    "leveredFreeCashFlow",
    "LeveredFreeCashFlow",
    "leveredFCF",
    "LeveredFCF",
  ]);
  p.unleveredFreeCashFlow = numFromRow(row, [
    "unleveredFreeCashFlow",
    "UnleveredFreeCashFlow",
    "unleveredFCF",
    "UnleveredFCF",
  ]);
  p.fcfPerShare = numFromRow(row, [
    "freeCashFlowPerShare",
    "FreeCashFlowPerShare",
    "fcfPerShare",
    "FcfPerShare",
  ]);
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
  mergeDividendsPerShareFromRow(p, row);

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

  p.pegRatio = numFromRow(row, ["PEGRatio", "PEG", "pegRatio", "PegRatio", "priceEarningsToGrowth"]);
  p.priceToTangibleBook = numFromRow(row, [
    "PriceToTangibleBook",
    "PriceToTangibleBookMRQ",
    "PriceTangibleBook",
    "PTBVRatio",
    "priceToTangibleBook",
  ]);
  p.priceOcf = numFromRow(row, [
    "PriceToOperatingCashFlow",
    "PriceOperatingCashFlow",
    "PriceOCF",
    "PriceToOCF",
    "priceToOperatingCashFlow",
  ]);
  if (p.priceOcf == null) {
    const pcf = numFromRow(row, ["PriceCashFlow", "PriceToCashFlow", "PriceToCashFlowsTTM"]);
    if (pcf != null) p.priceOcf = pcf;
  }
  p.evToEbit = numFromRow(row, [
    "EnterpriseValueEbit",
    "EnterpriseValueEBIT",
    "EVToEBIT",
    "EVToEbit",
    "evToEbit",
  ]);
  p.evToFcf = numFromRow(row, [
    "EnterpriseValueFreeCashFlow",
    "EnterpriseValueFCF",
    "EVToFCF",
    "EVToFreeCashFlow",
    "evToFcf",
  ]);
  p.quickRatio = numFromRow(row, ["QuickRatio", "quickRatio"]);
  p.currentRatio = numFromRow(row, ["CurrentRatio", "currentRatio"]);
  p.returnOnInvestedCapital = numFromRow(row, [
    "ReturnOnInvestedCapital",
    "ROIC",
    "roic",
    "ReturnOnInvestmentCapital",
  ]);
  p.earningsYield = numFromRow(row, [
    "EarningsYield",
    "earningsYield",
    "EarningYield",
    "earningsYieldTTM",
  ]);
  p.assetTurnover = numFromRow(row, ["AssetTurnover", "assetTurnover", "TotalAssetTurnover"]);
  p.debtToEbitda = numFromRow(row, ["DebtToEBITDA", "debtToEbitda", "DebtEBITDA"]);
  p.debtToFcf = numFromRow(row, ["DebtToFCF", "debtToFcf", "DebtFCF"]);
  p.netDebtToEquity = numFromRow(row, ["NetDebtToEquity", "netDebtToEquity"]);
  p.netDebtToEbitda = numFromRow(row, ["NetDebtToEBITDA", "netDebtToEbitda"]);
  p.netDebtToFcf = numFromRow(row, ["NetDebtToFCF", "netDebtToFcf"]);
  p.fcfYield = numFromRow(row, ["FreeCashFlowYield", "FCFYield", "fcfYield", "FCFYieldTTM"]);
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

  fillDerivedBalanceFields(p);
  fillDerivedCashFlowFields(p);

  fillDerivedEffectiveTaxRate(p);

  const ni = p.netIncome;
  const dp = p.dividendsPaid;
  if (ni != null && Math.abs(ni) > 1e-9 && dp != null) {
    p.payoutRatio = Math.abs(dp) / Math.abs(ni);
  }

  const ocf = p.operatingCashFlow;
  if (ocf != null && ni != null && Math.abs(ni) > 1e-9) {
    p.cashConversion = ocf / ni;
  }

  const ebitForCover = p.ebit ?? p.operatingIncome;
  const interest = p.interestExpense;
  if (ebitForCover != null && interest != null && Math.abs(interest) > 1e-9) {
    p.interestCover = ebitForCover / Math.abs(interest);
  }

  const cash = p.cashAndShortTermInvestments ?? p.cashOnHand;
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
function fillDerivedCashFlowFields(p: ChartingSeriesPoint): void {
  if (p.cfNetCommonStock != null) {
    if (p.cfIssuanceOfCommonStock == null && p.cfRepurchaseOfCommonStock == null) {
      if (p.cfNetCommonStock > 0) p.cfIssuanceOfCommonStock = p.cfNetCommonStock;
      else if (p.cfNetCommonStock < 0) p.cfRepurchaseOfCommonStock = p.cfNetCommonStock;
    }
  }

  if (p.freeCashFlow == null && p.operatingCashFlow != null && p.capitalExpenditures != null) {
    const capex = p.capitalExpenditures;
    p.freeCashFlow = p.operatingCashFlow - Math.abs(capex);
  }

  if (p.leveredFreeCashFlow == null && p.freeCashFlow != null) {
    p.leveredFreeCashFlow = p.freeCashFlow;
  }

  if (p.fcfPerShare == null && p.freeCashFlow != null && p.sharesOutstanding != null) {
    const sh = p.sharesOutstanding;
    if (Number.isFinite(sh) && Math.abs(sh) > 1e-9) p.fcfPerShare = p.freeCashFlow / sh;
  }
}

function fillDerivedBalanceFields(p: ChartingSeriesPoint): void {
  if (p.cashAndShortTermInvestments == null) {
    if (p.cashEquivalents != null || p.shortTermInvestments != null) {
      p.cashAndShortTermInvestments = (p.cashEquivalents ?? 0) + (p.shortTermInvestments ?? 0);
    }
  }
  if (p.cashOnHand == null) {
    p.cashOnHand = p.cashAndShortTermInvestments ?? p.cashEquivalents;
  }

  if (p.otherCurrentLiabilities == null && p.currentLiabilities != null) {
    const ap = p.accountsPayable;
    const acc = p.accruedLiabilities;
    if (ap != null || acc != null) {
      p.otherCurrentLiabilities = p.currentLiabilities - (ap ?? 0) - (acc ?? 0);
    }
  }

  if (p.nonCurrentLiabilities == null && p.totalLiabilities != null && p.currentLiabilities != null) {
    p.nonCurrentLiabilities = p.totalLiabilities - p.currentLiabilities;
  }

  if (p.bookValue == null && p.shareholderEquity != null) p.bookValue = p.shareholderEquity;

  if (p.tangibleBookValue == null && p.shareholderEquity != null) {
    const gw = p.goodwill;
    const ia = p.intangibleAssets;
    const hasIntangibles =
      (gw != null && Number.isFinite(gw) && Math.abs(gw) > 1e-9) ||
      (ia != null && Number.isFinite(ia) && Math.abs(ia) > 1e-9);
    if (hasIntangibles) {
      p.tangibleBookValue =
        p.shareholderEquity - Math.abs(gw ?? 0) - Math.abs(ia ?? 0);
    }
  }
}

function fillDerivedEpsBasicIfMissing(p: ChartingSeriesPoint, row: Record<string, unknown>): void {
  if (p.epsBasic != null && Number.isFinite(p.epsBasic)) return;
  const ni = p.netIncome;
  if (ni == null || !Number.isFinite(ni)) return;
  const basicSh = numFromRow(row, [
    "weightedAverageShsOut",
    "WeightedAverageShsOut",
    "weightedAverageShares",
    "WeightedAverageShares",
    "weightedAverageSharesBasic",
    "WeightedAverageSharesBasic",
    "sharesOutstandingBasic",
    "SharesOutstandingBasic",
  ]);
  const sh = basicSh ?? p.sharesOutstanding;
  if (sh == null || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) return;
  p.epsBasic = ni / sh;
}

function fillDerivedEpsIfMissing(p: ChartingSeriesPoint): void {
  if (p.eps != null && Number.isFinite(p.eps)) return;
  const ni = p.netIncome;
  const sh = p.sharesOutstanding;
  if (ni == null || sh == null || !Number.isFinite(ni) || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) return;
  p.eps = ni / sh;
}

/** `dividendsPaid` ÷ diluted shares when per-share dividend is absent on statements/ratios. */
function fillDerivedDividendsPerShare(p: ChartingSeriesPoint): void {
  if (p.dividendsPerShare != null && Number.isFinite(p.dividendsPerShare)) return;
  const dp = p.dividendsPaid;
  const sh = p.sharesOutstanding;
  if (dp == null || sh == null || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) return;
  const dps = Math.abs(dp) / Math.abs(sh);
  if (Number.isFinite(dps)) p.dividendsPerShare = dps;
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

const MAX_REASONABLE_YIELD_RATIO = 0.35;

/** Normalize provider yield (decimal 0.011 = 1.1% vs occasional whole-percent 1.1). */
function normalizeDividendYieldRatio(v: number): number | null {
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v > 1 && v <= 100) return v / 100;
  if (v > 100) return null;
  return v;
}

function impliedSharePriceFromPoint(p: ChartingSeriesPoint): number | null {
  const mc = p.marketCap;
  const sh = p.sharesOutstanding;
  if (mc == null || sh == null || !Number.isFinite(mc) || !Number.isFinite(sh) || Math.abs(sh) < 1e-9) {
    return null;
  }
  return mc / sh;
}

/** When `Financials.Ratios` omits dividend yield, derive from DPS ÷ price or cash dividends ÷ market cap. */
function fillDerivedDividendYield(p: ChartingSeriesPoint): void {
  const existing = p.dividendYield;
  if (existing != null && Number.isFinite(existing) && existing > 0) {
    const norm = normalizeDividendYieldRatio(existing);
    if (norm != null && norm < MAX_REASONABLE_YIELD_RATIO) {
      p.dividendYield = norm;
      return;
    }
  }

  const price = impliedSharePriceFromPoint(p);
  const dps = p.dividendsPerShare;
  if (dps != null && dps > 0 && price != null && price > 0) {
    const y = dps / price;
    if (Number.isFinite(y) && y > 0 && y < MAX_REASONABLE_YIELD_RATIO) {
      p.dividendYield = y;
      return;
    }
  }

  const mc = p.marketCap;
  const dp = p.dividendsPaid;
  if (mc != null && mc > 0 && dp != null && Math.abs(dp) > 0) {
    const y = Math.abs(dp) / mc;
    if (Number.isFinite(y) && y > 0 && y < MAX_REASONABLE_YIELD_RATIO) p.dividendYield = y;
  }
}

function patchLatestChartingPointLiveDividendYield(
  points: ChartingSeriesPoint[],
  yieldRatio: number | null,
): void {
  const y = yieldRatio != null ? normalizeDividendYieldRatio(yieldRatio) : null;
  if (y == null) return;
  if (points.length === 0) return;
  const sorted = [...points].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const last = sorted[sorted.length - 1]!;
  last.dividendYield = y;
}

/** Ratios table fields — derived when EODHD omits per-period values on `Financials.Ratios`. */
function fillDerivedRatioTableFields(p: ChartingSeriesPoint): void {
  fillDerivedDividendYield(p);

  const mc = p.marketCap;
  const pe = p.trailingPe ?? p.peRatio;
  if (p.earningsYield == null && pe != null && pe > 1e-9 && pe < MAX_DERIVED_VALUATION_MULTIPLE) {
    p.earningsYield = 1 / pe;
  }
  if (p.fcfYield == null && mc != null && mc > 0 && p.freeCashFlow != null && p.freeCashFlow > 1e-9) {
    p.fcfYield = p.freeCashFlow / mc;
  }

  const ebit = p.ebit ?? p.operatingIncome;
  const ta = p.totalAssets;
  const tca = p.totalCurrentAssets;
  if (p.returnOnInvestedCapital == null && ebit != null && ta != null && tca != null) {
    const invested = ta - tca;
    if (Math.abs(invested) > 1e-9) p.returnOnInvestedCapital = ebit / invested;
  }

  if (p.assetTurnover == null && p.revenue != null && ta != null && Math.abs(ta) > 1e-9) {
    p.assetTurnover = p.revenue / Math.abs(ta);
  }

  if (p.priceToTangibleBook == null && mc != null && mc > 0 && p.tangibleBookValue != null && Math.abs(p.tangibleBookValue) > 1e-9) {
    const v = mc / Math.abs(p.tangibleBookValue);
    if (v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.priceToTangibleBook = v;
  }

  if (p.priceOcf == null && mc != null && mc > 0 && p.operatingCashFlow != null && p.operatingCashFlow > 1e-9) {
    const v = mc / p.operatingCashFlow;
    if (v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.priceOcf = v;
  }

  const ev = p.enterpriseValue;
  if (ev != null && ev > 0) {
    if (p.evToEbit == null && ebit != null && Math.abs(ebit) > 1e-9) {
      const v = ev / Math.abs(ebit);
      if (v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.evToEbit = v;
    }
    if (p.evToFcf == null && p.freeCashFlow != null && p.freeCashFlow > 1e-9) {
      const v = ev / p.freeCashFlow;
      if (v > 0 && v < MAX_DERIVED_VALUATION_MULTIPLE) p.evToFcf = v;
    }
  }

  const debt = p.totalDebt;
  if (debt != null) {
    if (p.debtToEbitda == null && p.ebitda != null && Math.abs(p.ebitda) > 1e-9) {
      p.debtToEbitda = debt / Math.abs(p.ebitda);
    }
    if (p.debtToFcf == null && p.freeCashFlow != null && p.freeCashFlow > 1e-9) {
      p.debtToFcf = debt / p.freeCashFlow;
    }
  }

  const cash = p.cashAndShortTermInvestments ?? p.cashOnHand;
  const netDebt =
    p.netDebt != null
      ? p.netDebt
      : debt != null || cash != null
        ? (debt ?? 0) - (cash ?? 0)
        : null;
  const eq = p.shareholderEquity;
  if (netDebt != null) {
    if (p.netDebtToEquity == null && eq != null && Math.abs(eq) > 1e-9) {
      p.netDebtToEquity = netDebt / Math.abs(eq);
    }
    if (p.netDebtToEbitda == null && p.ebitda != null && Math.abs(p.ebitda) > 1e-9) {
      p.netDebtToEbitda = netDebt / Math.abs(p.ebitda);
    }
    if (p.netDebtToFcf == null && p.freeCashFlow != null && p.freeCashFlow > 1e-9) {
      p.netDebtToFcf = netDebt / p.freeCashFlow;
    }
  }

  if (p.pegRatio == null && pe != null && pe > 0 && p.epsYoy != null && Math.abs(p.epsYoy) > 1e-6) {
    const growthPct = Math.abs(p.epsYoy) * 100;
    const peg = pe / growthPct;
    if (Number.isFinite(peg) && peg > 0 && peg < MAX_DERIVED_VALUATION_MULTIPLE) p.pegRatio = peg;
  }
}

function computeGrowthSeries(points: ChartingSeriesPoint[], mode: FundamentalsSeriesMode): void {
  const yoyLag = mode === "annual" ? 1 : 4;
  const cagr3Lag = mode === "annual" ? 3 : 12;
  const cagr5Lag = mode === "annual" ? 5 : 20;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i >= yoyLag) {
      const prev = points[i - yoyLag]!;
      if (p.revenue != null && prev.revenue != null && Math.abs(prev.revenue) > 1e-9) {
        p.revenueYoy = (p.revenue - prev.revenue) / Math.abs(prev.revenue);
      }
      if (p.grossProfit != null && prev.grossProfit != null && Math.abs(prev.grossProfit) > 1e-9) {
        p.grossProfitYoy = (p.grossProfit - prev.grossProfit) / Math.abs(prev.grossProfit);
      }
      if (p.eps != null && prev.eps != null && Math.abs(prev.eps) > 1e-9) {
        p.epsYoy = (p.eps - prev.eps) / Math.abs(prev.eps);
      }
      if (
        p.dividendsPerShare != null &&
        prev.dividendsPerShare != null &&
        Math.abs(prev.dividendsPerShare) > 1e-9
      ) {
        p.dividendsPerShareYoy =
          (p.dividendsPerShare - prev.dividendsPerShare) / Math.abs(prev.dividendsPerShare);
      }
      if (p.netIncome != null && prev.netIncome != null && Math.abs(prev.netIncome) > 1e-9) {
        p.netIncomeYoy = (p.netIncome - prev.netIncome) / Math.abs(prev.netIncome);
      }
      if (
        p.sharesOutstanding != null &&
        prev.sharesOutstanding != null &&
        Math.abs(prev.sharesOutstanding) > 1e-9
      ) {
        p.sharesOutstandingYoy =
          (p.sharesOutstanding - prev.sharesOutstanding) / Math.abs(prev.sharesOutstanding);
      }
      if (p.marketCap != null && prev.marketCap != null && Math.abs(prev.marketCap) > 1e-9) {
        p.marketCapYoy = (p.marketCap - prev.marketCap) / Math.abs(prev.marketCap);
      }
      if (
        p.operatingCashFlow != null &&
        prev.operatingCashFlow != null &&
        Math.abs(prev.operatingCashFlow) > 1e-9
      ) {
        p.operatingCashFlowYoy =
          (p.operatingCashFlow - prev.operatingCashFlow) / Math.abs(prev.operatingCashFlow);
      }
      if (p.freeCashFlow != null && prev.freeCashFlow != null && Math.abs(prev.freeCashFlow) > 1e-9) {
        p.freeCashFlowYoy = (p.freeCashFlow - prev.freeCashFlow) / Math.abs(prev.freeCashFlow);
      }
    }
    if (i >= cagr3Lag) {
      const prev = points[i - cagr3Lag]!;
      if (p.revenue != null && prev.revenue != null && prev.revenue > 0 && p.revenue > 0) {
        p.revenue3yCagr = Math.pow(p.revenue / prev.revenue, 1 / 3) - 1;
      }
      if (p.eps != null && prev.eps != null && Math.abs(prev.eps) > 1e-9 && p.eps !== 0) {
        p.eps3yCagr = Math.pow(Math.abs(p.eps / prev.eps), 1 / 3) - 1;
        if ((p.eps < 0) !== (prev.eps < 0)) p.eps3yCagr = null;
      }
    }
    if (i >= cagr5Lag) {
      const prev = points[i - cagr5Lag]!;
      if (p.eps != null && prev.eps != null && Math.abs(prev.eps) > 1e-9 && p.eps !== 0) {
        p.eps5yCagr = Math.pow(Math.abs(p.eps / prev.eps), 1 / 5) - 1;
        if ((p.eps < 0) !== (prev.eps < 0)) p.eps5yCagr = null;
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
    sga: z,
    researchAndDevelopment: z,
    otherOperatingExpense: z,
    totalOperatingExpenses: z,
    operatingIncome: z,
    ebit: z,
    netIncome: z,
    ebitda: z,
    eps: z,
    epsBasic: z,
    incomeBeforeTax: z,
    incomeTaxExpense: z,
    interestExpense: z,
    effectiveTaxRate: z,
    freeCashFlow: z,
    dividendsPaid: z,
    dividendsPerShare: z,
    cfDepreciationAmortization: z,
    cfStockBasedCompensation: z,
    cfOtherNonCashItems: z,
    cfChangeInReceivables: z,
    cfChangeInAccountsPayable: z,
    cfChangeInOtherOperating: z,
    cfOtherOperatingCashFlow: z,
    cfChangeInWorkingCapital: z,
    operatingCashFlow: z,
    capitalExpenditures: z,
    cfSaleOfPpe: z,
    cfPurchasesOfInvestments: z,
    cfProceedsFromInvestments: z,
    cfPaymentsForAcquisitions: z,
    cfProceedsFromDivestitures: z,
    cfInvestments: z,
    cfOtherInvestingCashFlow: z,
    investingCashFlow: z,
    cfShortTermDebtIssued: z,
    cfShortTermDebtRepaid: z,
    cfLongTermDebtIssued: z,
    cfLongTermDebtRepaid: z,
    cfNetDebtIssued: z,
    cfIssuanceOfCommonStock: z,
    cfRepurchaseOfCommonStock: z,
    cfNetCommonStock: z,
    cfOtherFinancingCashFlow: z,
    financingCashFlow: z,
    changeInCash: z,
    cfExchangeRateEffect: z,
    fcfPerShare: z,
    leveredFreeCashFlow: z,
    unleveredFreeCashFlow: z,
    totalAssets: z,
    totalLiabilities: z,
    cashEquivalents: z,
    cashOnHand: z,
    shortTermInvestments: z,
    cashAndShortTermInvestments: z,
    netReceivables: z,
    otherReceivables: z,
    otherCurrentAssets: z,
    totalCurrentAssets: z,
    propertyPlantEquipmentNet: z,
    intangibleAssets: z,
    goodwill: z,
    longTermInvestments: z,
    otherNonCurrentAssets: z,
    accountsPayable: z,
    accruedLiabilities: z,
    otherCurrentLiabilities: z,
    nonCurrentLiabilities: z,
    longTermDebt: z,
    shareholderEquity: z,
    currentLiabilities: z,
    totalDebt: z,
    debtToEquity: z,
    treasuryStock: z,
    additionalPaidInCapital: z,
    netDebt: z,
    bookValue: z,
    tangibleBookValue: z,
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
    grossProfitYoy: z,
    epsYoy: z,
    eps3yCagr: z,
    eps5yCagr: z,
    dividendsPerShareYoy: z,
    netIncomeYoy: z,
    sharesOutstandingYoy: z,
    marketCapYoy: z,
    operatingCashFlowYoy: z,
    freeCashFlowYoy: z,
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
    pegRatio: z,
    priceToTangibleBook: z,
    priceOcf: z,
    evToEbit: z,
    evToFcf: z,
    debtToEbitda: z,
    debtToFcf: z,
    netDebtToEquity: z,
    netDebtToEbitda: z,
    netDebtToFcf: z,
    assetTurnover: z,
    quickRatio: z,
    currentRatio: z,
    returnOnInvestedCapital: z,
    earningsYield: z,
    fcfYield: z,
    cashConversion: z,
    interestCover: z,
    drawdown: z,
  };
}

/**
 * Build charting series points from an already-fetched fundamentals root.
 * Use this when you need both annual and quarterly to avoid multiple EODHD fundamentals calls.
 */
export function buildChartingPointsFromFundamentalsRoot(
  root: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
  earningsActuals?: EarningsActualByPeriod | null,
): ChartingSeriesPoint[] {
  const points = buildMergedPoints(root, mode);
  if (!points?.length) return [];
  return finalizeChartingPointsWithEarningsOverlay(points, root, mode, earningsActuals ?? new Map());
}

function getFinancialStatementRoot(
  root: Record<string, unknown>,
  statement: "Income_Statement" | "Balance_Sheet" | "Cash_Flow",
): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const f = fin as Record<string, unknown>;
  const aliases: Record<string, string[]> = {
    Income_Statement: ["Income_Statement", "IncomeStatement"],
    Balance_Sheet: ["Balance_Sheet", "BalanceSheet"],
    Cash_Flow: ["Cash_Flow", "CashFlow"],
  };
  for (const a of aliases[statement]) {
    const raw = f[a];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  }
  return null;
}

function getRatiosStatementRoot(root: Record<string, unknown>): Record<string, unknown> | null {
  const fin = root.Financials;
  if (!fin || typeof fin !== "object") return null;
  const raw = (fin as Record<string, unknown>).Ratios ?? (fin as Record<string, unknown>).Financial_Ratios;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function pickTtmSubRow(wrapper: Record<string, unknown>): Record<string, unknown> | null {
  const ttm = wrapper.ttm ?? wrapper.TTM ?? wrapper.trailing_twelve_months;
  if (ttm && typeof ttm === "object" && !Array.isArray(ttm)) return ttm as Record<string, unknown>;
  return null;
}

function periodEndKeyFromTtmRow(row: Record<string, unknown>, root: Record<string, unknown>): string {
  for (const k of ["date", "Date", "periodEnd", "period_end", "endDate", "filing_date", "FilingDate"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const hl =
    root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const mq = hl?.MostRecentQuarter;
  if (typeof mq === "string" && mq.trim()) return mq.trim();
  return "TTM";
}

/**
 * Single merged fundamentals point from EODHD `Financials.*.ttm` blocks (income, balance, cash flow, ratios).
 * Used for the trailing TTM column on stock Financials tables.
 */
export function buildTtmChartingPointFromFundamentalsRoot(
  root: Record<string, unknown>,
): ChartingSeriesPoint | null {
  const isRoot = getFinancialStatementRoot(root, "Income_Statement");
  const isTtm = isRoot ? pickTtmSubRow(isRoot) : null;
  if (!isTtm) return null;

  const periodEnd = periodEndKeyFromTtmRow(isTtm, root);
  const p = emptyPoint(periodEnd);
  mergeIncomeRow(p, isTtm);

  const bsRoot = getFinancialStatementRoot(root, "Balance_Sheet");
  const bsTtm = bsRoot ? pickTtmSubRow(bsRoot) : null;
  if (bsTtm) mergeBalanceRow(p, bsTtm);

  const cfRoot = getFinancialStatementRoot(root, "Cash_Flow");
  const cfTtm = cfRoot ? pickTtmSubRow(cfRoot) : null;
  if (cfTtm) mergeCashFlowRow(p, cfTtm);

  const ratiosRoot = getRatiosStatementRoot(root);
  const ratiosTtm = ratiosRoot ? pickTtmSubRow(ratiosRoot) : null;
  if (ratiosTtm) mergeRatiosRow(p, ratiosTtm);

  fillDerivedMarketCap(p);
  computeDerivedMarginsAndReturns(p);
  fillDerivedEpsBasicIfMissing(p, isTtm);
  fillDerivedEpsIfMissing(p);
  fillDerivedDividendsPerShare(p);
  fillDerivedValuationMultiples(p);
  fillDerivedRatioTableFields(p);
  fillDerivedEnterpriseValue(p);
  fillDerivedForwardPe(p);

  const hasData = Object.values(p).some((v) => typeof v === "number" && Number.isFinite(v));
  return hasData ? p : null;
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
    fillDerivedEpsBasicIfMissing(p, isRow as Record<string, unknown>);
    fillDerivedEpsIfMissing(p);
    fillDerivedDividendsPerShare(p);
    fillDerivedValuationMultiples(p);
    fillDerivedRatioTableFields(p);
    fillDerivedEnterpriseValue(p);
    fillDerivedForwardPe(p);
    out.push(p);
  }

  computeGrowthSeries(out, mode);
  return out.length ? limitFundamentalsHistoryPoints(out, mode) : null;
}

/**
 * After earnings overlay — merge income / BS / CF / ratios so statement fields
 * (e.g. operating income) populate when EODHD income rows exist but overlay only set revenue/EPS.
 */
function enrichChartingPointsFromFinancialStatements(
  points: ChartingSeriesPoint[],
  root: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
): ChartingSeriesPoint[] {
  const isBlock = getFinancialBlock(root, "Income_Statement", mode);
  if (!isBlock) return points;

  const bsBlock = getFinancialBlock(root, "Balance_Sheet", mode);
  const cfBlock = getFinancialBlock(root, "Cash_Flow", mode);
  const ratiosBlock = getRatiosBlock(root, mode);

  const out: ChartingSeriesPoint[] = [];
  for (const p of points) {
    const isRow = findRowForPeriodKey(p.periodEnd, isBlock, mode);
    if (!isRow) {
      out.push(p);
      continue;
    }

    const next = { ...p };
    mergeIncomeRow(next, isRow);
    if (bsBlock) {
      const bsRow = findRowForPeriodKey(p.periodEnd, bsBlock, mode);
      if (bsRow) mergeBalanceRow(next, bsRow);
    }
    if (cfBlock) {
      const cfRow = findRowForPeriodKey(p.periodEnd, cfBlock, mode);
      if (cfRow) mergeCashFlowRow(next, cfRow);
    }
    if (ratiosBlock) {
      const rr = findRowForPeriodKey(p.periodEnd, ratiosBlock, mode);
      if (rr) mergeRatiosRow(next, rr);
    }

    fillDerivedMarketCap(next);
    computeDerivedMarginsAndReturns(next);
    fillDerivedEpsBasicIfMissing(next, isRow);
    fillDerivedEpsIfMissing(next);
    fillDerivedDividendsPerShare(next);
    fillDerivedValuationMultiples(next);
    fillDerivedRatioTableFields(next);
    fillDerivedEnterpriseValue(next);
    fillDerivedForwardPe(next);
    out.push(next);
  }

  return out;
}

function finalizeChartingPointsWithEarningsOverlay(
  points: ChartingSeriesPoint[],
  root: Record<string, unknown>,
  mode: FundamentalsSeriesMode,
  earningsActuals: EarningsActualByPeriod,
): ChartingSeriesPoint[] {
  let out = points;
  if (earningsActuals.size > 0) {
    out = overlayReportedEarningsOnChartingPoints(
      out,
      earningsActuals,
      mode,
      computeGrowthSeries,
      limitFundamentalsHistoryPoints,
    );
  }
  out = enrichChartingPointsFromFinancialStatements(out, root, mode);
  computeGrowthSeries(out, mode);
  return limitFundamentalsHistoryPoints(out, mode);
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

export type ChartingSeriesBundle = {
  points: ChartingSeriesPoint[];
  availableMetrics: ChartingMetricId[];
  /** Trailing twelve months snapshot for Financials tables (annual mode only). */
  ttmPoint: ChartingSeriesPoint | null;
};

async function fetchChartingSeriesUncached(
  ticker: string,
  mode: FundamentalsSeriesMode,
  sortedDailyBars?: readonly EodhdDailyBar[] | null,
): Promise<ChartingSeriesBundle | null> {
  const root = await fetchFundamentalsRootForMetrics(ticker);
  if (!root) return null;

  const rootRec = root as Record<string, unknown>;
  const earningsActuals = await resolveReportedEarningsActuals(rootRec, ticker);
  let points = buildMergedPoints(rootRec, mode);
  if (!points?.length) return null;
  points = finalizeChartingPointsWithEarningsOverlay(points, rootRec, mode, earningsActuals);

  await enrichChartingPointsWithPriceImpliedMarketCap(ticker, points, { dailyBars: sortedDailyBars });
  enrichChartingPointsWithTrailingPeFromImpliedMarketCap(points);
  enrichChartingPointsWithImpliedValuationMultiplesFromMarketCap(points);
  for (const p of points) fillDerivedRatioTableFields(p);
  patchLatestChartingPointLiveTrailingPe(points, livePeRatioPartsFromFundamentalsRoot(root));
  patchLatestChartingPointLiveDividendYield(points, dividendYieldRatioFromFundamentalsRoot(rootRec));

  const availableMetrics = computeAvailableMetrics(points);
  const ttmPoint =
    mode === "annual" ? buildTtmChartingPointFromFundamentalsRoot(rootRec) : null;
  return { points, availableMetrics, ttmPoint };
}

export const fetchChartingSeries = unstable_cache(
  async (ticker: string, mode: FundamentalsSeriesMode) => fetchChartingSeriesUncached(ticker, mode),
  ["eodhd-charting-series-v26-statement-enrich"],
  { revalidate: REVALIDATE_WARM },
);

/** Stock page cold load — reuse 100y EOD bars already fetched for performance/chart. */
export async function fetchChartingSeriesWithDailyBars(
  ticker: string,
  mode: FundamentalsSeriesMode,
  sortedDailyBars: readonly EodhdDailyBar[],
): Promise<ChartingSeriesBundle | null> {
  return fetchChartingSeriesUncached(ticker, mode, sortedDailyBars);
}
