/**
 * Eaton (ETN) IR — calendar FY.
 * Slides = analyst / earnings presentation; Filings = earnings-complete release PDF.
 * Host: eaton.com/content/dam/.../quarterly-earnings/filings/
 * Never transcript / webcast / investor-conference / SEC HTML.
 */

export type EtnQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const ETN_BASE =
  "https://www.eaton.com/content/dam/eaton/company/investor-relations/quarterly-earnings/filings";

export const ETN_IR_PAGES = [
  "https://www.eaton.com/us/en-us/company/investor-relations/financial-presentations-webcasts.html",
] as const;

/** Browser-verified from financial-presentations-webcasts (Q1 2022 → Q2 2026). */
export const ETN_KNOWN_QUARTER_DOCS: Readonly<Record<string, EtnQuarterDocs>> = {
  "Q2 2026": {
    slides: `${ETN_BASE}/2026/q2/q2-2026-analyst-presentation.pdf`,
    // Issuer href on IR page uses this filename (typo in path); leave as published.
    filings: `${ETN_BASE}/2026/q2/q2-20265-earnings-complete.pdf`,
  },
  "Q1 2026": {
    slides: `${ETN_BASE}/2026/q1/q1-2026-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2026/q1/q1-2026-earnings-complete.pdf`,
  },
  "Q4 2025": {
    slides: `${ETN_BASE}/2025/q4/4Q-2025-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2025/q4/4Q-2025-earnings-complete.pdf`,
  },
  "Q3 2025": {
    slides: `${ETN_BASE}/2025/q3/3Q-2025-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2025/q3/3Q-2025-earnings-complete.pdf`,
  },
  "Q2 2025": {
    slides: `${ETN_BASE}/2025/q2/2Q-2025-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2025/q2/2Q-2025-earnings-complete.pdf`,
  },
  "Q1 2025": {
    slides: `${ETN_BASE}/2025/q1/1Q-2025-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2025/q1/1Q-2025-earnings-complete.pdf`,
  },
  "Q4 2024": {
    slides: `${ETN_BASE}/2024/q4/4Q-2024-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2024/q4/4Q-2024-earnings-complete.pdf`,
  },
  "Q3 2024": {
    slides: `${ETN_BASE}/2024/q3/3Q-2024-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2024/q3/3Q-2024-earnings-complete.pdf`,
  },
  "Q2 2024": {
    slides: `${ETN_BASE}/2024/q2/2Q-2024-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2024/q2/2Q-2024-earnings-complete.pdf`,
  },
  "Q1 2024": {
    slides: `${ETN_BASE}/2024/q1/1Q-2024-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2024/q1/1Q-2024-earnings-complete.pdf`,
  },
  "Q4 2023": {
    slides: `${ETN_BASE}/2023/q4/4Q-2023-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2023/q4/4Q-2023-earnings-complete.pdf`,
  },
  "Q3 2023": {
    slides: `${ETN_BASE}/2023/q3/3Q-2023-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2023/q3/3Q-2023-earnings-complete.pdf`,
  },
  "Q2 2023": {
    slides: `${ETN_BASE}/2023/q2/2Q-2023-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2023/q2/2Q-2023-earnings-complete.pdf`,
  },
  "Q1 2023": {
    slides: `${ETN_BASE}/2023/q1/1Q-2023-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2023/q1/1Q-2023-earnings-complete.pdf`,
  },
  "Q4 2022": {
    slides: `${ETN_BASE}/2022/q4/4Q-2022-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2022/q4/4Q%202022%20Earnings%20Release%20FINAL.pdf`,
  },
  "Q3 2022": {
    slides: `${ETN_BASE}/2022/q3/3Q-2022-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2022/q3/3Q-2022-earnings-complete.pdf`,
  },
  "Q2 2022": {
    slides: `${ETN_BASE}/2022/q2/2Q-2022-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2022/q2/2Q-2022-earnings-complete.pdf`,
  },
  "Q1 2022": {
    slides: `${ETN_BASE}/2022/q1/1Q-2022-analyst-presentation.pdf`,
    filings: `${ETN_BASE}/2022/q1/1Q-2022-earnings-complete.pdf`,
  },
};

export function isEtnRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|webcast|investor[-_\s]*conference|laguna|barclays|10-?q|10-?k|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isEtnIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.eaton.com" || host === "eaton.com" || host.endsWith(".eaton.com"))) {
      return false;
    }
    if (!u.pathname.includes("/investor-relations/quarterly-earnings/")) return false;
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isEtnRejected(url);
  } catch {
    return false;
  }
}

export function mergeEtnKnownQuarterDocs(): Map<string, EtnQuarterDocs> {
  return new Map(Object.entries(ETN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
