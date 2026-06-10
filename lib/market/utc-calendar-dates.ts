function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Monday 00:00 UTC of the week containing `date` (week starts Monday). */
export function mondayOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Month + year label from UTC calendar days (e.g. Mon–Fri `YYYY-MM-DD` keys). */
export function formatWeekMonthYearLabelFromYmds(ymds: readonly string[]): string {
  if (ymds.length === 0) return "";

  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const ymd of ymds) {
    const t = Date.parse(`${ymd.trim()}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const key = `${year}-${month}`;
    const prev = counts.get(key);
    counts.set(key, prev ? { ...prev, count: prev.count + 1 } : { year, month, count: 1 });
  }

  let best: { year: number; month: number; count: number } | null = null;
  for (const entry of counts.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count &&
        (entry.year > best.year || (entry.year === best.year && entry.month > best.month)))
    ) {
      best = entry;
    }
  }

  if (!best) return "";

  const anchor = new Date(Date.UTC(best.year, best.month, 1, 12, 0, 0));
  return anchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Calendar page title — month + year for the work week (majority month across Mon–Fri). */
export function formatWeekMonthYearLabel(weekMonday: Date): string {
  const ymds = Array.from({ length: 5 }, (_, i) => toYmdUtc(addDaysUtc(weekMonday, i)));
  return formatWeekMonthYearLabelFromYmds(ymds);
}
