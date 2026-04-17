import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
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

function earningsRowHasReportDate(r: Record<string, unknown>): boolean {
  const v = r.reportDate ?? r.ReportDate ?? r.report_date;
  return typeof v === "string" && v.trim().length > 0;
}

/** True when EODHD has filled actual EPS for the period (already reported). */
function earningsRowIsReported(r: Record<string, unknown>): boolean {
  const a = r.epsActual ?? r.EPSActual ?? r.eps_actual;
  if (a == null || a === "") return false;
  if (typeof a === "string" && !a.trim()) return false;
  return true;
}

function startOfTodayUtcMs(): number {
  const today = new Date();
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0);
}

function pad2Calendar(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC calendar YYYY-MM-DD from epoch ms (announcement day). */
export function ymdUtcFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2Calendar(d.getUTCMonth() + 1)}-${pad2Calendar(d.getUTCDate())}`;
}

function pushYmdIfInWeek(
  candidates: { ymd: string; t: number }[],
  allowedYmds: ReadonlySet<string>,
  ms: number | null,
): void {
  if (ms == null) return;
  const d = new Date(ms);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  const ymd = ymdUtcFromMs(dayStart);
  if (allowedYmds.has(ymd)) candidates.push({ ymd, t: dayStart });
}

/**
 * When the bulk `/calendar/earnings` feed omits a symbol, use fundamentals to find an announcement
 * on one of the Mon–Fri YYYY-MM-DD keys in {@link allowedYmds}.
 */
export function findFundamentalsAnnouncementYmdInWeek(
  root: Record<string, unknown> | null,
  allowedYmds: ReadonlySet<string>,
): string | null {
  if (!root) return null;
  const candidates: { ymd: string; t: number }[] = [];

  const earn = root.Earnings;
  if (earn && typeof earn === "object") {
    const e = earn as Record<string, unknown>;
    const history = e.History;
    if (history && typeof history === "object") {
      const h = history as Record<string, unknown>;
      for (const row of Object.values(h)) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
        const rawDate = r.date ?? r.Date;
        const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
        pushYmdIfInWeek(candidates, allowedYmds, parseUnknownDateToUtcMs(primary));
      }
    }

    const dates = e.Dates ?? e.Upcoming;
    if (dates && typeof dates === "object") {
      const d = dates as Record<string, unknown>;
      for (const v of [
        d.NextDate,
        d.nextEarningsDate,
        d.Date,
        d.date,
        d.ReportDate,
        d.reportDate,
        d.next,
      ]) {
        pushYmdIfInWeek(candidates, allowedYmds, parseUnknownDateToUtcMs(v));
      }
    }

    const trend = e.Trend;
    if (Array.isArray(trend)) {
      for (const row of trend) {
        if (!row || typeof row !== "object") continue;
        const t = row as Record<string, unknown>;
        pushYmdIfInWeek(
          candidates,
          allowedYmds,
          parseUnknownDateToUtcMs(
            t.date ?? t.Date ?? t.reportDate ?? t.ReportDate ?? t.endDate ?? t.EndDate,
          ),
        );
      }
    }
  }

  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
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
  for (const src of [hl, general] as const) {
    if (!src) continue;
    for (const k of explicitKeys) {
      pushYmdIfInWeek(candidates, allowedYmds, parseUnknownDateToUtcMs(src[k]));
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.t - b.t || a.ymd.localeCompare(b.ymd));
  return candidates[0]!.ymd;
}

/**
 * Prefer `Earnings.History` (per-ticker report dates) before Highlights — Highlights/General
 * sometimes carry generic or stale `NextEarningsDate` values that make many symbols look identical.
 *
 * `reportDate` is the announcement date; `date` is fiscal period end — we prefer reportDate when available.
 */
function resolveFromEarningsObject(e: Record<string, unknown>): string | null {
  const history = e.History;
  if (history && typeof history === "object") {
    const h = history as Record<string, unknown>;
    const startToday = startOfTodayUtcMs();

    const rows: Record<string, unknown>[] = [];
    for (const row of Object.values(h)) {
      if (row && typeof row === "object") rows.push(row as Record<string, unknown>);
    }

    let anyFutureWithReport = false;
    for (const r of rows) {
      const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
      const rawDate = r.date ?? r.Date;
      const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
      const ms = parseUnknownDateToUtcMs(primary);
      if (ms == null) continue;
      const d = new Date(ms);
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
      if (dayStart >= startToday && earningsRowHasReportDate(r) && !earningsRowIsReported(r)) {
        anyFutureWithReport = true;
        break;
      }
    }

    let bestUpcomingMs: number | null = null;
    let bestPastMs: number | null = null;

    for (const r of rows) {
      const rawReport = r.reportDate ?? r.ReportDate ?? r.report_date;
      const rawDate = r.date ?? r.Date;
      const primary = (typeof rawReport === "string" && rawReport.trim() ? rawReport : null) ?? rawDate;
      const ms = parseUnknownDateToUtcMs(primary);
      if (ms == null) continue;
      const d = new Date(ms);
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);

      if (dayStart >= startToday) {
        if (earningsRowIsReported(r)) continue;
        if (anyFutureWithReport && !earningsRowHasReportDate(r)) continue;
        if (bestUpcomingMs == null || dayStart < bestUpcomingMs) bestUpcomingMs = dayStart;
      } else {
        if (bestPastMs == null || dayStart > bestPastMs) bestPastMs = dayStart;
      }
    }

    if (bestUpcomingMs != null) return formatEarningsDateEnUS(bestUpcomingMs);
    if (bestPastMs != null) return formatEarningsDateEnUS(bestPastMs);
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

  return null;
}

/**
 * EODHD fundamentals: next/last earnings for UI (watchlist, stock header).
 * History is evaluated before Highlights so values are ticker-specific.
 */
export function resolveEarningsDateDisplay(highlights: Record<string, unknown> | null, root: Record<string, unknown>): string | null {
  const general = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;

  const earn = root.Earnings;
  if (earn && typeof earn === "object") {
    const fromEarn = resolveFromEarningsObject(earn as Record<string, unknown>);
    if (fromEarn) return fromEarn;
  }

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

  if (highlights) {
    const mrq = highlights.MostRecentQuarter;
    if (typeof mrq === "string" && mrq.trim()) {
      const f = formatEarningsDateEnUS(mrq);
      if (f) return f;
    }
  }

  return null;
}

/**
 * Raw EODHD fundamentals JSON (one HTTP call). Shared by highlights + profile parsers.
 * Cached per ticker so parallel key-stats / header / profile work shares one upstream request.
 * @see https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds/
 */
async function fetchEodhdFundamentalsJsonUncached(ticker: string): Promise<Record<string, unknown> | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const sym = toEodhdUsSymbol(ticker);
  const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(sym)}?api_token=${encodeURIComponent(key)}&fmt=json`;

  try {
    if (!traceEodhdHttp("fetchEodhdFundamentalsJsonUncached", { symbol: sym })) return null;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const root = (await res.json()) as Record<string, unknown> | null;
    if (!root || typeof root !== "object" || "error" in root) return null;
    return root;
  } catch {
    return null;
  }
}

/**
 * Same HTTP payload as {@link fetchEodhdFundamentalsJson} but skips `unstable_cache`.
 * Use for explicit refresh flows (e.g. `?refresh=1` on key-stats-bundle).
 */
export async function fetchEodhdFundamentalsJsonFresh(ticker: string): Promise<Record<string, unknown> | null> {
  return fetchEodhdFundamentalsJsonUncached(ticker);
}

export const fetchEodhdFundamentalsJson = unstable_cache(
  fetchEodhdFundamentalsJsonUncached,
  ["eodhd-fundamentals-json-v6-reval-900"],
  { revalidate: REVALIDATE_WARM_LONG },
);

/** Same as {@link fetchEodhdFundamentalsJson} — one shared cache; avoids duplicate fundamentals HTTP. */
export function fetchEodhdFundamentalsJsonScreener(ticker: string): Promise<Record<string, unknown> | null> {
  return fetchEodhdFundamentalsJson(ticker);
}

/**
 * USD market cap from a fundamentals JSON root (Highlights / Valuation), or null.
 * Shared by highlights + earnings calendar filtering.
 */
export function extractMarketCapUsdFromFundamentalsRoot(root: Record<string, unknown>): number | null {
  const hl = root.Highlights && typeof root.Highlights === "object" ? (root.Highlights as Record<string, unknown>) : null;
  let marketCapUsd = hl
    ? num(hl.MarketCapitalization ?? hl.MarketCapitalisation ?? hl.MarketCap)
    : null;
  const val = root.Valuation && typeof root.Valuation === "object" ? (root.Valuation as Record<string, unknown>) : null;
  if (marketCapUsd == null && val) marketCapUsd = num(val.MarketCapitalization);
  return marketCapUsd;
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

    const marketCapUsd: number | null = extractMarketCapUsdFromFundamentalsRoot(root);
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
      peTrailing = num(highlights.PERatio ?? highlights.TrailingPE ?? highlights.PeRatio);
      peForward = num(highlights.ForwardPE ?? highlights.ForwardPe ?? highlights.ForwardPEPS);
    }

    const val = root.Valuation;
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
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

