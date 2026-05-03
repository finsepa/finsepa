import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdKeyStatsAssetsLiabilities } from "@/lib/market/eodhd-key-stats-assets-liabilities";
import { fetchEodhdKeyStatsBasic } from "@/lib/market/eodhd-key-stats-basic";
import { fetchEodhdKeyStatsDividends } from "@/lib/market/eodhd-key-stats-dividends";
import { fetchEodhdKeyStatsGrowth } from "@/lib/market/eodhd-key-stats-growth";
import { fetchEodhdKeyStatsMargins } from "@/lib/market/eodhd-key-stats-margins";
import { fetchEodhdKeyStatsReturns } from "@/lib/market/eodhd-key-stats-returns";
import { fetchEodhdKeyStatsRevenueProfit } from "@/lib/market/eodhd-key-stats-revenue-profit";
import { fetchEodhdKeyStatsRisk } from "@/lib/market/eodhd-key-stats-risk";
import { fetchEodhdKeyStatsValuation } from "@/lib/market/eodhd-key-stats-valuation";
import type { ScreenerKeyStatSection } from "@/lib/screener/screener-key-stats-metric-catalog";

type Row = { label: string; value: string };

function pick(rows: Row[] | null | undefined, label: string): string {
  const v = rows?.find((r) => r.label === label)?.value;
  if (v == null || !String(v).trim()) return "—";
  return v;
}

export async function fetchKeyStatCellForTicker(
  ticker: string,
  section: ScreenerKeyStatSection,
  label: string,
): Promise<string> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return "—";

  switch (section) {
    case "basic":
      return pick((await fetchEodhdKeyStatsBasic(ticker, root))?.rows, label);
    case "valuation":
      return pick((await fetchEodhdKeyStatsValuation(ticker, root))?.rows, label);
    case "revenueProfit":
      return pick((await fetchEodhdKeyStatsRevenueProfit(ticker, root))?.rows, label);
    case "margins":
      return pick((await fetchEodhdKeyStatsMargins(ticker, root))?.rows, label);
    case "growth":
      return pick((await fetchEodhdKeyStatsGrowth(ticker, root))?.rows, label);
    case "assetsLiabilities":
      return pick((await fetchEodhdKeyStatsAssetsLiabilities(ticker, root))?.rows, label);
    case "returns":
      return pick((await fetchEodhdKeyStatsReturns(ticker, root))?.rows, label);
    case "dividends":
      return pick((await fetchEodhdKeyStatsDividends(ticker, root))?.rows, label);
    case "risk":
      return pick((await fetchEodhdKeyStatsRisk(ticker, root))?.rows, label);
    default:
      return "—";
  }
}
