/**
 * Extract per-holding fundamental fields from EODHD fundamentals JSON.
 */
import "server-only";

import { pickLatestBalanceSheetRow } from "@/lib/market/eodhd-balance-sheet";
import { pickLatestIncomeStatementRow } from "@/lib/market/eodhd-income-statement";
import { pickLatestFinancialSubTable } from "@/lib/market/eodhd-pick-financial-block";
import { livePeRatioPartsFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-valuation";
import { deriveMarginsFromIncome } from "@/lib/portfolio/analytics/derive-margins-from-income";
import type { HoldingFundamentalInput } from "@/lib/portfolio/analytics/portfolio-fundamentals";

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

function firstNum(
  sections: (Record<string, unknown> | null | undefined)[],
  keys: string[],
): number | null {
  for (const sec of sections) {
    const n = numFromRow(sec ?? null, keys);
    if (n != null) return n;
  }
  return null;
}

function deriveRoce(
  incRow: Record<string, unknown> | null,
  bsRow: Record<string, unknown> | null,
): number | null {
  const operatingIncome = numFromRow(incRow, [
    "operatingIncome",
    "OperatingIncome",
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

function deriveCashConversion(
  cfRow: Record<string, unknown> | null,
  incRow: Record<string, unknown> | null,
): number | null {
  const ocf = numFromRow(cfRow, [
    "totalCashFromOperatingActivities",
    "TotalCashFromOperatingActivities",
    "operatingCashFlow",
    "OperatingCashFlow",
    "netCashProvidedByOperatingActivities",
  ]);
  const netIncome = numFromRow(incRow, [
    "netIncome",
    "NetIncome",
    "netIncomeApplicableToCommonShares",
  ]);
  if (ocf == null || netIncome == null || Math.abs(netIncome) < 1e-9) return null;
  return ocf / netIncome;
}

export function classifyHoldingKindFromFundamentals(
  symbol: string,
  root: Record<string, unknown> | null,
  isCrypto: boolean,
): HoldingFundamentalInput["kind"] {
  if (isCrypto) return "crypto";
  if (!root) return "other";
  const gen = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const type = typeof gen?.Type === "string" ? gen.Type.toLowerCase() : "";
  const category = typeof gen?.Category === "string" ? gen.Category.toLowerCase() : "";
  if (type.includes("etf") || category.includes("etf") || type.includes("fund")) return "etf";
  return "equity";
}

export function holdingFundamentalsFromRoot(args: {
  symbol: string;
  marketValue: number;
  root: Record<string, unknown> | null;
  isCrypto: boolean;
}): HoldingFundamentalInput {
  const kind = classifyHoldingKindFromFundamentals(args.symbol, args.root, args.isCrypto);
  if (!args.root || args.isCrypto) {
    return {
      symbol: args.symbol,
      marketValue: args.marketValue,
      pe: null,
      grossMargin: null,
      operatingMargin: null,
      roce: null,
      cashConversion: null,
      kind,
    };
  }

  const hl =
    args.root.Highlights && typeof args.root.Highlights === "object"
      ? (args.root.Highlights as Record<string, unknown>)
      : null;
  const val =
    args.root.Valuation && typeof args.root.Valuation === "object"
      ? (args.root.Valuation as Record<string, unknown>)
      : null;
  const ratiosRow = pickLatestFinancialSubTable(args.root, [["Ratios", "Financial_Ratios"]]);
  const incRow = pickLatestIncomeStatementRow(args.root);
  const bsRow = pickLatestBalanceSheetRow(args.root);
  const cfRow = pickLatestFinancialSubTable(args.root, [["Cash_Flow", "CashFlow"]]);

  const peParts = livePeRatioPartsFromFundamentalsRoot(args.root);
  const pe = peParts.peRatio ?? peParts.trailingPe;

  let grossMargin = firstNum([hl, val, ratiosRow], [
    "GrossMarginTTM",
    "GrossMargin",
    "GrossProfitMargin",
    "grossMargin",
    "GrossMarginRatio",
  ]);
  let operatingMargin = firstNum([hl, val, ratiosRow], [
    "OperatingMarginTTM",
    "OperatingMargin",
    "OperationMargin",
    "operatingMargin",
    "OperatingMarginRatio",
  ]);
  if (grossMargin == null || operatingMargin == null) {
    const derived = deriveMarginsFromIncome(hl, incRow);
    if (grossMargin == null) grossMargin = derived.gross;
    if (operatingMargin == null) operatingMargin = derived.operating;
  }

  let roce = firstNum([hl, val, ratiosRow], [
    "ReturnOnCapitalEmployedTTM",
    "ReturnOnCapitalEmployed",
    "ROCE",
    "roce",
    "returnOnCapitalEmployed",
  ]);
  if (roce == null) roce = deriveRoce(incRow, bsRow);

  let cashConversion = firstNum([hl, val, ratiosRow], [
    "CashConversion",
    "CashConversionRatio",
    "CashConversionTTM",
    "OperatingCashFlowToNetIncome",
  ]);
  if (cashConversion == null) cashConversion = deriveCashConversion(cfRow, incRow);

  return {
    symbol: args.symbol,
    marketValue: args.marketValue,
    pe: pe != null && Number.isFinite(pe) ? pe : null,
    grossMargin,
    operatingMargin,
    roce,
    cashConversion,
    kind,
  };
}
