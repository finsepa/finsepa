import { differenceInCalendarDays, parseISO } from "date-fns";

import type { PortfolioChartRange } from "@/lib/portfolio/portfolio-chart-types";

/** Longer horizon → higher rank. Used to pick the denser of requested vs actual span. */
const RANGE_RANK: Record<PortfolioChartRange, number> = {
  "1d": 0,
  "5d": 1,
  "1m": 2,
  "6m": 3,
  ytd: 4,
  "1y": 5,
  "5y": 6,
  all: 7,
};

/**
 * Map an actual [from, to] window length to a sampling cadence.
 * Skips `ytd` — that path is only for an explicit YTD request (intraday samples).
 */
function samplingRangeForSpanDays(days: number): PortfolioChartRange {
  if (days <= 2) return "1d";
  if (days <= 10) return "5d";
  if (days <= 45) return "1m";
  if (days <= 200) return "6m";
  if (days <= 400) return "1y";
  if (days <= 2000) return "5y";
  return "all";
}

/**
 * Dietz / overlays keep the user-selected `requested` range.
 * Point sampling follows how long the clamped window actually is so a young
 * ALL/5Y book gets 1D/5D/1Y cadence instead of sparse weekly marks.
 */
export function effectiveSamplingRange(
  requested: PortfolioChartRange,
  fromYmd: string,
  toYmd: string,
): PortfolioChartRange {
  // YTD uses a dedicated intraday path — never remap away from it.
  if (requested === "ytd") return "ytd";

  const from = parseISO(fromYmd);
  const to = parseISO(toYmd);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return requested;
  }

  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
  const fromSpan = samplingRangeForSpanDays(days);

  // Prefer the denser (shorter-horizon) cadence when the book is younger than the label.
  return RANGE_RANK[fromSpan] < RANGE_RANK[requested] ? fromSpan : requested;
}
