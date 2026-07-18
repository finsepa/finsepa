/** Total meter bars — 12 bars, 1 bar ≈ 1 week (~one quarter window). */
export const EARNINGS_COUNTDOWN_BARS = 12;

/**
 * Green/blue bars fill as earnings approaches (empty/grey when far, full when due).
 * 1 bar ≈ 1 week remaining emptied from the meter; clamp to the 12-bar window.
 */
export function earningsCountdownFilledBars(daysLeft: number): number {
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return EARNINGS_COUNTDOWN_BARS;
  const weeksLeft = Math.min(EARNINGS_COUNTDOWN_BARS, Math.max(0, Math.ceil(daysLeft / 7)));
  return EARNINGS_COUNTDOWN_BARS - weeksLeft;
}

/** Parse a `YYYY-MM-DD` report date into UTC midnight ms + calendar parts. */
export function parseEarningsReportYmd(
  ymd: string | null | undefined,
): { utcMs: number; monthIdx: number; day: string } | null {
  const raw = ymd?.trim() ?? "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null;
  return {
    day: String(day),
    monthIdx,
    utcMs: Date.UTC(year, monthIdx, day),
  };
}

/** Convert en-US display like "Sep 10, 2026" → `YYYY-MM-DD` (local calendar parts). */
export function earningsDateDisplayToYmd(display: string | null | undefined): string | null {
  const raw = display?.trim() ?? "";
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole calendar days from today (local) until report YMD; null when past / unparseable. */
export function earningsDaysLeftFromYmd(
  ymd: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const parsed = parseEarningsReportYmd(ymd);
  if (!parsed) return null;
  const nowUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((parsed.utcMs - nowUtcMs) / 86_400_000);
  if (daysLeft < 0) return null;
  return daysLeft;
}
