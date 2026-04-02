import "server-only";

import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import {
  formatBeta,
  formatEmployeesCount,
  formatSharesOutstanding,
  formatUsdCompact,
  formatUsdPrice,
} from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type KeyStatsBasicRow = { label: string; value: string };

export async function fetchEodhdKeyStatsBasic(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsBasicRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  const ss = root.SharesStats && typeof root.SharesStats === "object" ? (root.SharesStats as Record<string, unknown>) : null;
  const gen = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const tech = root.Technicals && typeof root.Technicals === "object" ? (root.Technicals as Record<string, unknown>) : null;
  const ar = root.AnalystRatings && typeof root.AnalystRatings === "object" ? (root.AnalystRatings as Record<string, unknown>) : null;

  let marketCap = num(hl?.MarketCapitalization ?? hl?.MarketCapitalisation ?? hl?.MarketCap);
  if (marketCap == null && val) marketCap = num(val.MarketCapitalization);

  const enterpriseValue = num(val?.EnterpriseValue);

  let sharesOutstanding = num(ss?.SharesOutstanding ?? ss?.SharesOut);
  if (sharesOutstanding == null && hl) sharesOutstanding = num(hl.SharesOutstanding);

  const target1y = num(
    ar?.WallStreetTargetPrice ??
      ar?.TargetPrice ??
      ar?.MeanTargetPrice ??
      hl?.WallStreetTargetPrice ??
      hl?.TargetPrice,
  );

  const fairValue = num(val?.FairValue ?? hl?.FairValue ?? ar?.FairValue);

  const earningsDate = resolveEarningsDateDisplay(hl, root);

  let beta = num(tech?.Beta ?? tech?.Beta5YMonthly ?? tech?.Beta5Y);
  if (beta == null) beta = num(gen?.Beta);
  if (beta == null && hl) beta = num(hl.Beta);

  const employees = num(gen?.FullTimeEmployees ?? gen?.Employees);

  const rows: KeyStatsBasicRow[] = [
    { label: "Market Cap", value: marketCap != null ? formatUsdCompact(marketCap) : "—" },
    { label: "Enterprise Value", value: enterpriseValue != null ? formatUsdCompact(enterpriseValue) : "—" },
    { label: "Shares Outstanding", value: sharesOutstanding != null ? formatSharesOutstanding(sharesOutstanding) : "—" },
    { label: "1Y Target Est", value: target1y != null ? formatUsdPrice(target1y) : "—" },
    { label: "Fair Value", value: fairValue != null ? formatUsdPrice(fairValue) : "—" },
    { label: "Earnings Date", value: earningsDate ?? "—" },
    { label: "Beta (5Y Monthly)", value: beta != null ? formatBeta(beta) : "—" },
    { label: "Employees", value: employees != null ? formatEmployeesCount(employees) : "—" },
  ];

  return { rows };
}
