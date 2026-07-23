import "server-only";

import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import { analystConsensusDisplayForKeyStats } from "@/lib/market/stock-target-price-payload";
import {
  formatEmployeesCount,
  formatPercentMetric,
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

  const analystConsensus = analystConsensusDisplayForKeyStats(root);

  const earningsDate = resolveEarningsDateDisplay(hl, root);

  const employees = num(gen?.FullTimeEmployees ?? gen?.Employees);

  const tech = root.Technicals && typeof root.Technicals === "object" ? (root.Technicals as Record<string, unknown>) : null;

  let percentInsiders = num(
    ss?.PercentInsiders ?? ss?.PercentHeldByInsiders ?? ss?.HeldPercentInsiders,
  );
  if (percentInsiders == null && hl) {
    percentInsiders = num(hl.PercentInsiders ?? hl.PercentHeldByInsiders);
  }

  let shortFloat = num(
    ss?.ShortPercentFloat ?? ss?.ShortPercentOfFloat ?? ss?.ShortRatioPercentFloat,
  );
  if (shortFloat == null && tech) {
    shortFloat = num(tech.ShortPercentFloat ?? tech.ShortPercent);
  }
  if (shortFloat == null && ss) {
    shortFloat = num(ss.ShortPercentOutstanding ?? ss.ShortPercent);
  }

  const rows: KeyStatsBasicRow[] = [
    { label: "Market Cap", value: marketCap != null ? formatUsdCompact(marketCap) : "—" },
    { label: "Enterprise Value", value: enterpriseValue != null ? formatUsdCompact(enterpriseValue) : "—" },
    { label: "Shares Outstanding", value: sharesOutstanding != null ? formatSharesOutstanding(sharesOutstanding) : "—" },
    { label: "% of Insiders", value: percentInsiders != null ? formatPercentMetric(percentInsiders) : "—" },
    { label: "Short Float", value: shortFloat != null ? formatPercentMetric(shortFloat) : "—" },
    { label: "1Y Target Est", value: target1y != null ? formatUsdPrice(target1y) : "—" },
    { label: "Analyst Consensus", value: analystConsensus ?? "—" },
    { label: "Earnings Date", value: earningsDate ?? "—" },
    { label: "Employees", value: employees != null ? formatEmployeesCount(employees) : "—" },
  ];

  return { rows };
}
