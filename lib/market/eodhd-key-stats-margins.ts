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

function firstNum(hl: Record<string, unknown> | null, keys: string[]): number | null {
  if (!hl) return null;
  for (const k of keys) {
    const n = num(hl[k]);
    if (n != null) return n;
  }
  return null;
}

export type KeyStatsMarginsRow = { label: string; value: string };

/**
 * Margin / ratio fields only. Free Cash Flow row uses FCF *margin* metrics — never raw FCF dollars.
 */
export async function fetchEodhdKeyStatsMargins(ticker: string): Promise<{ rows: KeyStatsMarginsRow[] } | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;

  const gross = firstNum(hl, [
    "GrossMarginTTM",
    "GrossMargin",
    "GrossProfitMargin",
    "grossMargin",
  ]);
  const operating = firstNum(hl, [
    "OperatingMarginTTM",
    "OperatingMargin",
    "OperationMargin",
    "operatingMargin",
  ]);
  const ebitda = firstNum(hl, [
    "EBITDAMargin",
    "EBITDAMarginTTM",
    "EbitdaMargin",
    "ebitdaMargin",
  ]);
  const preTax = firstNum(hl, ["PreTaxMargin", "PretaxMargin", "PreTaxMarginTTM", "preTaxMargin"]);
  const net = firstNum(hl, [
    "ProfitMargin",
    "NetMargin",
    "NetProfitMargin",
    "ProfitMarginTTM",
    "NetProfitMarginTTM",
  ]);

  /** Only margin-style FCF metrics — avoid misleading raw FCF $ or price-yield style fields. */
  const fcfMargin = firstNum(hl, ["FreeCashFlowMargin", "FreeCashFlowMarginTTM", "FCFMargin"]);

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
