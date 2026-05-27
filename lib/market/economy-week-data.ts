import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import type { EconomyCalendarEvent, EconomyDayColumn, EconomyWeekPayload } from "@/lib/market/economy-calendar-types";
import { fetchEodhdEconomicEventsAll, type EodhdRawEconomicEventRow } from "@/lib/market/eodhd-economic-events";
import { addDaysUtc, formatWeekRangeLabel, mondayOfWeekUtc, toYmdUtc } from "@/lib/market/earnings-week-data";
import { economyWeekHubSegment, hubEconomyWeekKey } from "@/lib/market/hub-snapshot-keys";
import { readHubSnapshot } from "@/lib/market/hub-snapshot-store";

function weekdayShortUtc(ymd: string): string {
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function parseInstantUtcMs(dateRaw: string | undefined): number | null {
  if (!dateRaw?.trim()) return null;
  const s = dateRaw.trim();
  const iso = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function eventInstantToUtcYmd(ms: number): string {
  return toYmdUtc(new Date(ms));
}

const HIGH_IMPACT_RE =
  /cpi|ppi|pce|nonfarm|payrolls|gdp|fed|fomc|interest rate|unemployment|jobless|retail sales|ism\s|pmi|housing starts|building permits|trade balance|consumer confidence/i;

const MEDIUM_IMPACT_RE =
  /industrial production|durable goods|factory orders|productivity|claims|adp|nfib|business inventories|current account/i;

function importanceFromType(type: string): 1 | 2 | 3 {
  const t = type.trim();
  if (!t) return 1;
  if (HIGH_IMPACT_RE.test(t)) return 3;
  if (MEDIUM_IMPACT_RE.test(t)) return 2;
  return 1;
}

function stableEventId(row: EodhdRawEconomicEventRow): string {
  const type = row.type ?? "";
  const country = (row.country ?? "").toUpperCase();
  const date = row.date ?? "";
  const comp = row.comparison ?? "";
  return `${country}|${date}|${type}|${comp}`;
}

function rawToEvent(row: EodhdRawEconomicEventRow): EconomyCalendarEvent | null {
  const type = row.type?.trim();
  if (!type) return null;
  const country = (row.country ?? "").trim().toUpperCase() || "US";
  const ms = parseInstantUtcMs(row.date);
  if (ms == null) return null;
  return {
    id: stableEventId(row),
    type,
    comparison: row.comparison ?? null,
    period: row.period ?? null,
    country,
    dateRaw: row.date ?? "",
    instantMs: ms,
    actual: row.actual ?? null,
    previous: row.previous ?? null,
    estimate: row.estimate ?? null,
    importance: importanceFromType(type),
  };
}

function utcMondayFromYmd(weekMondayYmd: string): Date {
  const [y, mo, d] = weekMondayYmd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d));
}

async function buildEconomyWeekPayloadUncached(weekMondayYmd: string, countryCode: string): Promise<EconomyWeekPayload> {
  const monday = utcMondayFromYmd(weekMondayYmd);
  const friday = addDaysUtc(monday, 4);
  const fromYmd = toYmdUtc(monday);
  const toYmd = toYmdUtc(friday);
  const cc = countryCode.trim().toUpperCase() || "US";

  const raw = await fetchEodhdEconomicEventsAll(fromYmd, toYmd, cc);
  const seen = new Set<string>();
  const events: EconomyCalendarEvent[] = [];
  for (const row of raw) {
    const e = rawToEvent(row);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    events.push(e);
  }

  const weekdayYmds: string[] = [];
  for (let i = 0; i < 5; i++) {
    weekdayYmds.push(toYmdUtc(addDaysUtc(monday, i)));
  }

  const byDay = new Map<string, EconomyCalendarEvent[]>();
  for (const ymd of weekdayYmds) {
    byDay.set(ymd, []);
  }

  for (const e of events) {
    const ymd = eventInstantToUtcYmd(e.instantMs);
    const bucket = byDay.get(ymd);
    if (!bucket) continue;
    bucket.push(e);
  }

  const days: EconomyDayColumn[] = [];
  for (let i = 0; i < 5; i++) {
    const d = addDaysUtc(monday, i);
    const ymd = weekdayYmds[i]!;
    const list = byDay.get(ymd) ?? [];
    list.sort((a, b) => a.instantMs - b.instantMs);
    days.push({
      date: ymd,
      weekdayLabel: weekdayShortUtc(ymd),
      dayNumber: String(d.getUTCDate()),
      events: list,
    });
  }

  return {
    weekMondayYmd: fromYmd,
    weekLabel: formatWeekRangeLabel(monday, friday),
    days,
  };
}

const getEconomyWeekPayloadCached = unstable_cache(buildEconomyWeekPayloadUncached, ["economy-week-payload-v2-hub"], {
  revalidate: REVALIDATE_EARNINGS_CALENDAR,
});

/** Cron / hub ingest — bypasses Supabase read path. */
export async function buildEconomyWeekHubPayload(weekMondayUtc: Date, countryCode: string): Promise<EconomyWeekPayload> {
  const ymd = toYmdUtc(mondayOfWeekUtc(weekMondayUtc));
  const cc = countryCode.trim().toUpperCase() || "US";
  return buildEconomyWeekPayloadUncached(ymd, cc);
}

/** Week grid payload — hub snapshot first, then `unstable_cache` per Monday + country. */
export async function getEconomyWeekPayload(weekMondayUtc: Date, countryCode: string): Promise<EconomyWeekPayload> {
  const ymd = toYmdUtc(mondayOfWeekUtc(weekMondayUtc));
  const cc = countryCode.trim().toUpperCase() || "US";
  const segment = economyWeekHubSegment(ymd, cc);
  const snap = await readHubSnapshot<EconomyWeekPayload>(hubEconomyWeekKey(ymd, cc), segment);
  if (snap) return snap;
  return getEconomyWeekPayloadCached(ymd, cc);
}
