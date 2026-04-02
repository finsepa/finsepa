import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { pickLatestIncomeStatementRow } from "@/lib/market/eodhd-income-statement";
import { pickLatestFinancialSubTable } from "@/lib/market/eodhd-pick-financial-block";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numFromRow(row: Record<string, unknown> | null, keys: string[]): number | null {
  if (!row) return null;
  for (const k of keys) {
    const n = num(row[k]);
    if (n != null) return n;
  }
  return null;
}

function firstNumFromSections(sections: (Record<string, unknown> | null | undefined)[], keys: string[]): number | null {
  for (const sec of sections) {
    const n = numFromRow(sec ?? null, keys);
    if (n != null) return n;
  }
  return null;
}

export type KeyStatsMarginsRow = { label: string; value: string };

/**
 * Margin / ratio fields. "Free Cash Flow" row is **FCF ÷ revenue** (margin %), same as charting derived metrics.
 */
export async function fetchEodhdKeyStatsMargins(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsMarginsRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ratiosRow = pickLatestFinancialSubTable(root, [["Ratios", "Financial_Ratios"]]);
  const incRow = pickLatestIncomeStatementRow(root);
  const cfRow = pickLatestFinancialSubTable(root, [["Cash_Flow", "CashFlow"]]);

  let gross = firstNumFromSections([hl, val, ratiosRow], [
    "GrossMarginTTM",
    "GrossMargin",
    "GrossProfitMargin",
    "grossMargin",
    "GrossMarginRatio",
  ]);
  let operating = firstNumFromSections([hl, val, ratiosRow], [
    "OperatingMarginTTM",
    "OperatingMargin",
    "OperationMargin",
    "operatingMargin",
    "OperatingMarginRatio",
  ]);
  let ebitda = firstNumFromSections([hl, val, ratiosRow], [
    "EBITDAMargin",
    "EBITDAMarginTTM",
    "EbitdaMargin",
    "ebitdaMargin",
    "EBITDAMarginRatio",
  ]);
  let preTax = firstNumFromSections([hl, val, ratiosRow], [
    "PreTaxMargin",
    "PretaxMargin",
    "PreTaxMarginTTM",
    "preTaxMargin",
    "IncomeBeforeTaxMargin",
  ]);
  let net = firstNumFromSections([hl, val, ratiosRow], [
    "ProfitMargin",
    "NetMargin",
    "NetProfitMargin",
    "ProfitMarginTTM",
    "NetProfitMarginTTM",
    "NetMarginTTM",
  ]);

  let fcfMargin = firstNumFromSections([hl, val, ratiosRow], [
    "FreeCashFlowMargin",
    "FreeCashFlowMarginTTM",
    "FCFMargin",
    "FreeCashFlowToRevenue",
  ]);

  // Derived from TTM income + cash flow (same idea as charting `computeDerivedMarginsAndReturns`).
  let revenue = numFromRow(incRow, [
    "totalRevenue",
    "TotalRevenue",
    "revenue",
    "Revenue",
    "totalRevenueFromOperations",
    "Sales",
  ]);
  if (revenue == null && hl) revenue = num(hl.RevenueTTM ?? hl.Revenue ?? hl.TotalRevenue);

  if (revenue != null && Math.abs(revenue) > 1e-9) {
    const rev = revenue;
    if (gross == null) {
      const gp = numFromRow(incRow, ["grossProfit", "GrossProfit", "grossIncome", "GrossIncome"]);
      if (gp != null) gross = gp / rev;
    }
    if (operating == null) {
      const op = numFromRow(incRow, [
        "operatingIncome",
        "OperatingIncome",
        "operationIncome",
        "operatingIncomeLoss",
        "OperatingIncomeLoss",
      ]);
      if (op != null) operating = op / rev;
    }
    if (ebitda == null) {
      const e = numFromRow(incRow, ["ebitda", "EBITDA"]);
      if (e != null) ebitda = e / rev;
    }
    if (preTax == null) {
      const ibt = numFromRow(incRow, [
        "incomeBeforeTax",
        "IncomeBeforeTax",
        "incomeBeforeTaxes",
        "IncomeBeforeTaxes",
        "pretaxIncome",
        "PretaxIncome",
        "incomeBeforeIncomeTaxes",
        "IncomeBeforeIncomeTaxes",
      ]);
      if (ibt != null) preTax = ibt / rev;
    }
    if (net == null) {
      const ni = numFromRow(incRow, [
        "netIncome",
        "NetIncome",
        "netIncomeApplicableToCommonShares",
        "NetIncomeApplicableToCommonShares",
      ]);
      if (ni != null) net = ni / rev;
    }
    if (fcfMargin == null && cfRow) {
      const fcf = numFromRow(cfRow, [
        "freeCashFlow",
        "FreeCashFlow",
        "freeCashFlowFromContinuingOperations",
        "FreeCashFlows",
      ]);
      if (fcf != null) fcfMargin = fcf / rev;
    }
  }

  const rows: KeyStatsMarginsRow[] = [
    { label: "Gross Margin", value: gross != null ? formatPercentMetric(gross) : "—" },
    { label: "Operating Margin", value: operating != null ? formatPercentMetric(operating) : "—" },
    { label: "EBITDA Margin", value: ebitda != null ? formatPercentMetric(ebitda) : "—" },
    { label: "Pre-Tax Margin", value: preTax != null ? formatPercentMetric(preTax) : "—" },
    { label: "Net Margin", value: net != null ? formatPercentMetric(net) : "—" },
    { label: "Free Cash Flow", value: fcfMargin != null ? formatPercentMetric(fcfMargin) : "—" },
  ];

  return { rows };
}
