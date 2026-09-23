/**
 * BP p.l.c. (BP) IR — calendar FY (full quarterly).
 * Slides = presentation slides / slides+script; Filings = stock-exchange results PDF.
 * Host: www.bp.com/api/files/.... Never transcript / SEC HTML.
 */

export type BpQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const BP_IR_PAGES = [
  "https://www.bp.com/en/global/corporate/investors.html",
  "https://www.bp.com/en/global/corporate/investors/results-and-reporting.html",
] as const;

/** Catalog Q1 2022 → Q2 2026. */
export const BP_KNOWN_QUARTER_DOCS: Readonly<Record<string, BpQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/7ttJLfTZzRtg6iF5uZAWwj/f4fff84aeb7344da3aee82dc7ab2d2b4/bp-first-quarter-2022-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/LmsvVLFh2WdRPVrkrmDmj/c0bca4bfc8d31bcc64d3abe6199c6de6/bp-first-quarter-2022-results.pdf",
  },
  "Q2 2022": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/1Du19bO8Gg78zX7QX0rjEC/a8646b3595936ae225fabf0246f28cbb/bp-second-quarter-2022-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/2S4JB8ZRDvxjrLOYXzMmcf/809e9e3e5d4fc96a5aa213afe16147ea/bp-second-quarter-2022-results.pdf",
  },
  "Q3 2022": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/6hOqp3JPSvii1yMgU513Dd/f580b2b766d8f374ed99b9ee81275a8f/bp-third-quarter-2022-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/5VbOx1eH0g9j8nFLOn2m4F/0473c65d2fe232818fd74c29fe7edf7d/bp-third-quarter-2022-results.pdf",
  },
  "Q4 2022": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/4cCJM2u1zL3Y0nZPzIDnLX/6850b8aeecce2f9be4c73456ee12c73a/bp-fourth-quarter-2022-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/3gUQpSxwy4P9gb24nKoNuy/5e47f9fd50de3691ee2508871ffaa35c/bp-fourth-quarter-2022-results.pdf",
  },
  "Q1 2023": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/364cq6ef4OY2MJHHdw2eiO/04a40cebde9f3edf3f78af9a08340745/bp-first-quarter-2023-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/2reVCPf6T9hQ2x6TTQ4ZxE/a5d1fb1853b05dc09973732de82cd671/bp-first-quarter-2023-results.pdf",
  },
  "Q2 2023": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/3x8gQ9TixlbRcX8meXUXrG/23094d231ae66612ed95c5f460ed3cc6/bp-second-quarter-2023-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/1UKzdURbNqZFxQSWPDCoHA/a114559faa132d11be39f32d8de4c7ac/bp-second-quarter-2023-results.pdf",
  },
  "Q3 2023": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/4dFA77Fs6ymJbWZJ40bXU1/230d08a8f13a4bc20b071e048b72900a/bp-third-quarter-2023-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/2AuG70H2IIlLYNFyyXjUrL/9be8f8e8da6732597373cf89001a5167/bp-third-quarter-2023-results.pdf",
  },
  "Q4 2023": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/3AjAWWEHnIfzHLtZyhYEam/51b9a57fa8033eb12585c87d801897cb/bp-fourth-quarter-2023-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/6ITvRCoFL8wbAIgRZMqouu/2739dcee879ddd146a5327912c3cca15/bp-fourth-quarter-2023-results.pdf",
  },
  "Q1 2024": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/2NLB9S8nPwpPVhUZv9Zk9w/dd0fe3c18b74ff582ce974f23307f73a/bp-first-quarter-2024-results-presentation-slides-and-script.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/45HMM73ksyMc69g8BMowcz/cc1e8d337c2909326fa325baba0bfb2b/bp-first-quarter-2024-results.pdf",
  },
  "Q2 2024": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/2NAaPeDvMreY0g5kxbuDKW/ae777a85e5d46866783672ca12c5e4b3/bp-second-quarter-2024-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/39DlKjPwyDoKHQn9UUpKHc/b1638bc22affdf640ff64855f2e09fe7/bp-second-quarter-2024-results.pdf",
  },
  "Q3 2024": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/49lOmVN0ceEoR44bFQ6WrA/6435975b2698a1ba320b64c906e135a9/bp-third-quarter-2024-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/4nVzkKlohleEB9xdExUXdb/48ddf0314f3f832ca5ef040ba315b80d/bp-third-quarter-2024-results.pdf",
  },
  "Q4 2024": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/dJGBuxD2tBVZFOoPmR3Wf/215cd5b84273111bd420627871ba4a2c/bp-fourth-quarter-2024-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/30eF1X6SS2q7CtrDTpnLUU/14b0a23aabec51300b4ae10ab1386e3e/bp-fourth-quarter-2024-results.pdf",
  },
  "Q1 2025": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/6BlyRUzrqttl8y8dEWsoiK/38feb84063de69fa94296cf64dcbcd3c/bp-first-quarter-2025-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/1kbgLEsXSfz49j9ZifvMRu/59b8b110f3cbe1b3337a55aeea2d06e9/bp-first-quarter-2025-results.pdf",
  },
  "Q2 2025": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/4rljPgfKJToTSeIcd1cZxZ/e001a4035a245512ffc394752cb2dc74/bp-second-quarter-2025-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/461baCHkfI4G1KXJfTCFR/9efbdc77738aece9b6aa76cdc5117b84/bp-second-quarter-2025-results.pdf",
  },
  "Q3 2025": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/6FFNQIuzqqQWtrsJgNWvTg/2fd3d6a59dea6d30ee19d27269540cfa/bp-third-quarter-2025-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/1RyNNXgJpHepSCwj2YS2lX/d54f6e85fa222e8b274ac7240148bb60/bp-third-quarter-2025-results.pdf",
  },
  "Q4 2025": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/1nxU1ONJL3mTSoZQY1nPXg/c2d8ebf665b62c0cb923bed47397220f/bp-fourth-quarter-2025-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/5sKIER14BbMWHkIyxKh70R/f740ab40cc0d4689454ee1c5cf850a58/bp-fourth-quarter-2025-results.pdf",
  },
  "Q1 2026": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/7tYeTOG27RuPbPFFQPN6sp/5c9e2f92ee90f29c087385291cbde2c0/bp-first-quarter-2026-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/2H8Mqba3jEKsyc1YA4Ujwf/e979bdd8877727dbfa36431164d0ec66/bp-first-quarter-2026-results.pdf",
  },
  "Q2 2026": {
    slides: "https://www.bp.com/api/files/6cqieuqhq4no/master/Al5E3T1fDGlspcJnjB4Pq/c688dd7337a3419d55a11a32c3e2b9dd/bp-second-quarter-2026-results-presentation-slides.pdf",
    filings: "https://www.bp.com/api/files/6cqieuqhq4no/master/3m82HmOzrcUhzGfOQ2Uajc/9fbef18373195a44947e3a797d6cc0cf/bp-second-quarter-2026-results.pdf",
  }
};

export function isBpRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|8-?k|proxy|transcript|webcast|supplement|\.xls|\.xlsx|\.csv(?:$|[?#])/i.test(n);
}

export function isBpIrPdf(href: string | null | undefined): boolean {
  if (!href || isBpRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "www.bp.com" || host === "bp.com" || host.endsWith(".bp.com"))) return false;
    if (!u.pathname.includes("/api/files/")) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeBpKnownQuarterDocs(): Map<string, BpQuarterDocs> {
  return new Map(Object.entries(BP_KNOWN_QUARTER_DOCS));
}
