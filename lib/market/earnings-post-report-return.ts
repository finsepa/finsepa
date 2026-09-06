/**
 * Next-session stock return after an earnings report date.
 * Pure math on daily EOD closes — no provider I/O.
 *
 * Definition: (close of first session strictly after reportDate) /
 * (close of last session on or before reportDate) − 1, as percent.
 * Fits AMC well with daily bars; BMO is approximate (report-day close already
 * includes the open reaction).
 */

export type DailyCloseBar = {
  date: string;
  close: number;
};

export function postReportOneSessionReturnPct(
  barsSortedAsc: readonly DailyCloseBar[],
  reportDateYmd: string,
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDateYmd) || barsSortedAsc.length < 2) return null;

  let baseIdx = -1;
  for (let i = 0; i < barsSortedAsc.length; i++) {
    const d = barsSortedAsc[i]!.date;
    if (d <= reportDateYmd) baseIdx = i;
    else break;
  }
  if (baseIdx < 0) return null;

  const nextIdx = baseIdx + 1;
  if (nextIdx >= barsSortedAsc.length) return null;

  const base = barsSortedAsc[baseIdx]!.close;
  const next = barsSortedAsc[nextIdx]!.close;
  if (!(base > 0) || !Number.isFinite(base) || !Number.isFinite(next) || next <= 0) return null;

  const pct = ((next / base) - 1) * 100;
  return Number.isFinite(pct) ? pct : null;
}
