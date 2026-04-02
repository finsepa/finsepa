import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { pickLatestIncomeStatementRow } from "@/lib/market/eodhd-income-statement";
import { formatUsdCompact, formatUsdPrice } from "@/lib/market/key-stats-basic-format";

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

export type KeyStatsRevenueProfitRow = { label: string; value: string };

export async function fetchEodhdKeyStatsRevenueProfit(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsRevenueProfitRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const earn = root.Earnings && typeof root.Earnings === "object" ? (root.Earnings as Record<string, unknown>) : null;

  const row = pickLatestIncomeStatementRow(root);

  let revenue = numFromRow(row, [
    "totalRevenue",
    "TotalRevenue",
    "revenue",
    "Revenue",
    "totalRevenueFromOperations",
    "Sales",
  ]);
  let grossProfit = numFromRow(row, ["grossProfit", "GrossProfit", "grossIncome", "GrossIncome"]);
  let operatingIncome = numFromRow(row, [
    "operatingIncome",
    "OperatingIncome",
    "operationIncome",
    "operatingIncomeLoss",
    "OperatingIncomeLoss",
  ]);
  let netIncome = numFromRow(row, [
    "netIncome",
    "NetIncome",
    "netIncomeApplicableToCommonShares",
    "NetIncomeApplicableToCommonShares",
  ]);
  let ebitda = numFromRow(row, ["ebitda", "EBITDA"]);

  if (revenue == null && hl) revenue = num(hl.RevenueTTM ?? hl.Revenue ?? hl.TotalRevenue);
  if (grossProfit == null && hl) grossProfit = num(hl.GrossProfitTTM ?? hl.GrossProfit);
  if (operatingIncome == null && hl) operatingIncome = num(hl.OperatingIncomeTTM ?? hl.OperatingIncome);
  if (netIncome == null && hl) netIncome = num(hl.NetIncomeTTM ?? hl.NetIncome);
  if (ebitda == null && hl) ebitda = num(hl.EBITDA ?? hl.EBITDATTM);

  let eps = numFromRow(row, ["dilutedEPS", "DilutedEPS", "epsDiluted", "eps", "EPS", "basicEPS", "BasicEPS"]);
  if (eps == null && hl) eps = num(hl.EarningsShare ?? hl.EPS ?? hl.DilutedEps ?? hl.DilutedEPS);
  if (eps == null && earn) eps = num(earn.EPS ?? earn.DilutedEPS ?? earn.EpsDiluted);

  const rows: KeyStatsRevenueProfitRow[] = [
    { label: "Revenue", value: revenue != null ? formatUsdCompact(revenue) : "—" },
    { label: "Gross Profit", value: grossProfit != null ? formatUsdCompact(grossProfit) : "—" },
    { label: "Operating Income", value: operatingIncome != null ? formatUsdCompact(operatingIncome) : "—" },
    { label: "Net Income", value: netIncome != null ? formatUsdCompact(netIncome) : "—" },
    { label: "EBITDA", value: ebitda != null ? formatUsdCompact(ebitda) : "—" },
    { label: "EPS", value: eps != null ? formatUsdPrice(eps) : "—" },
  ];

  return { rows };
}
