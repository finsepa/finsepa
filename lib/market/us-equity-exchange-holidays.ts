/**
 * NYSE / Nasdaq full-day closures (no regular or extended equity session).
 * Early-close days are not included — only full holidays.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

/** Weekday 0=Sun … 6=Sat (UTC noon probe avoids DST edge cases). */
function weekdayUtcNoon(year: number, month1: number, day: number): number {
  return new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0)).getUTCDay();
}

/** If fixed date falls on Sat → prior Fri; Sun → next Mon. */
function observedFixedYmd(year: number, month1: number, day: number): string {
  const wd = weekdayUtcNoon(year, month1, day);
  if (wd === 6) {
    const d = new Date(Date.UTC(year, month1 - 1, day - 1, 12, 0, 0));
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (wd === 0) {
    const d = new Date(Date.UTC(year, month1 - 1, day + 1, 12, 0, 0));
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return ymd(year, month1, day);
}

/** nth weekday in month (n=1 → first). weekday: 0=Sun … 6=Sat. */
function nthWeekdayYmd(year: number, month1: number, weekday: number, n: number): string {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const dt = new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
    if (dt.getUTCMonth() !== month1 - 1) break;
    if (dt.getUTCDay() !== weekday) continue;
    count += 1;
    if (count === n) return ymd(year, month1, day);
  }
  throw new Error(`nthWeekdayYmd: missing ${n} weekday=${weekday} ${year}-${month1}`);
}

function lastWeekdayYmd(year: number, month1: number, weekday: number): string {
  for (let day = 31; day >= 1; day--) {
    const dt = new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
    if (dt.getUTCMonth() !== month1 - 1) continue;
    if (dt.getUTCDay() === weekday) return ymd(year, month1, day);
  }
  throw new Error(`lastWeekdayYmd: missing weekday=${weekday} ${year}-${month1}`);
}

/** Western Easter Sunday (Anonymous Gregorian algorithm). */
function easterSundayYmd(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

function addDaysYmd(ymdStr: string, deltaDays: number): string {
  const [y, mo, d] = ymdStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, mo! - 1, d! + deltaDays, 12, 0, 0));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Full-day US equity exchange holidays for a calendar year (YYYY-MM-DD, America/New_York dates). */
export function usEquityExchangeHolidayYmdsForYear(year: number): readonly string[] {
  const set = new Set<string>();
  set.add(observedFixedYmd(year, 1, 1));
  set.add(nthWeekdayYmd(year, 1, 1, 3)); // MLK — Monday
  set.add(nthWeekdayYmd(year, 2, 1, 3)); // Presidents — Monday
  set.add(addDaysYmd(easterSundayYmd(year), -2)); // Good Friday
  set.add(lastWeekdayYmd(year, 5, 1)); // Memorial — Monday
  if (year >= 2021) set.add(observedFixedYmd(year, 6, 19)); // Juneteenth
  set.add(observedFixedYmd(year, 7, 4));
  set.add(nthWeekdayYmd(year, 9, 1, 1)); // Labor Day
  set.add(nthWeekdayYmd(year, 11, 4, 4)); // Thanksgiving — Thursday
  set.add(observedFixedYmd(year, 12, 25));

  // New Year's observed on prior Dec 31 when Jan 1 is Saturday.
  if (weekdayUtcNoon(year + 1, 1, 1) === 6) {
    set.add(ymd(year, 12, 31));
  }

  return [...set].sort();
}

const holidayCache = new Map<number, Set<string>>();

function holidaySetForYear(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(usEquityExchangeHolidayYmdsForYear(year));
    holidayCache.set(year, set);
  }
  return set;
}

export function isUsEquityExchangeHolidayYmd(ymdStr: string): boolean {
  const year = Number(ymdStr.slice(0, 4));
  if (!Number.isFinite(year) || ymdStr.length < 10) return false;
  if (holidaySetForYear(year).has(ymdStr)) return true;
  // Dec 31 may be prior-year New Year's observance listed under year+1's Jan 1 Saturday rule
  // (already added into `year` set above). Also check adjacent year sets for safety.
  if (holidaySetForYear(year - 1).has(ymdStr)) return true;
  if (holidaySetForYear(year + 1).has(ymdStr)) return true;
  return false;
}

function nySessionYmdFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isUsEquityExchangeHoliday(now: Date = new Date()): boolean {
  return isUsEquityExchangeHolidayYmd(nySessionYmdFromDate(now));
}
