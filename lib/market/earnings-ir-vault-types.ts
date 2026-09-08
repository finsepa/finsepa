/** Phase-1 IR document vault — first-party Slides + Filings (SEC HTML only when IR PDF is not proxyable). */

export const EARNINGS_IR_VAULT_START_YMD = "2022-01-01";

/** Screener market-cap top N for the IR vault (Phase 1 was 25). */
export const EARNINGS_IR_VAULT_TOP_N = 35;

/** Issuers with first-party IR PDFs — do not lock SEC HTML as a filings/slides fallback. */
export const EARNINGS_IR_VAULT_IR_PDF_ONLY_TICKERS = new Set(["AMAT", "MRK"]);

export type EarningsIrVaultDocStatus = "locked" | "found" | "missing";

export type EarningsIrVaultRow = {
  ticker: string;
  fiscal_period_end: string;
  fiscal_period_label: string | null;
  report_date: string | null;
  slides_url: string | null;
  filings_url: string | null;
  slides_locked: boolean;
  filings_locked: boolean;
  ir_website: string | null;
  resolution_note: string | null;
  verified_at: string | null;
  updated_at: string;
};

export type EarningsIrVaultQuarterReport = {
  ticker: string;
  fiscalPeriodEndYmd: string;
  fiscalPeriodLabel: string | null;
  reportDateYmd: string | null;
  slidesUrl: string | null;
  filingsUrl: string | null;
  slidesStatus: EarningsIrVaultDocStatus;
  filingsStatus: EarningsIrVaultDocStatus;
  /** 0 / 1 / 2 previewable IR docs */
  reportCount: 0 | 1 | 2;
  /** green = 2, yellow = 1, red = 0 */
  trafficLight: "green" | "yellow" | "red";
};

export type EarningsIrVaultTickerReport = {
  ticker: string;
  irWebsite: string | null;
  quarters: EarningsIrVaultQuarterReport[];
  green: number;
  yellow: number;
  red: number;
  trafficLight: "green" | "yellow" | "red";
};

export function isIrVaultPeriodInScope(fiscalPeriodEndYmd: string | null | undefined): boolean {
  if (!fiscalPeriodEndYmd || !/^\d{4}-\d{2}-\d{2}$/.test(fiscalPeriodEndYmd)) return false;
  return fiscalPeriodEndYmd >= EARNINGS_IR_VAULT_START_YMD;
}

export function vaultTrafficLight(reportCount: 0 | 1 | 2): "green" | "yellow" | "red" {
  if (reportCount >= 2) return "green";
  if (reportCount === 1) return "yellow";
  return "red";
}

/** Same URL is one report, not two — never green a quarter with a duplicated PDF. */
export function pairDistinctVaultDocs(
  slides: string | null | undefined,
  filings: string | null | undefined,
): { slides: string | null; filings: string | null } {
  const s = slides?.trim() || null;
  const f = filings?.trim() || null;
  if (s && f && s === f) return { slides: s, filings: null };
  return { slides: s, filings: f };
}

export function countVaultReports(slides: string | null, filings: string | null): 0 | 1 | 2 {
  const pair = pairDistinctVaultDocs(slides, filings);
  const n = (pair.slides ? 1 : 0) + (pair.filings ? 1 : 0);
  return n as 0 | 1 | 2;
}

/**
 * Prefer first-party IR PDFs. Allow SEC Exhibit HTML only when it is a previewable
 * earnings release / presentation (e.g. TSMC — IR PDFs are Cloudflare-walled for
 * `/api/ir-pdf`, so EX-99.1 / EX-99.2 HTML is the proxyable vault target).
 * Mirrors `isDirectEarningsPdfUrl` / known deck checks without importing server modules (unit-testable).
 */
export function isIrVaultAllowedUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  const t = url.trim();
  if (!t.startsWith("https://")) return false;
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (host === "sec.gov" || host.endsWith(".sec.gov")) {
      const p = u.pathname.toLowerCase();
      if (!p.includes("/archives/edgar/")) return false;
      const file = decodeURIComponent(p.split("/").pop()?.split("?")[0] ?? "");
      if (/\.pdf(?:$|[?#])/i.test(p)) {
        return /ex[-_]?99|exhibit|earnings|press|release|presentation|slide|deck|10-q|10-k/i.test(
          file,
        );
      }
      if (!/\.htm(?:l)?(?:$|[?#])/i.test(p)) return false;
      // Tesla Form 10-Q / 10-K iXBRL (no IR 10-Q PDF; distinct from the Update deck).
      if (/\/data\/1318605\//i.test(p) && /^tsla-20\d{6}\.htm$/i.test(file)) return true;
      return /presentation|withguidance|earnings|ex[-_]?99/i.test(file);
    }
    if (/\/static-files\/[a-f0-9-]{36}/i.test(u.pathname)) {
      // Same as preview: Micron static-files are not proxyable — do not lock them in the vault.
      if (host === "investors.micron.com" || host.endsWith(".micron.com")) return false;
      return true;
    }
    if (/\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(t)) return true;
    if (
      (host === "investors.broadcom.com" || host === "broadcom.gcs-web.com") &&
      /\/node\/\d+\/pdf\/?$/i.test(u.pathname)
    ) {
      return true;
    }
    if (
      host === "cdn-dynmedia-1.microsoft.com" &&
      (/\/SlidesFY\d{2}[qQ][1-4]\/?$/i.test(u.pathname) ||
        /\/PressReleaseFY\d{2}_?[qQ][1-4]\/?$/i.test(u.pathname))
    ) {
      return true;
    }
    if (/\.pptx?(?:$|[?#])/i.test(u.pathname) || /\.docx?(?:$|[?#])/i.test(u.pathname)) return true;
    return false;
  } catch {
    return (
      /\.pdf(?:$|[?#])/i.test(t) ||
      (/\/static-files\/[a-f0-9-]{36}/i.test(t) && !/investors\.micron\.com\/static-files\//i.test(t)) ||
      /(?:investors\.broadcom\.com|broadcom\.gcs-web\.com)\/node\/\d+\/pdf/i.test(t) ||
      /cdn-dynmedia-1\.microsoft\.com\/is\/content\/microsoftcorp\/(?:Slides|PressRelease)FY\d{2}_?[qQ][1-4]/i.test(
        t,
      )
    );
  }
}
