//
//  sec-exhibit-html-pick.ts
//
//  Pure Form 8-K/6-K index helpers — pick Exhibit 99.1 (press) vs 99.2 (slides) HTML.
//

const SEC_ORIGIN = "https://www.sec.gov";

/** Unescape common HTML entities in href targets (SEC pages use &amp;). */
function decodeSecHref(s: string): string {
  return s.split("&amp;").join("&").split("&#38;").join("&");
}

function filingDirectoryBase(cikNumeric: string, accessionFlat: string): string {
  return `${SEC_ORIGIN}/Archives/edgar/data/${cikNumeric}/${accessionFlat}/`;
}

function scorePressReleaseExhibitHref(href: string): number {
  const n = href.toLowerCase();
  if (/shareholder\s*letter|shareholderletter/i.test(n)) return -100;
  if (/slide|slides|slidesfin|presentation|deck|992|ex[-_.]?99[-_.]?2|vpower|powerpoint/i.test(n)) {
    return -100;
  }
  let score = 50;
  if (/991|ex[-_.]?99[-_.]?1/i.test(n)) score += 150;
  if (/interim\s*report|interimreport/i.test(n)) score += 120;
  if (/ex[-_.]?99|exhibit[-_.]?99/i.test(n)) score += 80;
  if (/results\.htm/i.test(n) && !/cover/i.test(n)) score += 70;
  if (/press|release|earn|result|q\d|fy\d/i.test(n)) score += 40;
  if (/cover/i.test(n)) score -= 60;
  if (/\.htm$/i.test(n)) score += 10;
  return score;
}

function scorePresentationExhibitHref(href: string): number {
  const n = href.toLowerCase();
  // True press-release names — never slides (UNH Q1 26: earningsrelease1q26press.htm).
  if (/press/i.test(n) && /earn|release|991/i.test(n)) return -100;
  if (/ex991pressrelease|ex991earningsrelease|q[1-4]\d{2,3}ex991/i.test(n)) return -100;
  // Caterpillar EX-99.2 is dealer retail statistics, not an earnings deck.
  if (/retailstatisti|retail\.htm|toform.*retail/i.test(n)) return -100;
  // Generic earnings-release filenames without deck signals.
  if (
    /earningsrel|earningsrelease|earnings[-_.]?release/i.test(n) &&
    !/vpower|powerpoint|slide|present|deck|992|uhgearnings/i.test(n)
  ) {
    return -100;
  }
  if (/991|ex[-_.]?99[-_.]?1/i.test(n) && !/slide|present|deck|992|vpower/i.test(n)) return -100;

  let score = 40;
  if (/shareholder\s*letter|shareholderletter/i.test(n)) score += 170;
  if (/slide|slides|slidesfin|presentation|deck/i.test(n)) score += 180;
  // UNH files PowerPoint HTML as `*vpower*.htm` (EX-99.2).
  if (/vpower|powerpoint/i.test(n)) score += 200;
  // UNH sometimes names EX-99.2 `uhgearningsreleaseq12026.htm` (no "press").
  if (/uhgearnings/i.test(n) && !/press/i.test(n)) score += 160;
  if (/992|ex[-_.]?99[-_.]?2/i.test(n)) score += 100;
  if (/ex[-_.]?99|exhibit[-_.]?99/i.test(n)) score += 40;
  if (/earn|result|q\d|fy\d/i.test(n)) score += 20;
  if (/\.htm$/i.test(n)) score += 10;
  return score;
}

/** Map exhibit HTM filenames → EX-99.N from the Form 8-K/6-K index table Type column. */
function exhibitTypeByHrefFile(indexHtml: string): Map<string, number> {
  const out = new Map<string, number>();
  const rows = indexHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const typeM = row.match(/\bEX-?99\.([1-9])\b/i);
    if (!typeM) continue;
    const n = Number(typeM[1]);
    if (!Number.isFinite(n)) continue;
    for (const hm of row.matchAll(/href=['"]([^'"]+\.htm(?:l)?)['"]/gi)) {
      const href = (hm[1] ?? "").split("#")[0] ?? "";
      const file = decodeURIComponent(href.split("/").pop() ?? "").toLowerCase();
      if (file) out.set(file, n);
    }
  }
  return out;
}

function pickExhibit99HtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
  scoreHref: (href: string) => number,
  preferExhibit99?: 1 | 2,
): string | null {
  const html = decodeSecHref(indexHtml);
  const base = filingDirectoryBase(cikNumeric, accessionFlat);
  const exhibitType = exhibitTypeByHrefFile(html);
  const candidates: { url: string; score: number }[] = [];

  for (const m of html.matchAll(/href=['"]([^'"]+)['"]/gi)) {
    const href = (m[1] ?? "").split("#")[0] ?? "";
    if (!href || /\.pdf$/i.test(href)) continue;
    if (!/\.htm/i.test(href)) continue;
    if (
      !/ex[-_.]?99|exhibit[-_.]?99|press|earn|result|interim|fnv|slide|present|deck|991|992|shareholder|vpower|uhgearnings/i.test(
        href,
      )
    ) {
      continue;
    }
    if (/prcov|bbcov/i.test(href)) continue;

    const abs = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${SEC_ORIGIN}${href}`
        : `${base}${href.replace(/^\//, "")}`;

    let score = scoreHref(href);
    if (score < 0) continue;

    const file = decodeURIComponent(href.split("/").pop() ?? "").toLowerCase();
    const exN = exhibitType.get(file);
    if (preferExhibit99 != null && exN != null) {
      if (exN === preferExhibit99) score += 300;
      else if (preferExhibit99 === 2 && exN === 1) score -= 200;
      else if (preferExhibit99 === 1 && exN === 2) score -= 200;
    }

    candidates.push({ url: abs, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

/** Prefer earnings press release / interim report HTML from a Form 8-K or 6-K `index.htm`. */
export function pickExhibit99PressReleaseHtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  return pickExhibit99HtmlUrl(indexHtml, cikNumeric, accessionFlat, scorePressReleaseExhibitHref, 1);
}

/** Prefer earnings presentation / slide deck HTML (Exhibit 99.2) from a Form 8-K index. */
export function pickExhibit99PresentationHtmlUrl(
  indexHtml: string,
  cikNumeric: string,
  accessionFlat: string,
): string | null {
  return pickExhibit99HtmlUrl(indexHtml, cikNumeric, accessionFlat, scorePresentationExhibitHref, 2);
}
