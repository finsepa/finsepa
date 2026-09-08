import {
  curatedIrHostsForTicker,
  derivedIrHostsFromTicker,
} from "@/lib/market/ir-ticker-host-aliases";
import type { StockEarningsDocumentHub } from "@/lib/market/stock-earnings-types";

/** Ensure absolute http(s) URL; add https:// when fundamentals omit the scheme. */
export function normalizeIrHttpUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" || !host.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Registrable-ish domain from a website URL (`www.adobe.com` → `adobe.com`).
 * Keeps simple multi-part TLDs we care about (`.co.uk`, `.com.au`).
 */
export function domainFromWebsiteUrl(url: string | null | undefined): string | null {
  const normalized = normalizeIrHttpUrl(url);
  if (!normalized) return null;
  try {
    let host = new URL(normalized).hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    const parts = host.split(".").filter(Boolean);
    if (parts.length < 2) return null;
    const multi = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.in"]);
    const lastTwo = parts.slice(-2).join(".");
    if (parts.length >= 3 && multi.has(lastTwo)) {
      return parts.slice(-3).join(".");
    }
    return lastTwo;
  } catch {
    return null;
  }
}

/** Investor-relations origins to probe for earnings PDFs / static-files decks. */
export function buildIrSeedUrls(ticker: string, hub: StockEarningsDocumentHub): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const n = normalizeIrHttpUrl(raw);
    if (!n) return;
    try {
      const u = new URL(n);
      const path = u.pathname;
      // Directory-style seeds get a trailing slash; keep file URLs (.html) intact.
      if (path === "/" || path.endsWith("/")) {
        out.push(u.toString());
      } else if (/\.[a-z0-9]{2,5}$/i.test(path)) {
        out.push(u.toString());
      } else {
        u.pathname = `${path.replace(/\/+$/, "")}/`;
        out.push(u.toString());
      }
    } catch {
      out.push(n);
    }
  };

  // 1) Fundamentals first — real company / IR domains (no EODHD cost; already on payload).
  push(hub.irWebsite);
  push(hub.companyWebsite);

  const root =
    domainFromWebsiteUrl(hub.irWebsite) ?? domainFromWebsiteUrl(hub.companyWebsite);

  if (root) {
    push(`https://investor.${root}/`);
    push(`https://ir.${root}/`);
    push(`https://investors.${root}/`);
    push(`https://www.${root}/`);
    push(`https://${root}/investor-relations/`);
    push(`https://${root}/investors/`);
    push(`https://${root}/investor/`);
    if (root === "microsoft.com") {
      push("https://www.microsoft.com/en-us/investor/earnings/");
    }
    if (root === "adobe.com") {
      push("https://www.adobe.com/investor-relations.html");
    }
  }

  // 2) Curated aliases (listing ticker ≠ IR domain).
  for (const host of curatedIrHostsForTicker(ticker)) push(host);

  // 3) Last resort only — invent www.{ticker}.com when fundamentals gave us nothing.
  if (!root && !normalizeIrHttpUrl(hub.irWebsite) && !normalizeIrHttpUrl(hub.companyWebsite)) {
    for (const host of derivedIrHostsFromTicker(ticker)) push(host);
  }

  return [...new Set(out)];
}

export function buildCommonQuarterlyEarningsPages(seed: string, preview: boolean): string[] {
  let u: URL | null = null;
  try {
    u = new URL(seed);
  } catch {
    return [];
  }
  const origin = u.origin;
  if (preview) return [seed];
  return [
    seed,
    `${origin}/financial-information/quarterly-earnings/`,
    `${origin}/financials/`,
    `${origin}/quarterly-results/`,
    `${origin}/financial-information/quarterly-results/`,
    `${origin}/events-and-presentations/`,
    `${origin}/investor-relations/`,
    `${origin}/investors/`,
  ];
}
