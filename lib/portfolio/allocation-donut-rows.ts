/** Distinct colors for allocation dots (cycles if there are many positions). */
export const ALLOCATION_DONUT_PALETTE = [
  "#2563EB",
  "#DC2626",
  "#9333EA",
  "#EA580C",
  "#16A34A",
  "#CA8A04",
  "#B91C1C",
  "#64748B",
  "#0891B2",
  "#DB2777",
  "#4F46E5",
  "#65A30D",
] as const;

/** Pie shows top N holdings; remainder rolls into one grey “Other” slice. */
export const TOP_ALLOCATION_SLICES = 10;
export const OTHER_SLICE_COLOR = "#71717A";

export type AllocationDonutRow = {
  id: string;
  name: string;
  symbol: string;
  weightPct: number;
  color: string;
};

export type AllocationDonutWeightInput = {
  id: string;
  name: string;
  symbol: string;
  weightPct: number;
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
    color: ALLOCATION_DONUT_PALETTE[i % ALLOCATION_DONUT_PALETTE.length]!,
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
      });
    }
  }

  return rows;
}
