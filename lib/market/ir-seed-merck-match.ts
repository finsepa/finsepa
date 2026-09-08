/** Merck IR presentation + earnings-announcement / news-release PDFs on merck.com. */

export type MrkQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const WP = "https://www.merck.com/wp-content/uploads/sites/124";

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

function token(fq: number, fy: number): string {
  return `${fq}Q${yy2(fy)}`;
}

function labelFromFqFy(fq: number, fy: number): string {
  return `Q${fq} ${fy}`;
}

/** Typical wp-content upload months around Merck earnings. */
export function merckWpUploadMonths(fq: number, fy: number): { year: number; month: number }[] {
  if (fq === 1) return [{ year: fy, month: 4 }, { year: fy, month: 5 }, { year: fy, month: 6 }];
  if (fq === 2) return [{ year: fy, month: 7 }, { year: fy, month: 8 }];
  if (fq === 3) return [{ year: fy, month: 10 }, { year: fy, month: 11 }];
  return [{ year: fy + 1, month: 1 }, { year: fy + 1, month: 2 }];
}

export function merckSlidesCandidates(fq: number, fy: number): string[] {
  const name = `${token(fq, fy)}-Merck-Earnings-Presentation.pdf`;
  return merckWpUploadMonths(fq, fy).map(
    ({ year, month }) => `${WP}/${year}/${String(month).padStart(2, "0")}/${name}`,
  );
}

export function merckFilingsCandidates(fq: number, fy: number): string[] {
  const name = `${token(fq, fy)}-Merck-Earnings-Announcement.pdf`;
  return merckWpUploadMonths(fq, fy).map(
    ({ year, month }) => `${WP}/${year}/${String(month).padStart(2, "0")}/${name}`,
  );
}

export function merckEventPageUrls(fq: number, fy: number): string[] {
  return [
    `https://www.merck.com/events/q${fq}-${fy}-earnings-call/`,
    `https://www.merck.com/events/merck-co-inc-q${fq}-${fy}-earnings-call/`,
  ];
}

/**
 * GCS / IR HTML is JS-heavy for older years; overlay verified wp-content PDFs
 * (news-release filenames that don't match `{n}Q{yy}-Merck-Earnings-Announcement`).
 */
const Q4CDN = "https://s21.q4cdn.com/488056881/files/doc_financials";

export const MRK_KNOWN_QUARTER_DOCS: Readonly<Record<string, MrkQuarterDocs>> = {
  "Q2 2026": {
    slides: `${WP}/2026/08/2Q26-Merck-Earnings-Presentation.pdf`,
    filings: `${WP}/2026/08/Merck-News-Release-08-04-26-Merck-Co.-Inc.-Rahway-N.J.-USA-Announces-Second-Quarter-2026-Financial-Results.pdf`,
  },
  "Q1 2026": {
    slides: `${WP}/2026/04/1Q26-Merck-Earnings-Presentation.pdf`,
    filings: `${WP}/2026/04/1Q26-Merck-Earnings-Announcement.pdf`,
  },
  "Q4 2025": {
    slides: `${WP}/2026/02/4Q25-Merck-Earnings-Presentation.pdf`,
    filings: `${WP}/2026/02/4Q25-Merck-Earnings-Announcement.pdf`,
  },
  "Q3 2025": {
    slides: `${WP}/2025/10/3Q25-Merck-Earnings-Presentation.pdf`,
    filings: `${WP}/2025/10/Merck-News-Release-10-30-25-Merck-Co.-Inc.-Rahway-N.J.-USA-Announces-Third-Quarter-2025-Financial-Results.pdf`,
  },
  "Q2 2025": {
    slides: `${WP}/2025/07/2Q25-Merck-Earnings-Presentation.pdf`,
    filings: `${WP}/2025/07/2Q25-Merck-Earnings-Announcement.pdf`,
  },
  "Q1 2025": {
    slides: `${Q4CDN}/2025/q1/First-Quarter-2025-Sales-and-Earnings-FINAL.pdf`,
    filings: `${Q4CDN}/2025/q1/Merck-News-Release-04-24-25-Merck-Announces-First-Quarter-2025-Financial-Results.pdf`,
  },
  "Q4 2024": {
    slides: `${Q4CDN}/2024/q4/Q4-2024-Merck-Earnings-Deck-Updated-2-25.pdf`,
    filings: `${Q4CDN}/2024/q4/Merck-News-Release-02-04-25-Merck-Announces-Fourth-Quarter-and-Full-Year-2024-Financial-Results.pdf`,
  },
  "Q3 2024": {
    slides: `${Q4CDN}/2024/q3/Q3-2024-Merck-Earnings-Deck.pdf`,
    filings: `${Q4CDN}/2024/q3/Merck-News-Release-10-31-24-Merck-Announces-Third-Quarter-2024-Financial-Results.pdf`,
  },
  "Q2 2024": {
    slides: `${Q4CDN}/2024/q2/Q2-2024-Merck-Earnings-Deck-Update-10-30-2024.pdf`,
    filings: `${Q4CDN}/2024/q2/Merck-News-Release-07-30-24-Merck-Announces-Second-Quarter-2024-Financial-Results.pdf`,
  },
  "Q1 2024": {
    slides: `${Q4CDN}/2024/q1/Q1-2024-Merck-Earnings-Deck-FINAL-UPDATED_.pdf`,
    filings: `${Q4CDN}/2024/q1/Merck-News-Release-04-25-24-Merck-Announces-First-Quarter-2024-Financial-Results.pdf`,
  },
  "Q4 2023": {
    slides: `${Q4CDN}/2023/q4/Q4-2023-Merck-Earnings-Deck-FINAL-2-26-2024.pdf`,
    filings: `${Q4CDN}/2023/q4/Merck-News-Release-02-01-24-Merck-Announces-Fourth-Quarter-and-Full-Year-2023-Financial-Results.pdf`,
  },
  "Q3 2023": {
    slides: `${Q4CDN}/2023/q3/Q3-2023-Merck-Earnings-Deck-Final-Website.pdf`,
    filings: `${Q4CDN}/2023/q3/Merck-News-Release-10-26-23-Merck-Announces-Third-Quarter-2023-Financial-Results.pdf`,
  },
  "Q2 2023": {
    slides: `${Q4CDN}/2023/q2/Q2-2023-Merck-Earnings-Deck-FINAL-1.pdf`,
    filings: `${Q4CDN}/2023/q2/Merck-News-Release-08-01-23-Merck-Announces-Second-Quarter-2023-Financial-Results.pdf`,
  },
  "Q1 2023": {
    slides: `${Q4CDN}/2023/Q1-2023-Merck-Earnings-Deck-FINAL.pdf`,
    filings: `${Q4CDN}/2023/q1/Merck-News-Release-04-27-23-Merck-Announces-First-Quarter-2023-Financial-Results.pdf`,
  },
  "Q4 2022": {
    slides: `${Q4CDN}/2022/q4/Q4-2022-Merck-Earnings-Deck_2.17.pdf`,
    filings: `${Q4CDN}/2022/q4/Merck-News-Release-02-02-23-Merck-Announces-4Q-and-FY-2022-Financial-Results.pdf`,
  },
  "Q3 2022": {
    slides: `${Q4CDN}/2022/q3/Q3-2022-Merck-Earnings-Deck-(Final-Update-11.3).pdf`,
    filings: `${Q4CDN}/2022/q3/Merck-News-Release-Merck-Announces-Third-Quarter-2022-Financial-Results.pdf`,
  },
  "Q2 2022": {
    slides: `${Q4CDN}/2022/q2/v2/Q2-2022-Merck-Earnings-Deck-(update-8.9.2022).pdf`,
    filings: `${Q4CDN}/2022/q2/merck-news-release-merck-announces-second-quarter-2022-financial-results.pdf`,
  },
  "Q1 2022": {
    slides: `${Q4CDN}/2022/q1/Q1-2022-Merck-Earnings-Deck-Final.pdf`,
    filings: `${Q4CDN}/2022/q1/Merck-News-Release-Merck-Announces-First-Quarter-2022-Financial-Results-04-28-2022.pdf`,
  },
};

export function mergeMerckKnownQuarterDocs(fromHtml: Map<string, MrkQuarterDocs>): Map<string, MrkQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(MRK_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

function labelFromMerckPdfHref(href: string): string | null {
  const decoded = decodeURIComponent(href);
  const compact = decoded.match(/\b([1-4])Q(\d{2})-Merck-Earnings/i);
  if (compact) return `Q${compact[1]} 20${compact[2]}`;
  const qName = decoded.match(/\bQ([1-4])-(\d{4})-Merck-Earnings/i);
  if (qName) return `Q${qName[1]} ${qName[2]}`;
  const qDir = decoded.match(/\/(\d{4})\/q([1-4])\//i);
  if (qDir) return `Q${qDir[2]} ${qDir[1]}`;
  const firstQuarter = decoded.match(
    /\b(First|Second|Third|Fourth)(?:-|\s)Quarter-(\d{4})/i,
  );
  if (firstQuarter) {
    const fq = { first: 1, second: 2, third: 3, fourth: 4 }[firstQuarter[1]!.toLowerCase()];
    if (!fq) return null;
    return labelFromFqFy(fq, Number(firstQuarter[2]));
  }
  const ordinal = decoded.match(
    /\b(First|Second|Third|Fourth)-Quarter-(\d{4})-Financial-Results/i,
  );
  if (ordinal) {
    const fq = { first: 1, second: 2, third: 3, fourth: 4 }[ordinal[1]!.toLowerCase()];
    if (!fq) return null;
    return labelFromFqFy(fq, Number(ordinal[2]));
  }
  return null;
}

function isMerckSlidesPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  if (/prepared-remarks|transcript|other-financial|infographic|supplement-to/i.test(n)) return false;
  return /merck-earnings-presentation|merck-earnings-deck|sales-and-earnings-final/i.test(n);
}

function isMerckFilingsPdf(href: string): boolean {
  const n = decodeURIComponent(href).toLowerCase();
  if (/other-financial|prepared-remarks|transcript|infographic|highlights-package|10-q|10-k|form-10|supplement-to/i.test(n)) {
    return false;
  }
  return /merck-earnings-announcement|merck-news-release/i.test(n);
}

function isMerckEarningsHost(abs: string): boolean {
  return /merck\.com\/wp-content\//i.test(abs) || /s21\.q4cdn\.com\/488056881\//i.test(abs);
}

/** Parse merck.com IR / event HTML for presentation + announcement / news-release PDFs. */
export function parseMerckEarningsHtml(html: string): Map<string, MrkQuarterDocs> {
  const out = new Map<string, MrkQuarterDocs>();
  const hrefRe = /href\s*=\s*["']([^"']+\.pdf)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const raw = (m[1] ?? "").replace(/&amp;/g, "&").trim();
    if (!raw) continue;
    let abs: string;
    try {
      abs = new URL(raw, "https://www.merck.com/").href.split("#")[0]!;
    } catch {
      continue;
    }
    if (!isMerckEarningsHost(abs)) continue;
    const label = labelFromMerckPdfHref(abs);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isMerckSlidesPdf(abs)) cur.slides = abs;
    else if (!cur.filings && isMerckFilingsPdf(abs)) cur.filings = abs;
    out.set(label, cur);
  }
  return out;
}
