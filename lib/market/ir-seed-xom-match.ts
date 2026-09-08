/**
 * ExxonMobil cloudfront IR docs — filenames encode quarter (`2Q26+Earnings+…`).
 * Hash prefixes are opaque; scrape IR archive + known samples.
 */

export const XOM_CF_HASH = "_ffcbd7a566640bfe3df0b1e14b50bc22";
export const XOM_CF_BASE = `https://d1io3yog0oux5.cloudfront.net/${XOM_CF_HASH}/exxonmobil/db/2288`;

export function parseXomQuarterFromFilename(url: string): { fq: number; fy: number } | null {
  const file = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
  const m = file.match(/(?:^|[_\s+.-])([1-4])Q(\d{2})(?:[_\s+.-]|$)/i) ?? file.match(/\bQ([1-4])[_\s.-]?(\d{2})\b/i);
  if (!m) return null;
  const fq = Number(m[1]);
  const yy = Number(m[2]);
  if (!fq || !Number.isFinite(yy)) return null;
  const fy = yy >= 70 ? 1900 + yy : 2000 + yy;
  return { fq, fy };
}

export function classifyXomCloudfrontUrl(url: string): "slides" | "filings" | null {
  const lower = decodeURIComponent(url).toLowerCase();
  if (!lower.includes("d1io3yog0oux5.cloudfront.net")) return null;
  if (!/\.pdf(?:$|[?#])/i.test(lower)) return null;
  if (/transcript|supplement|xlsx|proxy|cautionary/i.test(lower)) return null;
  if (/\/presentation\//i.test(lower) || /earnings[+_\s-]*slides|earnings[+_\s-]*presentation|earnings[+_\s-]*deck/i.test(lower)) {
    return "slides";
  }
  if (/\/earnings_release\//i.test(lower) || /earnings[+_\s-]*release|press[+_\s-]*release/i.test(lower)) {
    return "filings";
  }
  return null;
}

export function extractXomCloudfrontPdfUrls(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/https?:\/\/d1io3yog0oux5\.cloudfront\.net\/[^"'\\\s>]+/gi)) {
    const u = m[0]!.replace(/&amp;/g, "&").split("#")[0]!;
    if (/\.pdf(?:$|[?#])/i.test(u)) out.push(u);
  }
  return [...new Set(out)];
}

function cf(id: string, kind: "presentation" | "earnings_release", file: string): string {
  return `${XOM_CF_BASE}/${id}/${kind}/${file}`;
}

/** Known cloudfront + issuer 10-Q samples for quarters not parsed from the IR homepage. */
export const XOM_KNOWN_DOCUMENT_URLS: ReadonlyArray<{ fq: number; fy: number; slides?: string; filings?: string }> = [
  {
    fq: 1,
    fy: 2022,
    slides: cf("21374", "presentation", "earnings-presentation-1q.pdf"),
    filings:
      "https://investor.exxonmobil.com/sec-filings/all-sec-filings/content/0000034088-22-000026/0000034088-22-000026.pdf",
  },
  {
    fq: 2,
    fy: 2022,
    slides: cf("21375", "presentation", "earnings-presentation-2q.pdf"),
    filings:
      "https://investor.exxonmobil.com/sec-filings/all-sec-filings/content/0000034088-22-000051/0000034088-22-000051.pdf",
  },
  {
    fq: 3,
    fy: 2022,
    slides: cf("21376", "presentation", "earnings-presentation-3q.pdf"),
    filings:
      "https://investor.exxonmobil.com/sec-filings/all-sec-filings/content/0000034088-22-000064/0000034088-22-000064.pdf",
  },
  {
    fq: 4,
    fy: 2022,
    slides: cf("21652", "presentation", "earnings-presentation-4q.pdf"),
    filings:
      "https://investor.exxonmobil.com/sec-filings/all-sec-filings/content/0000034088-23-000020/0000034088-23-000020.pdf",
  },
  {
    fq: 1,
    fy: 2023,
    slides: cf("22047", "presentation", "1Q23+Earnings+Deck_Final+Version.pdf"),
    filings: cf("22047", "earnings_release", "2023-04-28_ExxonMobil_Announces_First_Quarter_2023_1143.pdf"),
  },
  {
    fq: 2,
    fy: 2023,
    slides: cf("22123", "presentation", "XOM+2Q23+Earnings+Deck_Final.pdf"),
    filings: cf("22123", "earnings_release", "XOM+2Q23+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 3,
    fy: 2023,
    slides: "https://d1io3yog0oux5.cloudfront.net/_44ad8dcabf83887c3c4eaf0c3bf3cec5/exxonmobil/db/2288/22151/presentation/XOM+3Q23+Earnings+Deck_Final.pdf",
    filings: cf("22151", "earnings_release", "XOM+3Q23+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 4,
    fy: 2023,
    slides: cf("22190", "presentation", "4Q23+Earnings+Slides_FINAL.pdf"),
    filings: cf("22190", "earnings_release", "4Q23+Earnings+Press+Release+Website+%28with+updated+legends%29.pdf"),
  },
  {
    fq: 1,
    fy: 2024,
    slides: cf("22249", "presentation", "1Q24+Earnings+Slides_FINAL.pdf"),
    filings: cf("22249", "earnings_release", "1Q24+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 2,
    fy: 2024,
    slides: cf("22296", "presentation", "2Q24+Earnings+Slides_Final.pdf"),
    filings: cf("22296", "earnings_release", "2Q24+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 3,
    fy: 2024,
    slides: cf("22327", "presentation", "3Q24+Earnings+Slides+-+Final.pdf"),
    filings: cf("22327", "earnings_release", "3Q24+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 4,
    fy: 2024,
    slides: cf("22354", "presentation", "4Q24+Earnings+Slides+-+Final+.pdf"),
    filings: cf("22354", "earnings_release", "4Q24+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 1,
    fy: 2025,
    slides: cf("22414", "presentation", "1Q25+Earnings+Slides.pdf"),
    filings: cf("22414", "earnings_release", "1Q25+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 2,
    fy: 2025,
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_0983bafc3c9a57084993bc60da1e4799/exxonmobil/db/2288/22462/presentation/2Q25+Earnings+Slides.pdf",
    filings: cf("22462", "earnings_release", "2Q25+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 3,
    fy: 2025,
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_077cc630a6721f637940a6b932cdd7cf/exxonmobil/db/2288/22477/presentation/3Q25+Earnings+Slides.pdf",
    filings: cf("22477", "earnings_release", "3Q25+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 4,
    fy: 2025,
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_17c51753a66af8fad990309030d2cc98/exxonmobil/db/2288/22589/presentation/4Q25+Earnings+Slides.pdf",
    filings:
      "https://d1io3yog0oux5.cloudfront.net/_89f354e9097711072a50cd962544ee60/exxonmobil/db/2288/22589/earnings_release/4Q25+Earnings+Press+Release+Website.pdf",
  },
  {
    fq: 1,
    fy: 2026,
    slides:
      "https://d1io3yog0oux5.cloudfront.net/_debb9bd4674a246d3c8755210e61ab95/exxonmobil/db/2288/22639/presentation/1Q26+Earnings+presentation.pdf",
    filings: cf("22639", "earnings_release", "1Q26+Earnings+Press+Release+Website.pdf"),
  },
  {
    fq: 2,
    fy: 2026,
    slides: `${XOM_CF_BASE}/22701/presentation/2Q26+Earnings+presentation+slides.pdf`,
    filings: `${XOM_CF_BASE}/22701/earnings_release/2Q26+Earnings+Release+Website.pdf`,
  },
];
