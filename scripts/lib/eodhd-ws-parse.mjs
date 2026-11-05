/** Parse EODHD US trade (`/ws/us`) and quote (`/ws/us-quote`) WebSocket payloads. */

const DISPLAY_TZ = "America/New_York";

export function normalizeStockTicker(raw) {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t || t.includes(":") || t.includes("/") || t.startsWith("$")) return null;
  const base = t.replace(/\.US$/i, "").split(".")[0];
  if (!base || !/^[A-Z0-9-]{1,8}$/.test(base)) return null;
  return base;
}

// Built once: constructing Intl formatters per trade message saturates the CPU at the US open
// (hundreds of ticks/sec), which starves Supabase writes and REST polls until they time out.
const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TZ,
  hour: "numeric",
  minute: "numeric",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CACHE_MAX_ENTRIES = 4_096;
/** @type {Map<number, string>} UTC minute → New York session date */
const ymdByUtcMinute = new Map();
/** @type {Map<string, number>} `${ymd}|${hour}|${minute}` → unix seconds */
const wallClockUnixCache = new Map();

function remember(map, key, value) {
  if (map.size >= CACHE_MAX_ENTRIES) map.clear();
  map.set(key, value);
  return value;
}

/** New York calendar date (`YYYY-MM-DD`) for a unix-seconds instant. */
export function usSessionYmdFromUnixSeconds(sec) {
  const utcMinute = Math.floor(sec / 60);
  const hit = ymdByUtcMinute.get(utcMinute);
  if (hit) return hit;
  return remember(ymdByUtcMinute, utcMinute, YMD_FORMATTER.format(new Date(utcMinute * 60_000)));
}

/** Unix seconds for a New York wall-clock time on `sessionYmd` (DST-aware). */
export function usSessionWallClockUnix(sessionYmd, hour, minute) {
  const key = `${sessionYmd}|${hour}|${minute}`;
  const hit = wallClockUnixCache.get(key);
  if (hit != null) return hit;
  const [y, mo, d] = sessionYmd.split("-").map(Number);
  const guessUtc = Date.UTC(y, mo - 1, d, hour + 5, minute, 0);
  for (let offsetMin = -840; offsetMin <= 840; offsetMin += 15) {
    const probe = new Date(guessUtc + offsetMin * 60 * 1000);
    const parts = WALL_CLOCK_FORMATTER.formatToParts(probe);
    const ph = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
    const pm = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
    const py = parts.find((p) => p.type === "year")?.value;
    const pmo = parts.find((p) => p.type === "month")?.value;
    const pd = parts.find((p) => p.type === "day")?.value;
    const ymd = `${py}-${pmo}-${pd}`;
    if (ymd === sessionYmd && ph === hour && pm === minute) {
      return remember(wallClockUnixCache, key, Math.floor(probe.getTime() / 1000));
    }
  }
  return remember(wallClockUnixCache, key, Math.floor(guessUtc / 1000));
}

function tradeSecInTodayExtendedSession(tradeSec, nowSec) {
  const todayYmd = usSessionYmdFromUnixSeconds(nowSec);
  const openSec = usSessionWallClockUnix(todayYmd, 4, 0);
  const closeSec = usSessionWallClockUnix(todayYmd, 20, 0);
  const tradeYmd = usSessionYmdFromUnixSeconds(tradeSec);
  return tradeYmd === todayYmd && tradeSec >= openSec && tradeSec <= closeSec + 60;
}

/**
 * @param {unknown} rawTs
 * @param {number} nowSec
 */
export function resolveEodhdWsTradeSec(rawTs, nowSec) {
  let t = rawTs;
  if (typeof t === "string" && t.trim()) t = Number(t);
  if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) return nowSec;
  // EODHD stamps are usually ms but µs/ns have appeared; anything past year ~5000 in seconds is a finer unit.
  let sec = t;
  while (sec > 1e11) sec /= 1000;
  const tradeSec = Math.floor(sec);
  if (!Number.isFinite(new Date(tradeSec * 1000).getTime())) return nowSec;
  if (tradeSecInTodayExtendedSession(tradeSec, nowSec)) return tradeSec;
  return nowSec;
}

/**
 * @param {Record<string, unknown>} msg
 * @param {number} [nowSec]
 * @returns {{ sym: string, price: number, tradeSec: number } | null}
 */
export function parseEodhdUsWsMessage(msg, nowSec = Math.floor(Date.now() / 1000)) {
  if (!msg || typeof msg !== "object") return null;
  const sym = normalizeStockTicker(msg.s);
  if (!sym) return null;

  let price = null;
  const last = Number(msg.p);
  if (Number.isFinite(last) && last > 0) {
    price = last;
  } else {
    const ap = Number(msg.ap);
    const bp = Number(msg.bp);
    if (Number.isFinite(ap) && ap > 0 && Number.isFinite(bp) && bp > 0) {
      price = (ap + bp) / 2;
    } else if (Number.isFinite(bp) && bp > 0) {
      price = bp;
    } else if (Number.isFinite(ap) && ap > 0) {
      price = ap;
    }
  }
  if (price == null || !Number.isFinite(price) || price <= 0) return null;

  const tradeSec = resolveEodhdWsTradeSec(msg.t, nowSec);
  return { sym, price, tradeSec };
}
