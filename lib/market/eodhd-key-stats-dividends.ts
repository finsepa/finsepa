import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type KeyStatsDividendsRow = { label: string; value: string };

export async function fetchEodhdKeyStatsDividends(
  ticker: string,
  fundamentalsRoot?: Record<string, unknown> | null,
): Promise<{ rows: KeyStatsDividendsRow[] } | null> {
  const root = fundamentalsRoot ?? (await fetchEodhdFundamentalsJson(ticker));
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;

  const yieldPct = num(hl?.DividendYield ?? hl?.Yield ?? hl?.ForwardAnnualDividendYield);
  const payout = num(hl?.PayoutRatio ?? hl?.DividendPayoutRatio ?? hl?.Payout);

  const rows: KeyStatsDividendsRow[] = [
    { label: "Yield", value: yieldPct != null ? formatPercentMetric(yieldPct) : "—" },
    { label: "Payout", value: payout != null ? formatPercentMetric(payout) : "—" },
  ];

  return { rows };
}
