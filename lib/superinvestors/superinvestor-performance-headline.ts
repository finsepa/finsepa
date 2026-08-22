import type {
  SuperinvestorPerformancePoint,
  SuperinvestorPerformanceSeries,
} from "@/lib/superinvestors/superinvestor-performance-types";

/** Windows aligned with the profile Performance chart. */
export type SuperinvestorPerformanceHeadlineRange = "ytd" | "1y" | "5y";

function rangeStartYmd(range: SuperinvestorPerformanceHeadlineRange, toYmd: string): string {
  const [y, m, d] = toYmd.split("-").map((x) => Number(x));
  const end = new Date(Date.UTC(y!, m! - 1, d!));
  switch (range) {
    case "ytd":
      return `${y}-01-01`;
    case "1y":
      end.setUTCFullYear(end.getUTCFullYear() - 1);
      break;
    case "5y":
      end.setUTCFullYear(end.getUTCFullYear() - 5);
      break;
  }
  return end.toISOString().slice(0, 10);
}

/** Slice to range and rebase so the window opens at 0% (matches profile chart). */
function windowAndRebaseBookReturnPct(
  points: readonly SuperinvestorPerformancePoint[],
  range: SuperinvestorPerformanceHeadlineRange,
): number | null {
  if (points.length < 2) return null;
  const toYmd = points[points.length - 1]!.t;
  const fromYmd = rangeStartYmd(range, toYmd);
  let startIdx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.t <= fromYmd) startIdx = i;
    else break;
  }
  const sliced = points.slice(startIdx);
  if (sliced.length < 2) return null;
  const book0 = sliced[0]!.bookReturnPct;
  const bookBase = 1 + book0 / 100;
  if (bookBase <= 0) return null;
  const last = sliced[sliced.length - 1]!.bookReturnPct;
  return ((1 + last / 100) / bookBase - 1) * 100;
}

export function superinvestorPerformanceHeadlineBookReturnPct(
  series: SuperinvestorPerformanceSeries | null | undefined,
  range: SuperinvestorPerformanceHeadlineRange = "1y",
): number | null {
  if (!series?.points?.length) return null;
  const pct = windowAndRebaseBookReturnPct(series.points, range);
  if (pct == null || !Number.isFinite(pct)) return null;
  return pct;
}

export function formatSuperinvestorPerformancePct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}
