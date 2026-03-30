import "server-only";

import {
  fetchEodhdFundamentalsJson,
  formatEarningsDateEnUS,
  parseUnknownDateToUtcMs,
} from "@/lib/market/eodhd-fundamentals";
import type { StockProfilePayload } from "@/lib/market/stock-profile-types";

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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFoundedYear(g: Record<string, unknown>): string | null {
  const fd = g.FoundedDate ?? g.YearFounded ?? g.Founded;
  if (typeof fd === "number" && Number.isFinite(fd)) return String(Math.trunc(fd));
  const raw = str(typeof fd === "number" ? String(fd) : fd);
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) return raw;
  const ms = parseUnknownDateToUtcMs(raw);
  if (ms != null) return String(new Date(ms).getUTCFullYear());
  const m = raw.match(/\b(19|20)\d{2}\b/);
  return m ? m[0]! : null;
}

function formatEmployees(v: unknown): string | null {
  const n = num(v);
  if (n == null) return null;
  return Math.round(n).toLocaleString("en-US");
}

function buildAddress(g: Record<string, unknown>): string | null {
  const direct = str(g.Address);
  if (direct) return direct;
  const ad = g.AddressData;
  if (ad && typeof ad === "object") {
    const a = ad as Record<string, unknown>;
    const parts = [str(a.Street), str(a.City), str(a.Zip)].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return null;
}

function parseHqState(g: Record<string, unknown>): string | null {
  return str(g.State ?? g.Province) ?? null;
}

function resolveNextLastEarnings(root: Record<string, unknown>): { next: string | null; last: string | null } {
  let next: string | null = null;
  let last: string | null = null;

  const earn = root.Earnings;
  if (earn && typeof earn === "object") {
    const e = earn as Record<string, unknown>;
    next =
      formatEarningsDateEnUS(e.NextEarningsDate ?? e.NextReportDate ?? e.EarningsDate ?? e.NextEarningDate) ?? null;

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

      if (bestUpcomingMs != null) next = formatEarningsDateEnUS(bestUpcomingMs);
      if (bestPastMs != null) last = formatEarningsDateEnUS(bestPastMs);
    }

    if (last == null) last = formatEarningsDateEnUS(e.MostRecentQuarter);
  }

  const hl = root.Highlights;
  if (hl && typeof hl === "object") {
    const h = hl as Record<string, unknown>;
    if (last == null) last = formatEarningsDateEnUS(h.MostRecentQuarter);
  }

  return { next, last };
}

export async function fetchEodhdStockProfile(ticker: string): Promise<StockProfilePayload | null> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root) return null;

  const g = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;

  const hl = root.Highlights;
  const highlights = hl && typeof hl === "object" ? (hl as Record<string, unknown>) : null;

  const { next, last } = resolveNextLastEarnings(root);

  if (!g) {
    return {
      description: null,
      website: null,
      irWebsite: null,
      foundedYear: null,
      headquarters: null,
      hqState: null,
      sector: null,
      industry: null,
      employees: null,
      phone: null,
      equityStyle: str(highlights?.Style ?? highlights?.EquityStyle ?? highlights?.Category),
      nextEarningsDate: next,
      lastEarningsDate: last,
    };
  }

  let description = str(g.Description);
  if (description) description = stripHtml(description);

  return {
    description: description ?? null,
    website: str(g.WebURL ?? g.Website ?? g.URL),
    irWebsite: str(g.IRWebsite ?? g.IrWebsite ?? g.InvestorRelationsURL ?? g.InvestorRelations),
    foundedYear: parseFoundedYear(g),
    headquarters: buildAddress(g),
    hqState: parseHqState(g),
    sector: str(g.Sector),
    industry: str(g.Industry),
    employees: formatEmployees(g.FullTimeEmployees ?? g.Employees),
    phone: str(g.Phone ?? g.Telephone ?? g.ContactPhone),
    equityStyle: str(
      highlights?.Style ?? highlights?.EquityStyle ?? highlights?.Category ?? g.Category ?? g.Type,
    ),
    nextEarningsDate: next,
    lastEarningsDate: last,
  };
}
