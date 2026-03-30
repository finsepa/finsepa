import "server-only";

import { getEodhdApiKey } from "@/lib/env/server";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";

export type EodhdFundamentalsHighlights = {
  marketCapUsd: number | null;
  peTrailing: number | null;
  peForward: number | null;
  /** Short display e.g. "Jan 28, 2026" when provider includes a next/last earnings date */
  nextEarningsDateDisplay: string | null;
  sector: string | null;
  industry: string | null;
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** UI format: e.g. Oct 31, 2024. Uses UTC so YYYY-MM-DD calendar dates are not shifted by local TZ. */
export function formatEarningsDateEnUS(v: unknown): string | null {
  const ms = parseUnknownDateToUtcMs(v);
  if (ms == null) return null;
  const d = new Date(ms);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function parseUnknownDateToUtcMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = v;
    const ms = n > 1e12 ? n : n * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const t = Date.parse(s.includes("T") ? s : `${s}T12:00:00.000Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * EODHD fundamentals usually do NOT put the next earnings call in Highlights.
 * The reliable source is `Earnings.History`: each period has `reportDate` (announcement) and `date` (fiscal period end).
 * Demo AAPL: `History["2026-03-31"].reportDate` → "2026-04-29" (upcoming), with `epsActual: null`.
 */
export function resolveEarningsDateDisplay(highlights: Record<string, unknown> | null, root: Record<string, unknown>): string | null {
  const general = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;

  const explicitKeys = [
    "NextEarningsDate",
    "EarningsDate",
    "UpcomingEarningsDate",
    "NextEarningDate",
    "EarningsAnnouncement",
    "NextReportDate",
    "NextEarningsReportDate",
  ] as const;

  for (const src of [highlights, general] as const) {
    if (!src) continue;
    for (const k of explicitKeys) {
      const f = formatEarningsDateEnUS(src[k]);
      if (f) return f;
    }
  }

  const earn = root.Earnings;
  if (earn && typeof earn === "object") {
    const e = earn as Record<string, unknown>;

    const history = e.History;
    if (history && typeof history === "object") {
      const h = history as Record<string, unknown>;
      const today = new Date();
      const startOfTodayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);

      let bestUpcomingMs: number | null = null;
      let bestPastMs: number | null = null;

      for (const row of Object.values(h)) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
        const rawDate = r.date ?? r.Date;
        const primary = rawReport ?? rawDate;
        const ms = parseUnknownDateToUtcMs(primary);
        if (ms == null) continue;
        const day = new Date(ms);
        const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0);
        if (dayStart >= startOfTodayUtc) {
          if (bestUpcomingMs == null || dayStart < bestUpcomingMs) bestUpcomingMs = dayStart;
        } else {
          if (bestPastMs == null || dayStart > bestPastMs) bestPastMs = dayStart;
        }
      }

      if (bestUpcomingMs != null) {
        return formatEarningsDateEnUS(bestUpcomingMs);
      }
      if (bestPastMs != null) {
        return formatEarningsDateEnUS(bestPastMs);
      }
    }

    const dates = e.Dates ?? e.Upcoming;
    if (dates && typeof dates === "object") {
      const d = dates as Record<string, unknown>;
      const nested =
        formatEarningsDateEnUS(d.NextDate ?? d.nextEarningsDate ?? d.Date ?? d.date ?? d.ReportDate ?? d.reportDate) ??
        formatEarningsDateEnUS(d.next);
      if (nested) return nested;
    }

    const trend = e.Trend;
    if (Array.isArray(trend)) {
      const candidates: number[] = [];
      for (const row of trend) {
        if (!row || typeof row !== "object") continue;
        const t = row as Record<string, unknown>;
        const ms = parseUnknownDateToUtcMs(
          t.date ?? t.Date ?? t.reportDate ?? t.ReportDate ?? t.endDate ?? t.EndDate,
        );
        if (ms != null) candidates.push(ms);
      }
      if (candidates.length) {
        const todayMs = Date.now();
        const future = candidates.filter((ms) => ms >= todayMs).sort((a, b) => a - b);
        const pick = future.length ? future[0]! : candidates.sort((a, b) => b - a)[0]!;
        return formatEarningsDateEnUS(pick);
      }
    }
  }

  const hl = highlights;
  if (hl) {
    const mrq = hl.MostRecentQuarter;
    if (typeof mrq === "string" && mrq.trim()) {
      const f = formatEarningsDateEnUS(mrq);
      if (f) return f;
    }
  }

  return null;
}

/**
 * Raw EODHD fundamentals JSON (one HTTP call). Shared by highlights + profile parsers.
 * @see https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/
 */
export async function fetchEodhdFundamentalsJson(ticker: string): Promise<Record<string, unknown> | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdUsSymbol(ticker);
  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(sym)}?api_token=${encodeURIComponent(key)}&fmt=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const root = (await res.json()) as Record<string, unknown> | null;
    if (!root || typeof root !== "object" || "error" in root) return null;
    return root;
  } catch {
    return null;
  }
}

/**
 * Pulls Highlights (market cap, P/E) when available for the subscription.
 * @see https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/
 */
export async function fetchEodhdFundamentalsHighlights(ticker: string): Promise<EodhdFundamentalsHighlights | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  try {
    const hl = root.Highlights;
    const highlights = hl && typeof hl === "object" ? (hl as Record<string, unknown>) : null;

    let marketCapUsd: number | null = null;
    let peTrailing: number | null = null;
    let peForward: number | null = null;
    let sector: string | null = null;
    let industry: string | null = null;

    const gen = root.General;
    if (gen && typeof gen === "object") {
      const g = gen as Record<string, unknown>;
      sector = str(g.Sector);
      industry = str(g.Industry);
    }

    if (highlights) {
      marketCapUsd = num(
        highlights.MarketCapitalization ?? highlights.MarketCapitalisation ?? highlights.MarketCap,
      );
      peTrailing = num(highlights.PERatio ?? highlights.TrailingPE ?? highlights.PeRatio);
      peForward = num(highlights.ForwardPE ?? highlights.ForwardPe ?? highlights.ForwardPEPS);
    }

    const val = root.Valuation;
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      if (marketCapUsd == null) marketCapUsd = num(v.MarketCapitalization);
      if (peTrailing == null) peTrailing = num(v.PERatio ?? v.TrailingPE);
      if (peForward == null) peForward = num(v.ForwardPE);
    }

    const nextEarningsDateDisplay = resolveEarningsDateDisplay(highlights, root);

    if (
      marketCapUsd == null &&
      peTrailing == null &&
      peForward == null &&
      nextEarningsDateDisplay == null &&
      sector == null &&
      industry == null
    ) {
      return null;
    }

    return { marketCapUsd, peTrailing, peForward, nextEarningsDateDisplay, sector, industry };
  } catch {
    return null;
  }
}

