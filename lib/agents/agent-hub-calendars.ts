/**
 * Agent warm-hub calendar / macro reads — snapshot only.
 * NEVER call getEarningsWeekPayload / getEconomyWeekPayload / getMacroDashboardPayloadCached
 * (those cold-build via EODHD). Soft-fail when the hub row is missing.
 */
import "server-only";

import type { EarningsCalendarItem, EarningsWeekPayload } from "@/lib/market/earnings-calendar-types";
import type { EconomyWeekPayload } from "@/lib/market/economy-calendar-types";
import {
  HUB_SNAPSHOT_KEY,
  economyWeekHubSegment,
  earningsWeekHubSegment,
  hubEconomyWeekKey,
  hubEarningsWeekKey,
  macroHubSegment,
} from "@/lib/market/hub-snapshot-keys";
import { readHubSnapshot } from "@/lib/market/hub-snapshot-store";
import { addDaysUtc, mondayOfWeekUtc, toYmdUtc } from "@/lib/market/utc-calendar-dates";

/** Hub row may be the package `{ payload }` or the payload itself. */
type EarningsWeekHubSnap = EarningsWeekPayload | { payload: EarningsWeekPayload };

/** Minimal macro card shape — avoid importing macro-dashboard-payload (EODHD builders). */
type MacroCardSnap = {
  id: string;
  title: string;
  kind: string;
  latest?: { time: string; value: number } | null;
  change?: { abs: number; pct: number | null } | null;
};

function resolveWeekMondayYmd(weekOffset = 0): { monday: Date; ymd: string } {
  const base = mondayOfWeekUtc(new Date());
  const monday = addDaysUtc(base, weekOffset * 7);
  return { monday, ymd: toYmdUtc(monday) };
}

function slimEarningsItem(item: EarningsCalendarItem) {
  return {
    ticker: item.ticker,
    companyName: item.companyName,
    reportDate: item.reportDate,
    timingLabel: item.timingLabel,
    estEpsDisplay: item.estEpsDisplay ?? null,
    estRevenueDisplay: item.estRevenueDisplay ?? null,
  };
}

function flattenEarningsDay(day: EarningsWeekPayload["days"][number]) {
  if (day.listItems?.length) return day.listItems.map(slimEarningsItem);
  return [
    ...day.beforeMarket.items,
    ...day.afterMarket.items,
    ...day.timeTbd.items,
  ].map(slimEarningsItem);
}

/** Current (or offset) earnings week from hub snapshot only. */
export async function loadAgentEarningsWeek(args?: {
  weekOffset?: number;
  limitPerDay?: number;
}) {
  const weekOffset = Math.min(Math.max(args?.weekOffset ?? 0, -2), 4);
  const limitPerDay = Math.min(Math.max(args?.limitPerDay ?? 8, 1), 20);
  const { ymd } = resolveWeekMondayYmd(weekOffset);
  const segment = earningsWeekHubSegment(ymd);
  const pack = await readHubSnapshot<EarningsWeekHubSnap>(hubEarningsWeekKey(ymd), segment);

  if (!pack) {
    return {
      ok: false as const,
      weekMondayYmd: ymd,
      weekOffset,
      openInApp: "/earnings" as const,
      note: "Earnings week hub snapshot is not warm. Open Earnings in Finsepa — Agent will not cold-fetch calendar APIs.",
    };
  }

  const payload: EarningsWeekPayload = "payload" in pack && pack.payload ? pack.payload : (pack as EarningsWeekPayload);

  const days = (payload.days ?? []).map((day) => {
    const all = flattenEarningsDay(day);
    return {
      date: day.date,
      weekdayLabel: day.weekdayLabel,
      count: all.length,
      reports: all.slice(0, limitPerDay),
      truncated: all.length > limitPerDay,
    };
  });

  const totalReports = days.reduce((s, d) => s + d.count, 0);

  return {
    ok: true as const,
    weekMondayYmd: payload.weekMondayYmd ?? ymd,
    weekLabel: payload.weekLabel ?? null,
    weekOffset,
    openInApp: "/earnings" as const,
    hasAnyEvents: Boolean(payload.hasAnyEvents) || totalReports > 0,
    totalReports,
    days,
    note: "From Finsepa earnings hub cache only — not a live EODHD pull.",
  };
}

/** Current (or offset) economy week from hub snapshot only. */
export async function loadAgentEconomyWeek(args?: {
  weekOffset?: number;
  country?: string;
  limitPerDay?: number;
  minImportance?: 1 | 2 | 3;
}) {
  const weekOffset = Math.min(Math.max(args?.weekOffset ?? 0, -2), 4);
  const limitPerDay = Math.min(Math.max(args?.limitPerDay ?? 10, 1), 25);
  const minImportance = args?.minImportance ?? 1;
  const country = (args?.country ?? "US").trim().toUpperCase() || "US";
  const { ymd } = resolveWeekMondayYmd(weekOffset);
  const segment = economyWeekHubSegment(ymd, country);
  const payload = await readHubSnapshot<EconomyWeekPayload>(hubEconomyWeekKey(ymd, country), segment);

  if (!payload) {
    return {
      ok: false as const,
      weekMondayYmd: ymd,
      weekOffset,
      country,
      openInApp: "/economy" as const,
      note: "Economy week hub snapshot is not warm. Open Economy in Finsepa — Agent will not cold-fetch calendar APIs.",
    };
  }

  const days = (payload.days ?? []).map((day) => {
    const filtered = (day.events ?? []).filter((e) => e.importance >= minImportance);
    return {
      date: day.date,
      weekdayLabel: day.weekdayLabel,
      count: filtered.length,
      events: filtered.slice(0, limitPerDay).map((e) => ({
        type: e.type,
        importance: e.importance,
        period: e.period,
        actual: e.actual,
        estimate: e.estimate,
        previous: e.previous,
        dateRaw: e.dateRaw,
      })),
      truncated: filtered.length > limitPerDay,
    };
  });

  const totalEvents = days.reduce((s, d) => s + d.count, 0);

  return {
    ok: true as const,
    weekMondayYmd: payload.weekMondayYmd ?? ymd,
    weekLabel: payload.weekLabel ?? null,
    weekOffset,
    country,
    openInApp: "/economy" as const,
    totalEvents,
    days,
    note: "From Finsepa economy hub cache only — not a live EODHD pull.",
  };
}

/** Macro dashboard cards from hub snapshot only (latest + change; no full series). */
export async function loadAgentMacroDashboard(args?: { limit?: number }) {
  const limit = Math.min(Math.max(args?.limit ?? 24, 1), 40);
  const segment = macroHubSegment();
  const snap = await readHubSnapshot<{ country?: string; items?: MacroCardSnap[] }>(
    HUB_SNAPSHOT_KEY.macroDashboard,
    segment,
  );

  if (!snap?.items?.length) {
    return {
      ok: false as const,
      openInApp: "/macro" as const,
      note: "Macro hub snapshot is not warm. Open Macro in Finsepa — Agent will not cold-fetch macro APIs.",
    };
  }

  const cards = snap.items.slice(0, limit).map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.kind,
    latestValue: c.latest?.value ?? null,
    latestTime: c.latest?.time ?? null,
    changeAbs: c.change?.abs ?? null,
    changePct: c.change?.pct ?? null,
  }));

  return {
    ok: true as const,
    country: snap.country ?? "USA",
    openInApp: "/macro" as const,
    cardCount: snap.items.length,
    cards,
    note: "From Finsepa macro hub cache only — latest values, not a live EODHD pull. Full chart history is in /macro.",
  };
}
