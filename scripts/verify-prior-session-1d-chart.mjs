#!/usr/bin/env node
/**
 * Verify non-WS 1D prior-session intraday (walks back past holidays).
 * Usage: node --env-file=.env.local scripts/verify-prior-session-1d-chart.mjs AVGO
 */

const ticker = (process.argv[2] ?? "AVGO").trim().toUpperCase();
const key = process.env.EODHD_API_KEY?.trim();
if (!key) {
  console.error("Missing EODHD_API_KEY");
  process.exit(1);
}

const STOCK_DISPLAY_TZ = "America/New_York";

function usSessionYmdFromUnixSeconds(sec) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCK_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

function usSessionWallClockUnix(ymd, h, m) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STOCK_DISPLAY_TZ,
    timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(probe);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const m2 = off.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offsetMin = 300;
  if (m2) {
    const sign = m2[1] === "+" ? 1 : -1;
    offsetMin = sign * (parseInt(m2[2], 10) * 60 + parseInt(m2[3] || "0", 10));
  }
  return Math.floor((Date.UTC(y, mo - 1, d, h, m, 0) - offsetMin * 60 * 1000) / 1000);
}

function previousUsTradingSessionYmd(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  let cursor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  for (let i = 0; i < 12; i++) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: STOCK_DISPLAY_TZ, weekday: "short" }).format(cursor);
    if (wd === "Sat" || wd === "Sun") continue;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: STOCK_DISPLAY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
  }
  return ymd;
}

function lastCompletedUsRegularSessionYmd(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STOCK_DISPLAY_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayMinutes = hour * 60 + minute;
  const todayYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCK_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const session =
    weekdayShort === "Sat" || weekdayShort === "Sun"
      ? "closed"
      : dayMinutes < 9 * 60 + 30
        ? "pre"
        : dayMinutes < 16 * 60
          ? "regular"
          : dayMinutes < 20 * 60
            ? "post"
            : "closed";

  let closeSec;
  if (session === "post" || (session === "closed" && dayMinutes >= 20 * 60)) {
    closeSec = usSessionWallClockUnix(todayYmd, 16, 0);
  } else {
    let cursor = new Date(now.getTime());
    for (let i = 0; i < 10; i++) {
      cursor = new Date(cursor.getTime() - 86_400_000);
      const wd = new Intl.DateTimeFormat("en-US", { timeZone: STOCK_DISPLAY_TZ, weekday: "short" }).format(cursor);
      if (wd === "Sat" || wd === "Sun") continue;
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: STOCK_DISPLAY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor);
      closeSec = usSessionWallClockUnix(ymd, 16, 0);
      break;
    }
  }
  return usSessionYmdFromUnixSeconds(closeSec);
}

async function fetchSession1m(sessionYmd) {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    from: String(openSec),
    to: String(closeSec),
    interval: "1m",
  });
  const url = `https://eodhd.com/api/intraday/${encodeURIComponent(ticker)}.US?${params}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

let sessionYmd = lastCompletedUsRegularSessionYmd();
console.log(`Ticker: ${ticker}`);
console.log(`Calendar last-completed session: ${sessionYmd}`);

for (let attempt = 0; attempt < 8; attempt++) {
  const bars = await fetchSession1m(sessionYmd);
  const closes = bars.map((b) => b.close).filter((c) => typeof c === "number");
  const spread = closes.length ? (Math.max(...closes) - Math.min(...closes)).toFixed(2) : "n/a";
  console.log(`  try ${sessionYmd}: ${bars.length} bars, spread $${spread}`);
  if (bars.length >= 2) {
    console.log(`OK — chart session ${sessionYmd}, first=${closes[0]?.toFixed(2)} last=${closes[closes.length - 1]?.toFixed(2)}`);
    process.exit(0);
  }
  sessionYmd = previousUsTradingSessionYmd(sessionYmd);
}

console.error("FAIL — no intraday session found in 8 attempts");
process.exit(1);
