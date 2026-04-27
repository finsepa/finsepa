/**
 * Deterministic external URLs for the stock Earnings “Reports” table.
 * Built from fundamentals `General` (IR + CIK) and per-row report dates — no extra HTTP.
 */

import type { StockEarningsDocumentHub } from "@/lib/market/stock-earnings-types";

export type EarningsReportRowLinkTargets = {
  /** Form 8-K window around report date (presentation PDFs often appear as exhibits) */
  slidesSec8k: string | null;
  /** SEC EDGAR company filings index */
  secFilings: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** SEC browse-edgar expects MM/DD/YYYY for `datea` / `dateb`. */
function toSecBrowseDate(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return `${pad2(m)}/${pad2(d)}/${y}`;
}

function addDaysUtcYmd(ymd: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/** Company filings (all forms), newest first. */
export function secEdgarCompanyBrowseUrl(cik10: string): string {
  const u = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  u.searchParams.set("action", "getcompany");
  u.searchParams.set("CIK", cik10);
  u.searchParams.set("owner", "exclude");
  u.searchParams.set("count", "40");
  return u.toString();
}

/** When CIK is missing, SEC “company” search often resolves the listing ticker. */
export function secEdgarCompanyBrowseByTickerUrl(listingTicker: string): string {
  const u = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  u.searchParams.set("action", "getcompany");
  u.searchParams.set("company", listingTicker.trim().toUpperCase());
  u.searchParams.set("owner", "exclude");
  u.searchParams.set("count", "40");
  return u.toString();
}

/** Form 8-K list by ticker symbol (fallback when CIK is unavailable). */
export function secEdgar8kBrowseByTickerUrl(listingTicker: string, reportYmd: string | null): string {
  const u = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  u.searchParams.set("action", "getcompany");
  u.searchParams.set("company", listingTicker.trim().toUpperCase());
  u.searchParams.set("type", "8-k");
  u.searchParams.set("owner", "exclude");
  u.searchParams.set("count", "40");
  if (reportYmd) {
    const start = addDaysUtcYmd(reportYmd, -18);
    const end = addDaysUtcYmd(reportYmd, 28);
    if (start && end) {
      const da = toSecBrowseDate(start);
      const db = toSecBrowseDate(end);
      if (da && db) {
        u.searchParams.set("datea", da);
        u.searchParams.set("dateb", db);
      }
    }
  }
  return u.toString();
}

/** Form 8-K list; optional filing-date window around the earnings report date. */
export function secEdgar8kBrowseUrl(cik10: string, reportYmd: string | null): string {
  const u = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  u.searchParams.set("action", "getcompany");
  u.searchParams.set("CIK", cik10);
  u.searchParams.set("type", "8-k");
  u.searchParams.set("owner", "exclude");
  u.searchParams.set("count", "40");
  if (reportYmd) {
    const start = addDaysUtcYmd(reportYmd, -18);
    const end = addDaysUtcYmd(reportYmd, 28);
    if (start && end) {
      const da = toSecBrowseDate(start);
      const db = toSecBrowseDate(end);
      if (da && db) {
        u.searchParams.set("datea", da);
        u.searchParams.set("dateb", db);
      }
    }
  }
  return u.toString();
}

export function normalizeSecCik(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const digits = String(Math.trunc(v)).replace(/\D/g, "");
    if (!digits) return null;
    const core = digits.length > 10 ? digits.slice(-10) : digits;
    return core.padStart(10, "0");
  }
  if (typeof v !== "string" || !v.trim()) return null;
  const digits = v.trim().replace(/\D/g, "");
  if (!digits) return null;
  const core = digits.length > 10 ? digits.slice(-10) : digits;
  return core.padStart(10, "0");
}

export function parseEarningsDocumentHubFromFundamentalsRoot(root: Record<string, unknown>): StockEarningsDocumentHub {
  const g = root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  if (!g) return { irWebsite: null, cik: null, companyWebsite: null };

  const irRaw = g.IRWebsite ?? g.IrWebsite ?? g.InvestorRelationsURL ?? g.InvestorRelations;
  const ir = typeof irRaw === "string" && irRaw.trim() ? irRaw.trim() : null;

  const webRaw = g.WebURL ?? g.Website ?? g.URL;
  const companyWebsite =
    typeof webRaw === "string" && /^https?:\/\//i.test(webRaw.trim()) ? webRaw.trim() : null;

  const cik = normalizeSecCik(
    g.CIK ?? g.Cik ?? g.cik ?? g.CentralIndexKey ?? g.SEC_CIK ?? g.SecCik ?? g.CIKCode ?? g.cikCode,
  );
  return { irWebsite: ir, cik, companyWebsite };
}

export function buildEarningsReportRowLinkTargets(
  hub: StockEarningsDocumentHub | null | undefined,
  reportDateYmd: string | null | undefined,
  /** Listing ticker (e.g. `NVDA`) — SEC company search fallback when CIK is missing */
  listingTicker: string,
): EarningsReportRowLinkTargets {
  const cik = hub?.cik?.trim() || null;
  const sym = listingTicker.trim().toUpperCase();
  const ymd = reportDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(reportDateYmd) ? reportDateYmd : null;

  const secFilings = cik ? secEdgarCompanyBrowseUrl(cik) : sym ? secEdgarCompanyBrowseByTickerUrl(sym) : null;
  const slidesSec8k = cik ? secEdgar8kBrowseUrl(cik, ymd) : sym ? secEdgar8kBrowseByTickerUrl(sym, ymd) : null;

  return { slidesSec8k, secFilings };
}
