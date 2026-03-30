import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchFiveYearMaxDrawdownFraction } from "@/lib/market/eodhd-max-drawdown";
import { formatBeta, formatPercentMetric } from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type KeyStatsRiskRow = { label: string; value: string };

export async function fetchEodhdKeyStatsRisk(ticker: string): Promise<{ rows: KeyStatsRiskRow[] } | null> {
  const [root, ddFrac] = await Promise.all([fetchEodhdFundamentalsJson(ticker), fetchFiveYearMaxDrawdownFraction(ticker)]);

  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const gen = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const tech = root.Technicals && typeof root.Technicals === "object" ? (root.Technicals as Record<string, unknown>) : null;

  let beta = num(tech?.Beta ?? tech?.Beta5Y ?? tech?.Beta5YMonthly);
  if (beta == null) beta = num(gen?.Beta);
  if (beta == null && hl) beta = num(hl.Beta);

  const rows: KeyStatsRiskRow[] = [
    { label: "Beta (5Y)", value: beta != null ? formatBeta(beta) : "—" },
    { label: "Max Drawdown (5Y)", value: ddFrac != null ? formatPercentMetric(ddFrac) : "—" },
  ];

  return { rows };
}
