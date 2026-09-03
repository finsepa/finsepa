import type { PeriodReturnGranularity } from "@/lib/portfolio/portfolio-period-returns-types";

/** Same lookback as period-return buckets (`subYears(now, 12)`). */
export const PERIOD_RETURN_HISTORY_YEARS = 12;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Calendar years with returns history, newest first.
 * Used for Monthly / Quarterly year tabs (Annually already plots years).
 */
export function portfolioPeriodReturnYears(
  transactions: readonly { date: string }[],
  now = new Date(),
): number[] {
  const nowY = now.getFullYear();
  let minY = nowY;
  let any = false;
  for (const t of transactions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    any = true;
    minY = Math.min(minY, Number(t.date.slice(0, 4)));
  }
  if (!any) return [];
  minY = Math.max(minY, nowY - PERIOD_RETURN_HISTORY_YEARS);
  const years: number[] = [];
  for (let y = nowY; y >= minY; y -= 1) years.push(y);
  return years;
}

/** Newest year in the list — default when Monthly / Quarterly is selected. */
export function latestPeriodReturnYear(years: readonly number[]): number | null {
  return years[0] ?? null;
}

/** Axis label inside a selected year (year is already on the tab). */
export function periodReturnBarLabelForYear(
  periodStart: string,
  granularity: PeriodReturnGranularity,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) return periodStart;
  const month = Number(periodStart.slice(5, 7));
  const abbr = MONTH_ABBR[month - 1];
  if (granularity === "monthly") return abbr ?? periodStart;
  if (granularity === "quarterly") return `Q${Math.ceil(month / 3)}`;
  return periodStart.slice(0, 4);
}
