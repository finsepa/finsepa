/**
 * Zijin Mining ADR (ZIJMY) IR — calendar FY.
 * Slides = null (no English slide decks); Filings = English results PDFs.
 * Host: www.zijinmining.com/upload/file. Never SEC HTML / Chinese-only fills.
 */

export type ZijmyQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const ZIJMY_IR_PAGES = [
  "https://www.zijinmining.com/investors/",
] as const;

/** Catalog Q1 2022 → Q2 2026. Filings-only yellow; several older empties. */
export const ZIJMY_KNOWN_QUARTER_DOCS: Readonly<Record<string, ZijmyQuarterDocs>> = {
  "Q1 2022": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2022/06/20/5d88492a4ee14fd3a18145ead9559e6f.pdf",
  },
  "Q2 2022": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2022/09/23/0d103a7e0bbf4f06b1aa9b265dafd813.pdf",
  },
  "Q3 2022": {
    slides: null,
    filings: null,
  },
  "Q4 2022": {
    slides: null,
    filings: null,
  },
  "Q1 2023": {
    slides: null,
    filings: null,
  },
  "Q2 2023": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2023/09/28/e19d6937fe23412eb1bc9e42f74984cb.pdf",
  },
  "Q3 2023": {
    slides: null,
    filings: null,
  },
  "Q4 2023": {
    slides: null,
    filings: null,
  },
  "Q1 2024": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2024/04/22/34d03fba3cf94e71814555580fa3bafe.pdf",
  },
  "Q2 2024": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2024/09/27/1c4b267439784d61b65a27c4d64e37dd.pdf",
  },
  "Q3 2024": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2024/10/18/92b3c4a686e2451b97ac4554b6198299.pdf",
  },
  "Q4 2024": {
    slides: null,
    filings: null,
  },
  "Q1 2025": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2025/04/25/3091791b98ac4361a5de4a3a393cec49.pdf",
  },
  "Q2 2025": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2025/09/25/edb395dd70aa43bb9faf6e220853046a.pdf",
  },
  "Q3 2025": {
    slides: null,
    filings: null,
  },
  "Q4 2025": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2026/03/22/1e8efd3e90ea41cea078a8051f901277.pdf",
  },
  "Q1 2026": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2026/04/27/a96f9899e33b42b099a2c5de59e9206e.pdf",
  },
  "Q2 2026": {
    slides: null,
    filings: "https://www.zijinmining.com/upload/file/2026/08/23/aeae62dc05e348bca1df77cc85b268c5.pdf",
  },
};

export function isZijmyRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(
    n,
  );
}

export function isZijmyIrPdf(href: string | null | undefined): boolean {
  if (!href || isZijmyRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.zijinmining.com" || host === "zijinmining.com" || host.endsWith(".zijinmining.com") || host === "www.zjky.cn" || host.endsWith(".zjky.cn"))) {
      return false;
    }
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeZijmyKnownQuarterDocs(): Map<string, ZijmyQuarterDocs> {
  return new Map(Object.entries(ZIJMY_KNOWN_QUARTER_DOCS));
}
