import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { logoUrlFromFundamentalsRoot } from "@/lib/market/stock-logo-url";
import { resolveEarningsPeriodMetricsFromFundamentals } from "@/lib/market/stock-earnings-tab-data";
import type { DetectedEarningsRelease } from "@/lib/notifications/earnings-release-detect";
import { quarterLabelFromPeriodEndYmd } from "@/lib/notifications/earnings-notification-model";

function companyNameFromRoot(root: Record<string, unknown>, fallback: string): string {
  const general = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const nameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName;
  if (typeof nameRaw === "string" && nameRaw.trim()) return nameRaw.trim();
  return fallback;
}

function enrichFromRoot(
  release: DetectedEarningsRelease,
  root: Record<string, unknown> | null,
): DetectedEarningsRelease {
  const { row } = release;
  const fiscalPeriodEndYmd = row.fiscalPeriodEndYmd;
  if (!fiscalPeriodEndYmd) return release;
  if (!root) return release;

  const companyName = companyNameFromRoot(root, row.ticker);
  const logoUrl = logoUrlFromFundamentalsRoot(root, row.ticker);
  const metrics = resolveEarningsPeriodMetricsFromFundamentals(root, fiscalPeriodEndYmd);

  const periodLabel = quarterLabelFromPeriodEndYmd(fiscalPeriodEndYmd);

  return {
    ...release,
    title: `${companyName} reported earnings`,
    body: periodLabel,
    payload: {
      ...release.payload,
      companyName,
      logoUrl: logoUrl || undefined,
      fiscalPeriodLabel: periodLabel,
      epsActual: metrics?.epsActual ?? row.epsActual,
      epsEstimate: metrics?.epsEstimate ?? row.epsEstimate,
      surprisePct: metrics?.surprisePct ?? row.surprisePct,
      revenueActual: metrics?.revenueActual ?? null,
      revenueEstimate: metrics?.revenueEstimate ?? null,
      revenueSurprisePct: metrics?.revenueSurprisePct ?? null,
    },
  };
}

/** One fundamentals fetch per unique ticker in the batch (releases are rare). */
export async function enrichEarningsReleaseNotifications(
  releases: readonly DetectedEarningsRelease[],
): Promise<DetectedEarningsRelease[]> {
  if (releases.length === 0) return [];

  const rootByTicker = new Map<string, Promise<Record<string, unknown> | null>>();

  return Promise.all(
    releases.map(async (release) => {
      const ticker = release.row.ticker;
      let pending = rootByTicker.get(ticker);
      if (!pending) {
        pending = fetchEodhdFundamentalsJson(ticker);
        rootByTicker.set(ticker, pending);
      }
      const root = await pending;
      return enrichFromRoot(release, root);
    }),
  );
}
