/**
 * Session-mark resolution for Dynamics of portfolio returns (pure — no I/O).
 */
import { format, parseISO, subDays } from "date-fns";

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdSubDays(ymdStr: string, days: number): string {
  const d = parseYmd(ymdStr);
  if (!d) return ymdStr;
  return ymd(subDays(d, days));
}

function lastBarDateOnOrBefore(bars: readonly { date: string }[], ymdStr: string): string | null {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = bars[mid]!.date;
    if (t <= ymdStr) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans]!.date : null;
}

/**
 * Resolve Dietz session marks for one dynamics bucket.
 * Handles inception-year buckets when the calendar year opens before the first trade
 * (need prior-year session, or snap to day-before-first-tx with V_B = 0).
 */
export function resolvePeriodReturnSessionMarks(args: {
  periodStart: string;
  periodEnd: string;
  asOfYmd: string;
  firstTxYmd: string;
  benchSorted: readonly { date: string }[];
}): { d0: string; d1: string } | null {
  const periodEndAsOf = args.periodEnd > args.asOfYmd ? args.asOfYmd : args.periodEnd;
  if (periodEndAsOf < args.firstTxYmd) return null;

  const preStart = ymdSubDays(args.periodStart, 1);
  let d0 = lastBarDateOnOrBefore(args.benchSorted, preStart);
  let d1 = lastBarDateOnOrBefore(args.benchSorted, periodEndAsOf);

  if ((!d0 || !d1 || d0 >= d1) && args.firstTxYmd <= periodEndAsOf) {
    const firstDt = parseYmd(args.firstTxYmd);
    const inceptionPre = firstDt ? ymd(subDays(firstDt, 1)) : ymdSubDays(args.firstTxYmd, 1);
    d0 = lastBarDateOnOrBefore(args.benchSorted, inceptionPre) ?? inceptionPre;
    d1 = lastBarDateOnOrBefore(args.benchSorted, periodEndAsOf);
  }

  if (!d0 || !d1 || d0 >= d1) return null;
  return { d0, d1 };
}
