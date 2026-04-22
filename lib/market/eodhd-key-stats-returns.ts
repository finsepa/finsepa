import "server-only";

import { pickLatestBalanceSheetRow } from "@/lib/market/eodhd-balance-sheet";
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

/** Same construction as `computeDerivedMarginsAndReturns` in eodhd-charting-series. */
function deriveRoceFromStatements(
  incRow: Record<string, unknown> | null,
  bsRow: Record<string, unknown> | null,
): number | null {
  const operatingIncome = numFromRow(incRow, [
    "operatingIncome",
    "OperatingIncome",
    "operationIncome",
    "operatingIncomeLoss",
    "OperatingIncomeLoss",
  ]);
  const totalAssets = numFromRow(bsRow, ["totalAssets", "TotalAssets"]);
  const currentLiabilities = numFromRow(bsRow, [
    "totalCurrentLiabilities",
    "TotalCurrentLiabilities",
    "currentLiabilities",
    "CurrentLiabilities",
  ]);
  if (operatingIncome == null || totalAssets == null || currentLiabilities == null) return null;
  const cap = totalAssets - currentLiabilities;
  if (!Number.isFinite(cap) || Math.abs(cap) < 1e-9) return null;
  return operatingIncome / cap;
}

/** Same construction as `computeDerivedMarginsAndReturns` in eodhd-charting-series. */
function deriveRoiFromStatements(
  incRow: Record<string, unknown> | null,
  bsRow: Record<string, unknown> | null,
): number | null {
  const netIncome = numFromRow(incRow, [
    "netIncome",
    "NetIncome",
    "netIncomeApplicableToCommonShares",
    "NetIncomeApplicableToCommonShares",
  ]);
  let debt = numFromRow(bsRow, ["shortLongTermDebtTotal", "totalDebt", "TotalDebt", "LongTermDebtTotal"]);
  if (debt == null) {
    const st = numFromRow(bsRow, ["shortTermDebt", "ShortTermDebt"]);
    const lt = numFromRow(bsRow, ["longTermDebt", "LongTermDebt"]);
    if (st != null || lt != null) debt = (st ?? 0) + (lt ?? 0);
  }
  const equity = numFromRow(bsRow, [
    "totalStockholderEquity",
    "TotalStockholderEquity",
    "totalStockholdersEquity",
    "ShareholdersEquity",
    "ShareHolderEquity",
  ]);
  if (netIncome == null || debt == null || equity == null) return null;
  const invested = Math.abs(debt) + Math.abs(equity);
  if (invested < 1e-9) return null;
  return netIncome / invested;
}

export type KeyStatsReturnsRow = { label: string; value: string };

export async function fetchEodhdKeyStatsReturns(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsReturnsRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ratiosRow = pickLatestFinancialSubTable(root, [["Ratios", "Financial_Ratios"]]);
  const incRow = pickLatestIncomeStatementRow(root);
  const bsRow = pickLatestBalanceSheetRow(root);

  const roe = num(
    hl?.ReturnOnEquityTTM ?? hl?.ReturnOnEquity ?? hl?.ROE ?? val?.ReturnOnEquity ?? val?.ROE,
  );
  const roa = num(
    hl?.ReturnOnAssetsTTM ?? hl?.ReturnOnAssets ?? hl?.ROA ?? val?.ReturnOnAssets ?? val?.ROA,
  );

  let roce = firstNumFromSections([hl, val, ratiosRow], [
    "ReturnOnCapitalEmployedTTM",
    "ReturnOnCapitalEmployed",
    "ROCE",
    "roce",
    "returnOnCapitalEmployed",
    "ReturnOnCapitalEmployedRatio",
    "ROCERatio",
  ]);
  if (roce == null) roce = deriveRoceFromStatements(incRow, bsRow);

  let roi = firstNumFromSections([hl, val, ratiosRow], [
    "ReturnOnInvestmentTTM",
    "ReturnOnInvestment",
    "ROI",
    "roi",
    "returnOnInvestment",
    "ReturnOnInvestmentRatio",
  ]);
  if (roi == null) roi = deriveRoiFromStatements(incRow, bsRow);
  if (roi == null) {
    roi = firstNumFromSections([hl, val, ratiosRow], [
      "ReturnOnInvestedCapitalTTM",
      "ReturnOnInvestedCapital",
      "ROIC",
      "roic",
      "returnOnInvestedCapital",
    ]);
  }

  const rows: KeyStatsReturnsRow[] = [
    { label: "Return on Equity (ROE)", value: roe != null ? formatPercentMetric(roe) : "—" },
    { label: "Return on Assets (ROA)", value: roa != null ? formatPercentMetric(roa) : "—" },
    { label: "Return on Capital Employed (ROCE)", value: roce != null ? formatPercentMetric(roce) : "—" },
    { label: "Return on Investments (ROI)", value: roi != null ? formatPercentMetric(roi) : "—" },
  ];

  return { rows };
}
