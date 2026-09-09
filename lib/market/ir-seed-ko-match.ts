/** Coca-Cola IR: earnings-release PDFs as filings, IR Overview Presentation as slides. */

export type KoQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const KO_ASSETS =
  "https://investors.coca-colacompany.com/_assets/_2863ac7ce66ff5d8c22d382a1d89eeae/cocacolacompany";

function release(nid: string, file: string): string {
  return `${KO_ASSETS}/db/880/${nid}/earnings_release/${file}`;
}

function overview(nid: string, file: string, hash = "_2863ac7ce66ff5d8c22d382a1d89eeae"): string {
  return `https://investors.coca-colacompany.com/_assets/${hash}/cocacolacompany/db/861/${nid}/pdf/${file}`;
}

/**
 * Verified first-party IR PDFs from investors.coca-colacompany.com/financial-information.
 * Q1 2022 has no earnings_release PDF on IR (leave filings empty). Older IR Overview decks
 * are not listed historically — only Q1/Q2 2026 overview PDFs are on the site.
 */
export const KO_KNOWN_QUARTER_DOCS: Readonly<Record<string, KoQuarterDocs>> = {
  "Q2 2026": {
    slides: overview("11134", "2Q26+IR+Overview+Presentation.pdf"),
    filings: release("11126", "Coca-Cola+2026+Q2+Earnings+Release_Full+Release_7.28.26.pdf"),
  },
  "Q1 2026": {
    slides: overview("11123", "1Q26+IR+Overview+Presentation.pdf", "_9ab4d43d194750b7680fa1b65cbad85c"),
    filings: release("11107", "Coca-Cola+2026+Q1+Earnings+Release_Full+Release_4.28.26.pdf"),
  },
  "Q4 2025": {
    slides: null,
    filings: release("11088", "Coca-Cola+Q4+2025+Earnings+Release_Full+Release_2.10.26.pdf"),
  },
  "Q3 2025": {
    slides: null,
    filings: release("11074", "Coca-Cola+2025+Q3+Earnings+Release+FINAL.pdf"),
  },
  "Q2 2025": {
    slides: null,
    filings: release("11064", "Coca-Cola+2025+Q2+Earnings+Release_Full+Release_7.22.25.pdf"),
  },
  "Q1 2025": {
    slides: null,
    filings: release("10625", "Coca-Cola+2025+Q1+Earnings+Release_Full+Release_4.29.25.pdf"),
  },
  "Q4 2024": {
    slides: null,
    filings: release("10242", "2024_Q4_Earnings_Release_(Ex-99.1)_-_Final.pdf"),
  },
  "Q3 2024": {
    slides: null,
    filings: release("10241", "2024_Q3_Earnings_Release_(Ex-99.1)_-_FINAL.pdf"),
  },
  "Q2 2024": {
    slides: null,
    filings: release("10240", "2024_Q2_Earnings_Release_(Ex-99.1)_-_FINAL.pdf"),
  },
  "Q1 2024": {
    slides: null,
    filings: release("10239", "2024_Q1_Earnings_Release_(Ex-99.1)_-_FINAL.pdf"),
  },
  "Q4 2023": {
    slides: null,
    filings: release("10238", "2023_Q4_Earnings_Release_(Ex-99.1)_-_FINAL.pdf"),
  },
  "Q3 2023": {
    slides: null,
    filings: release("10237", "Coca-Cola_third_quarter_2023_full_earnings_release_10.24.23_FINAL.pdf"),
  },
  "Q2 2023": {
    slides: null,
    filings: release("10236", "Coca-Cola_2023_Q2_Earnings_Release_Full_Release_7.26.23_FINAL.pdf"),
  },
  "Q1 2023": {
    slides: null,
    filings: release("10235", "2023_Q1_Earnings_Release_(Ex-99.1)_Full_Release.pdf"),
  },
  "Q4 2022": {
    slides: null,
    filings: release(
      "10234",
      "Coca-Cola_fourth_quarter_and_full_year_2022_full_earnings_release-2.14.23_FINAL.pdf",
    ),
  },
  "Q3 2022": {
    slides: null,
    filings: release("10233", "Coca-Cola_Q32022_Full_Earnings_Release_10.25.22_FINAL.pdf"),
  },
  "Q2 2022": {
    slides: null,
    filings: release("10232", "Coca-Cola_2022_Q2_Earnings_Release_7.26.22_FINAL.pdf"),
  },
};

export const KO_IR_PAGES = [
  "https://investors.coca-colacompany.com/",
  "https://investors.coca-colacompany.com/financial-information",
] as const;

export function mergeKoKnownQuarterDocs(fromHtml: Map<string, KoQuarterDocs>): Map<string, KoQuarterDocs> {
  const out = new Map(fromHtml);
  for (const [label, known] of Object.entries(KO_KNOWN_QUARTER_DOCS)) {
    const cur = out.get(label) ?? { slides: null, filings: null };
    out.set(label, {
      slides: cur.slides ?? known.slides,
      filings: cur.filings ?? known.filings,
    });
  }
  return out;
}

function decodeKoHref(href: string): string {
  return decodeURIComponent(href.replace(/\+/g, " "));
}

export function labelFromKoPdfHref(href: string): string | null {
  const n = decodeKoHref(href);
  const compact = n.match(/\b([1-4])Q(\d{2})\b/i);
  if (compact) return `Q${compact[1]} 20${compact[2]}`;
  const qYear = n.match(/\bQ([1-4])[\s_+-]*20(\d{2})\b/i) ?? n.match(/\b20(\d{2})[\s_+-]*Q([1-4])\b/i);
  if (qYear) {
    if (qYear[1]!.length === 1) return `Q${qYear[1]} 20${qYear[2]}`;
    return `Q${qYear[2]} 20${qYear[1]}`;
  }
  const qCompactYear = n.match(/\bQ([1-4])20(\d{2})\b/i);
  if (qCompactYear) return `Q${qCompactYear[1]} 20${qCompactYear[2]}`;
  const ordinal = n.match(
    /\b(first|second|third|fourth)[_\s-]+quarter(?:[_\s-]+and[_\s-]+full[_\s-]+year)?[_\s-]+(20\d{2})\b/i,
  );
  if (ordinal) {
    const fq = { first: 1, second: 2, third: 3, fourth: 4 }[ordinal[1]!.toLowerCase()];
    if (!fq) return null;
    return `Q${fq} ${ordinal[2]}`;
  }
  return null;
}

function isKoRejectedPdf(href: string): boolean {
  const n = decodeKoHref(href).toLowerCase();
  return /transcript|margin[_\s-]*analysis|gng|cagny|10-q|10-k|form[_\s-]*10|sustainability|environmental/i.test(
    n,
  );
}

function isKoSlidesPdf(href: string): boolean {
  if (isKoRejectedPdf(href)) return false;
  const n = decodeKoHref(href).toLowerCase();
  return /ir[_\s+]*overview[_\s+]*presentation/i.test(n) && /\/db\/861\//i.test(href);
}

function isKoFilingsPdf(href: string): boolean {
  if (isKoRejectedPdf(href)) return false;
  const n = decodeKoHref(href).toLowerCase();
  return /\/earnings_release\//i.test(href) && /earnings[_\s+]*release/i.test(n);
}

function absKo(href: string, pageUrl: string): string | null {
  try {
    return new URL(href.replace(/&amp;/g, "&"), pageUrl).href.split("#")[0]!;
  } catch {
    return null;
  }
}

/** Parse Coca-Cola IR HTML for earnings-release + IR Overview PDFs (never transcripts / 10-Q). */
export function parseKoEarningsHtml(html: string, pageUrl: string): Map<string, KoQuarterDocs> {
  const out = new Map<string, KoQuarterDocs>();
  const hrefRe = /(?:href|src)\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = absKo((m[1] ?? "").trim(), pageUrl);
    if (!href || !/coca-colacompany\.com/i.test(href)) continue;
    const label = labelFromKoPdfHref(href);
    if (!label) continue;
    const cur = out.get(label) ?? { slides: null, filings: null };
    if (!cur.slides && isKoSlidesPdf(href)) cur.slides = href;
    else if (!cur.filings && isKoFilingsPdf(href)) cur.filings = href;
    out.set(label, cur);
  }
  return out;
}
