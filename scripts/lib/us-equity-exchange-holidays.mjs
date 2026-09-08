/**
 * NYSE / Nasdaq full-day closures — keep in sync with
 * `lib/market/us-equity-exchange-holidays.ts`.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(year, month1, day) {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

function weekdayUtcNoon(year, month1, day) {
  return new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0)).getUTCDay();
}

function observedFixedYmd(year, month1, day) {
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

function nthWeekdayYmd(year, month1, weekday, n) {
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

function lastWeekdayYmd(year, month1, weekday) {
  for (let day = 31; day >= 1; day--) {
    const dt = new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
    if (dt.getUTCMonth() !== month1 - 1) continue;
    if (dt.getUTCDay() === weekday) return ymd(year, month1, day);
  }
  throw new Error(`lastWeekdayYmd: missing weekday=${weekday} ${year}-${month1}`);
}

function easterSundayYmd(year) {
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

function addDaysYmd(ymdStr, deltaDays) {
  const [y, mo, d] = ymdStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + deltaDays, 12, 0, 0));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** @param {number} year */
export function usEquityExchangeHolidayYmdsForYear(year) {
  const set = new Set();
  set.add(observedFixedYmd(year, 1, 1));
  set.add(nthWeekdayYmd(year, 1, 1, 3));
  set.add(nthWeekdayYmd(year, 2, 1, 3));
  set.add(addDaysYmd(easterSundayYmd(year), -2));
  set.add(lastWeekdayYmd(year, 5, 1));
  if (year >= 2021) set.add(observedFixedYmd(year, 6, 19));
  set.add(observedFixedYmd(year, 7, 4));
  set.add(nthWeekdayYmd(year, 9, 1, 1));
  set.add(nthWeekdayYmd(year, 11, 4, 4));
  set.add(observedFixedYmd(year, 12, 25));
  if (weekdayUtcNoon(year + 1, 1, 1) === 6) {
    set.add(ymd(year, 12, 31));
  }
  return [...set].sort();
}

/** @type {Map<number, Set<string>>} */
const holidayCache = new Map();

function holidaySetForYear(year) {
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(usEquityExchangeHolidayYmdsForYear(year));
    holidayCache.set(year, set);
  }
  return set;
}

/** @param {string} ymdStr */
export function isUsEquityExchangeHolidayYmd(ymdStr) {
  const year = Number(ymdStr.slice(0, 4));
  if (!Number.isFinite(year) || ymdStr.length < 10) return false;
  if (holidaySetForYear(year).has(ymdStr)) return true;
  if (holidaySetForYear(year - 1).has(ymdStr)) return true;
  if (holidaySetForYear(year + 1).has(ymdStr)) return true;
  return false;
}

/** @param {Date} [now] */
export function nySessionYmdFromDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** @param {Date} [now] */
export function isUsEquityExchangeHoliday(now = new Date()) {
  return isUsEquityExchangeHolidayYmd(nySessionYmdFromDate(now));
}
