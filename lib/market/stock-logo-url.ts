import "server-only";

import {
  companyLogoUrlForTicker,
  companyLogoUrlFromDomain,
  logoDevStockLogoUrl,
} from "@/lib/screener/company-logo-url";
import { isTop10Ticker, TOP10_META } from "@/lib/screener/top10-config";

function domainFromWebsiteRaw(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./, "").trim().toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Logo URL when fundamentals JSON is already loaded for other fields (earnings, etc.).
 * Does **not** fetch EODHD — uses Logo.dev first, then website from `root` only for favicon fallback if no key.
 */
export function logoUrlFromFundamentalsRoot(root: Record<string, unknown> | null, tickerForLogo?: string): string {
  const sym = tickerForLogo?.trim();
  if (sym) {
    const dev = logoDevStockLogoUrl(sym);
    if (dev) return dev;
    const u = sym.toUpperCase();
    if (isTop10Ticker(u)) return companyLogoUrlForTicker(u, TOP10_META[u].domain);
  }
  if (!root || typeof root !== "object") return "";
  const general =
    root.General && typeof root.General === "object" ? (root.General as Record<string, unknown>) : null;
  const host =
    domainFromWebsiteRaw(general?.WebURL ?? general?.Website ?? general?.URL) ??
    domainFromWebsiteRaw(root.WebURL ?? root.Website ?? root.URL);
  if (!host) return "";
  return sym ? companyLogoUrlForTicker(sym, host) : companyLogoUrlFromDomain(host);
}
