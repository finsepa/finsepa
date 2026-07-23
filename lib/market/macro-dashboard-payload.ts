import "server-only";

import { unstable_cache } from "next/cache";

import { fetchMacroSeriesAll, MACRO_SERIES, type MacroSeriesDef } from "@/lib/market/eodhd-macro";
import { HUB_SNAPSHOT_KEY, macroHubSegment } from "@/lib/market/hub-snapshot-keys";
import { readHubSnapshot } from "@/lib/market/hub-snapshot-store";

export type MacroDashboardCard = {
  id: string;
  title: string;
  kind: "percent" | "usd" | "index" | "number";
  points: Array<{ time: string; value: number }>;
  latest: { time: string; value: number } | null;
  change: { abs: number; pct: number | null } | null;
};

function latest(points: Array<{ time: string; value: number }>): { time: string; value: number } | null {
  if (!points.length) return null;
  return points[points.length - 1] ?? null;
}

/** Reject hub rows that predate live CAPE / trailing-P/E / earnings extensions. */
function hubMacroSnapshotHasFreshShiller(snap: { items?: MacroDashboardCard[] }): boolean {
  const ids = ["shiller_pe", "sp500_trailing_pe", "sp500_earnings"] as const;
  for (const id of ids) {
    const series = snap.items?.find((i) => i.id === id);
    const t = series?.latest?.time?.trim().slice(0, 10);
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
    const ageMs = Date.now() - Date.parse(`${t}T12:00:00.000Z`);
    // Workbook alone often lags; extensions keep the tip within ~2 months.
    if (!(Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 60 * 24 * 60 * 60 * 1000)) return false;
  }
  return true;
}

/** Hub must include multi-year UST + Fed funds history. */
function hubMacroSnapshotHasLongTreasuryHistory(snap: { items?: MacroDashboardCard[] }): boolean {
  const tenY = snap.items?.find((i) => i.id === "ust_par_yield_10y");
  const twentyY = snap.items?.find((i) => i.id === "ust_par_yield_20y");
  const fed = snap.items?.find((i) => i.id === "fed_interest_rate");
  const tenFirst = tenY?.points?.[0]?.time?.trim().slice(0, 10);
  const twentyFirst = twentyY?.points?.[0]?.time?.trim().slice(0, 10);
  const fedFirst = fed?.points?.[0]?.time?.trim().slice(0, 10);
  if (!tenFirst || !/^\d{4}-\d{2}-\d{2}$/.test(tenFirst) || tenFirst > "2005-01-01") return false;
  if (!twentyFirst || !/^\d{4}-\d{2}-\d{2}$/.test(twentyFirst) || twentyFirst > "2010-01-01") return false;
  // FOMC economic-events history is short; FRED FEDFUNDS reaches back decades.
  if (!fedFirst || !/^\d{4}-\d{2}-\d{2}$/.test(fedFirst) || fedFirst > "2010-01-01") return false;
  return true;
}

/**
 * Reject annual World Bank / EODHD tips (year-end only) once FRED quarterly series are live.
 * CPI YoY + GDP + GDP deflator should all reach into the current year.
 */
function hubMacroSnapshotHasFreshCpiGdp(snap: { items?: MacroDashboardCard[] }): boolean {
  const ids = [
    "inflation_consumer_prices_annual",
    "inflation_gdp_deflator_annual",
    "gdp_current_usd",
    "gdp_growth_annual",
    "gdp_per_capita_usd",
    "debt_percent_gdp",
    "unemployment_total_percent",
  ] as const;
  const year = new Date().getUTCFullYear();
  const minTip = `${year}-01-01`;
  for (const id of ids) {
    const series = snap.items?.find((i) => i.id === id);
    const t = series?.latest?.time?.trim().slice(0, 10);
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t) || t < minTip) return false;
  }
  return true;
}

function hubMacroSnapshotHasBtcEtfFlows(snap: { items?: MacroDashboardCard[] }): boolean {
  const series = snap.items?.find((i) => i.id === "btc_etf_net_flow");
  return (series?.points?.length ?? 0) >= 30;
}

function hubMacroSnapshotIsUsable(snap: { items?: MacroDashboardCard[] }): boolean {
  return (
    hubMacroSnapshotHasFreshShiller(snap) &&
    hubMacroSnapshotHasLongTreasuryHistory(snap) &&
    hubMacroSnapshotHasFreshCpiGdp(snap) &&
    hubMacroSnapshotHasBtcEtfFlows(snap)
  );
}

async function buildMacroDashboardPayloadUncached(): Promise<{ country: string; items: MacroDashboardCard[] }> {
  const country = "USA";

  const settled = await Promise.allSettled(
    MACRO_SERIES.map(async (def: MacroSeriesDef): Promise<MacroDashboardCard | null> => {
      const points = await fetchMacroSeriesAll(country, def);
      if (!points.length) return null;
      const l = latest(points);
      if (!l) return null;
      const prev = points.length >= 2 ? points[points.length - 2]! : null;
      const abs = prev ? l.value - prev.value : null;
      const pct = prev && prev.value !== 0 ? (abs! / Math.abs(prev.value)) * 100 : null;
      return {
        id: def.id,
        title: def.title,
        kind: def.kind,
        points,
        latest: l,
        change: abs == null ? null : { abs, pct },
      };
    }),
  );

  const items: MacroDashboardCard[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) items.push(s.value);
  }

  return { country, items };
}

/** Cron / hub ingest — bypasses Supabase read path. */
export async function buildMacroDashboardPayloadForIngest(): Promise<{
  country: string;
  items: MacroDashboardCard[];
}> {
  return buildMacroDashboardPayloadUncached();
}

async function getMacroDashboardPayloadCachedInner(): Promise<{ country: string; items: MacroDashboardCard[] }> {
  return unstable_cache(
    buildMacroDashboardPayloadUncached,
    ["macro-dashboard-payload-v46-btc-etf-flows"],
    { revalidate: 300 },
  )();
}

/**
 * Single cached blob for `/macro` (RSC) and `/api/macro` — hub snapshot first, then `unstable_cache`.
 */
export async function getMacroDashboardPayloadCached(): Promise<{ country: string; items: MacroDashboardCard[] }> {
  const segment = macroHubSegment();
  const snap = await readHubSnapshot<{ country: string; items: MacroDashboardCard[] }>(
    HUB_SNAPSHOT_KEY.macroDashboard,
    segment,
  );
  if (snap && hubMacroSnapshotIsUsable(snap)) {
    const allowed = new Set(MACRO_SERIES.map((d) => d.id));
    return {
      country: snap.country ?? "USA",
      items: (snap.items ?? []).filter((i) => allowed.has(i.id)),
    };
  }
  return getMacroDashboardPayloadCachedInner();
}
