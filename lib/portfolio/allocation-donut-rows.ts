import type { AppIcon } from "@/lib/icons";

import {
  FUNDAMENTALS_MULTI_BAR_COLORS,
  fundamentalsBarSolidAtIndex,
} from "@/lib/colors/fundamentals-multi-bar-colors";

/** Same cycle as Charting / Multicharts bar series. */
export const ALLOCATION_DONUT_PALETTE = FUNDAMENTALS_MULTI_BAR_COLORS;

/** Pie shows top N holdings; remainder rolls into one grey “Other” slice. */
export const TOP_ALLOCATION_SLICES = 10;
export const OTHER_SLICE_COLOR = "#71717A";

export type AllocationDonutRow = {
  id: string;
  name: string;
  symbol: string;
  weightPct: number;
  color: string;
  logoUrl?: string | null;
  /** When set, the external label shows this icon on a `color` tile instead of a company logo. */
  badgeIcon?: AppIcon | null;
};

export type AllocationDonutWeightInput = {
  id: string;
  name: string;
  symbol: string;
  weightPct: number;
  logoUrl?: string | null;
};

export function buildTopNAllocationRows(raw: AllocationDonutWeightInput[]): AllocationDonutRow[] {
  const sorted = [...raw]
    .map((r) => ({
      ...r,
      weightPct: Math.min(100, Math.max(0, r.weightPct)),
    }))
    .sort((a, b) => b.weightPct - a.weightPct);

  const top = sorted.slice(0, TOP_ALLOCATION_SLICES);
  const rest = sorted.slice(TOP_ALLOCATION_SLICES);
  const rows: AllocationDonutRow[] = top.map((r, i) => ({
    ...r,
    color: fundamentalsBarSolidAtIndex(i),
  }));

  if (rest.length > 0) {
    const otherPct = rest.reduce((sum, r) => sum + r.weightPct, 0);
    if (otherPct > 0) {
      rows.push({
        id: "allocation-other",
        name: "Other",
        symbol: "Other",
        weightPct: otherPct,
        color: OTHER_SLICE_COLOR,
        logoUrl: null,
      });
    }
  }

  return rows;
}
