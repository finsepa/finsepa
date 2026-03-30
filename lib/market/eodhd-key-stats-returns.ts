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

export type KeyStatsReturnsRow = { label: string; value: string };

export async function fetchEodhdKeyStatsReturns(ticker: string): Promise<{ rows: KeyStatsReturnsRow[] } | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;

  const roe = num(
    hl?.ReturnOnEquityTTM ?? hl?.ReturnOnEquity ?? hl?.ROE ?? val?.ReturnOnEquity ?? val?.ROE,
  );
  const roa = num(
    hl?.ReturnOnAssetsTTM ?? hl?.ReturnOnAssets ?? hl?.ROA ?? val?.ReturnOnAssets ?? val?.ROA,
  );
  const roce = num(
    hl?.ReturnOnCapitalEmployedTTM ??
      hl?.ReturnOnCapitalEmployed ??
      hl?.ROCE ??
      val?.ReturnOnCapitalEmployed,
  );
  const roi = num(
    hl?.ReturnOnInvestmentTTM ??
      hl?.ReturnOnInvestment ??
      hl?.ROI ??
      hl?.ReturnOnInvestedCapitalTTM ??
      hl?.ReturnOnInvestedCapital ??
      hl?.ROIC ??
      val?.ReturnOnInvestment,
  );

  const rows: KeyStatsReturnsRow[] = [
    { label: "Return on Equity (ROE)", value: roe != null ? formatPercentMetric(roe) : "—" },
    { label: "Return on Assets (ROA)", value: roa != null ? formatPercentMetric(roa) : "—" },
    { label: "Return on Capital Employed (ROCE)", value: roce != null ? formatPercentMetric(roce) : "—" },
    { label: "Return on Investments (ROI)", value: roi != null ? formatPercentMetric(roi) : "—" },
  ];

  return { rows };
}
