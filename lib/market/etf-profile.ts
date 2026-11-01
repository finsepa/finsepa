import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import type { EtfProfile, EtfHolding, EtfWeight } from "@/lib/market/etf-profile-types";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** EODHD sector labels → the names used elsewhere in the app. */
const SECTOR_LABELS: Record<string, string> = {
  "Consumer Cyclicals": "Consumer Cyclical",
  "Consumer Defensive": "Consumer Defensive",
};

/** `{ name: { [pctKey]: n } }` maps (sectors, regions, asset classes) → sorted non-zero weights. */
function weightsFromMap(raw: unknown, pctKey: string, labels: Record<string, string> = {}): EtfWeight[] {
  const map = rec(raw);
  if (!map) return [];
  const out: EtfWeight[] = [];
  for (const [name, v] of Object.entries(map)) {
    const pct = num(rec(v)?.[pctKey]);
    if (pct == null || pct <= 0.005) continue;
    out.push({ label: labels[name] ?? name, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  "Stock US": "US Stocks",
  "Stock non-US": "Non-US Stocks",
  Bond: "Bonds",
  Cash: "Cash",
  Other: "Other",
  NotClassified: "Not Classified",
};

/** EODHD reports `0` (not null) for periods older than the fund — treat those as unavailable. */
function returnIfFundOldEnough(raw: unknown, fundAgeYears: number | null, periodYears: number): number | null {
  const v = num(raw);
  if (v == null) return null;
  if (fundAgeYears != null && fundAgeYears < periodYears) return null;
  return v;
}

const MARKET_CAP_ORDER = ["Mega", "Big", "Medium", "Small", "Micro"] as const;

/** Holding codes we can route to `/stock/[ticker]` (EODHD sometimes lists the US fund under a foreign venue). */
function holdingHref(code: string): string | null {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(code) ? `/stock/${encodeURIComponent(code)}` : null;
}

function parseHoldings(etf: Record<string, unknown>, aumUsd: number | null): EtfHolding[] {
  const full = rec(etf.Holdings);
  const top10 = rec(etf.Top_10_Holdings);
  const source =
    full && Object.keys(full).length >= Object.keys(top10 ?? {}).length ? full : (top10 ?? full);
  if (!source) return [];
  const rows: EtfHolding[] = [];
  for (const [key, v] of Object.entries(source)) {
    const h = rec(v);
    if (!h) continue;
    const code = (str(h.Code) ?? key.split(".")[0] ?? "").toUpperCase();
    const weightPct = num(h["Assets_%"]);
    if (!code || weightPct == null) continue;
    rows.push({
      code,
      name: str(h.Name) ?? code,
      sector: str(h.Sector),
      weightPct,
      valueUsd: aumUsd != null ? (aumUsd * weightPct) / 100 : null,
      logoUrl: logoDevStockLogoUrl(code) ?? "",
      href: holdingHref(code),
    });
  }
  return rows.sort((a, b) => b.weightPct - a.weightPct);
}

export function parseEtfProfile(ticker: string, root: Record<string, unknown> | null): EtfProfile | null {
  const etf = rec(root?.ETF_Data);
  if (!root || !etf) return null;
  const general = rec(root.General);
  const technicals = rec(root.Technicals);
  const perf = rec(etf.Performance);
  const aumUsd = num(etf.TotalAssets);
  const holdings = parseHoldings(etf, aumUsd);
  const expenseRatio = num(etf.NetExpenseRatio) ?? num(etf.Ongoing_Charge);
  const turnover = num(etf.AnnualHoldingsTurnover);
  const mcap = rec(etf.Market_Capitalisation);
  const inception = str(etf.Inception_Date);
  const inceptionMs = inception ? Date.parse(`${inception}T00:00:00Z`) : NaN;
  const fundAgeYears = Number.isFinite(inceptionMs) ? (Date.now() - inceptionMs) / (365.25 * 86_400_000) : null;

  return {
    ticker: ticker.trim().toUpperCase(),
    name: str(general?.Name),
    issuer: str(etf.Company_Name),
    indexName: str(etf.Index_Name),
    category: str(general?.Category),
    inceptionDate: inception,
    aumUsd,
    // EODHD: expense ratio and turnover are fractions; yield and returns are already percents.
    expenseRatioPct: expenseRatio != null ? expenseRatio * 100 : null,
    turnoverPct: turnover != null ? turnover * 100 : null,
    yieldPct: num(etf.Yield),
    dividendFrequency: str(etf.Dividend_Paying_Frequency),
    holdingsCount: num(etf.Holdings_Count),
    holdings,
    sectors: weightsFromMap(etf.Sector_Weights, "Equity_%", SECTOR_LABELS),
    assetAllocation: weightsFromMap(etf.Asset_Allocation, "Net_Assets_%", ASSET_CLASS_LABELS),
    regions: weightsFromMap(etf.World_Regions, "Equity_%"),
    marketCap: MARKET_CAP_ORDER.map((k) => ({ label: k, pct: num(mcap?.[k]) ?? 0 })).filter((w) => w.pct > 0.005),
    returns: {
      ytd: num(perf?.Returns_YTD),
      y1: returnIfFundOldEnough(perf?.Returns_1Y, fundAgeYears, 1),
      y3: returnIfFundOldEnough(perf?.Returns_3Y, fundAgeYears, 3),
      y5: returnIfFundOldEnough(perf?.Returns_5Y, fundAgeYears, 5),
      y10: returnIfFundOldEnough(perf?.Returns_10Y, fundAgeYears, 10),
    },
    volatility1y: num(perf?.["1y_Volatility"]),
    volatility3y: num(perf?.["3y_Volatility"]),
    beta: num(technicals?.Beta),
    high52w: num(technicals?.["52WeekHigh"]),
    low52w: num(technicals?.["52WeekLow"]),
  };
}

/** ETF fund data from the shared fundamentals cache (no extra EODHD request when the page already loaded it). */
export async function getEtfProfile(ticker: string): Promise<EtfProfile | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  return parseEtfProfile(ticker, root);
}
