/**
 * Altria (MO) IR — calendar FY.
 * Slides = Presentation / Earnings Presentation; Filings = Press/Earnings Release.
 * Host: edge.sitecorecloud.io (primary); s204.q4cdn.com for Q1 2022 filings.
 * Never metrics / reconciliations / CAGNY / transcript / SEC HTML.
 */

export type MoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const MO_IR_PAGES = [
  "https://investor.altria.com/financials-filings/quarterly-results/default.aspx",
  "https://investor.altria.com/",
] as const;

const SC =
  "https://edge.sitecorecloud.io/altriaclien9c5f-altriaclien2f33-prod0b41-3d12/media/Project/Altria/Altria/Investors/events-and-presentations";
const Q = "?sc_lang=en";

/** Catalog Q1 2022 → Q2 2026 (all pairs). */
export const MO_KNOWN_QUARTER_DOCS: Readonly<Record<string, MoQuarterDocs>> = {
  "Q1 2022": {
    slides: `${SC}/2022/2022-Q1/Presentation.pdf${Q}`,
    filings: "https://s204.q4cdn.com/505541855/files/doc_financials/2022/q1/Press-Release-(1).pdf",
  },
  "Q2 2022": {
    slides: `${SC}/2022/2022-Q2/Presentation.pdf${Q}`,
    filings: `${SC}/2022/2022-Q2/Press-Release.pdf${Q}`,
  },
  "Q3 2022": {
    slides: `${SC}/2022/2022-Q3/Presentation.pdf${Q}`,
    filings: `${SC}/2022/2022-Q3/Press-Release.pdf${Q}`,
  },
  "Q4 2022": {
    slides: `${SC}/2023/2022-Q4/Presentation.pdf${Q}`,
    filings: `${SC}/2023/2022-Q4/Press-Release.pdf${Q}`,
  },
  "Q1 2023": {
    slides: `${SC}/2023/2023-Q1/Presentation.pdf${Q}`,
    filings: `${SC}/2023/2023-Q1/Press-Release.pdf${Q}`,
  },
  "Q2 2023": {
    slides: `${SC}/2023/2023-Q2/Presentation.pdf${Q}`,
    filings: `${SC}/2023/2023-Q2/Press-Release.pdf${Q}`,
  },
  "Q3 2023": {
    slides: `${SC}/2023/2023-Q3/Presentation.pdf${Q}`,
    filings: `${SC}/2023/2023-Q3/Press-Release.pdf${Q}`,
  },
  "Q4 2023": {
    slides: `${SC}/2024/2023-Q4/Presentation.pdf${Q}`,
    filings: `${SC}/2024/2023-Q4/Press-Release.pdf${Q}`,
  },
  "Q1 2024": {
    slides: `${SC}/2024/2024-Q1/Presentation.pdf${Q}`,
    filings: `${SC}/2024/2024-Q1/Press-Release.pdf${Q}`,
  },
  "Q2 2024": {
    slides: `${SC}/2024/2024-Q2/Presentation.pdf${Q}`,
    filings: `${SC}/2024/2024-Q2/Press-Release.pdf${Q}`,
  },
  "Q3 2024": {
    slides: `${SC}/2024/2024-Q3/Presentation.pdf${Q}`,
    filings: `${SC}/2024/2024-Q3/Press-Release.pdf${Q}`,
  },
  "Q4 2024": {
    slides: `${SC}/2025/2024-Q4/Presentation.pdf${Q}`,
    filings: `${SC}/2025/2024-Q4/Press-Release.pdf${Q}`,
  },
  "Q1 2025": {
    slides: `${SC}/2025/2025-Q1/Presentation.pdf${Q}`,
    filings: `${SC}/2025/2025-Q1/Press-Release.pdf${Q}`,
  },
  "Q2 2025": {
    slides: `${SC}/2025/2025-Q2/Q2-2025-Earnings-Presentation.pdf${Q}`,
    filings: `${SC}/2025/2025-Q2/Press-Release.pdf${Q}`,
  },
  "Q3 2025": {
    slides: `${SC}/2025/2025-Q3/Q3-2025-Presentation.pdf${Q}`,
    filings: `${SC}/2025/2025-Q3/Q3-2025-Press-Release.pdf${Q}`,
  },
  "Q4 2025": {
    slides: `${SC}/2026/2025-Q4/Q4-2025-Earnings---Presentation.pdf${Q}`,
    filings: `${SC}/2026/2025-Q4/Q4-2025-Earnings---Release.pdf${Q}`,
  },
  "Q1 2026": {
    slides: `${SC}/2026/2026-Q1/Q1-2026-Earnings--Presentation.pdf${Q}`,
    filings: `${SC}/2026/2026-Q1/Q1-2026-Earnings---Release.pdf${Q}`,
  },
  "Q2 2026": {
    slides: `${SC}/2026/2026-Q2/Altria-Q2-2026-Earnings---Presentation.pdf${Q}`,
    filings: `${SC}/2026/2026-Q2/Altria-Q2-2026-Earnings---Release.pdf${Q}`,
  },
};

export function isMoRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|metric|reconcil|supplement|cagny|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isMoIrPdf(href: string | null | undefined): boolean {
  if (!href || isMoRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (host === "edge.sitecorecloud.io" || host.endsWith(".sitecorecloud.io")) {
      return /\.pdf(?:$|[?#])/i.test(u.pathname) || /\.pdf(?:$|[?#])/i.test(href);
    }
    if (host === "www.altria.com" || host === "altria.com" || host.endsWith(".altria.com")) {
      return /\.pdf(?:$|[?#])/i.test(u.pathname);
    }
    if (host === "s204.q4cdn.com" || host.endsWith(".q4cdn.com")) {
      if (!u.pathname.includes("/505541855/")) return false;
      return /\.pdf(?:$|[?#])/i.test(u.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

export function mergeMoKnownQuarterDocs(): Map<string, MoQuarterDocs> {
  return new Map(Object.entries(MO_KNOWN_QUARTER_DOCS));
}
