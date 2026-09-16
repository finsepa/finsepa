/**
 * Anheuser-Busch InBev (BUD) IR — calendar FY.
 * Slides = results webcast / presentation deck; Filings = EN press release PDF.
 * Q1–Q4 2022: www.ab-inbev.com/assets/*.pdf
 * Q1 2023+: Results Center PDFs on AB InBev Builder CDN (cdn.builder.io, no .pdf suffix).
 * Never SEC HTML / annual report / sustainability.
 */

export type BudQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

/** AB InBev Builder CMS space used by Results Center document assets. */
export const BUD_BUILDER_API_KEY = "2e5c7fb020194c1a8ee80f743d0b923e";

export const BUD_IR_PAGES = [
  "https://www.ab-inbev.com/investors",
  "https://www.ab-inbev.com/investors/results-center",
] as const;

/** HEAD-verified webcast decks + EN press releases (Q1 2022 → Q2 2026). */
export const BUD_KNOWN_QUARTER_DOCS: Readonly<Record<string, BudQuarterDocs>> = {
  "Q2 2026": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F21bf6a48a976410a901150b44d1949a2?alt=media&token=df2043bc-f98e-48b7-a8dd-550130b7293e&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Ffe05113a2095432faa6ed5871a72918b?alt=media&token=c87bd5b3-b834-4c55-848c-8ead8d7c78e7&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q1 2026": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F2ab6bc0013954b839c791b73b409ee64?alt=media&token=1a5c860a-0dc9-4a3c-b31f-b51845816cd0&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F3c638d8bdc33497aa2b5d7c5b7066c81?alt=media&token=c8178291-d226-492a-b7ed-ad4457e28887&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q4 2025": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F854e2cc6b3054f6aa547fc40970e137c?alt=media&token=0656e76a-062a-4c16-b1f8-6084b403be87&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F5b144c216baa4ad098ca7d21fcde66fb?alt=media&token=b632cd1c-5f46-4c1f-9134-676a84168510&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q3 2025": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F5c46368095e245a0bf9e2c3453f9cab9?alt=media&token=9b78441c-4917-4724-a3d3-ea598d62ca52&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F766de95334684a09a5acbfe4353a6607?alt=media&token=59b8393d-e273-449c-afec-c4f64a3dfac7&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q2 2025": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fd9407b534fef4ab8b38e3cebaafba4d9?alt=media&token=11b7cbad-e720-4661-b377-46151a5deaea&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F40f38d96aede42c6ae1b79fe7a9e6aac?alt=media&token=e50ff6ec-7531-4c54-9ab7-2e4dca50ad24&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q1 2025": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F4871a913b1e44cbf924a094981f553f9?alt=media&token=d4e9820f-4d36-4297-8f92-b97c243c0013&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F481cf86866ee4b0f96ea82b89be8480b?alt=media&token=cfe53e36-ba26-4b08-8b5e-39b71774e990&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q4 2024": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F24dc0793252b4f0fa8b9b7a385404a02?alt=media&token=8a490f21-bc60-4d9c-b005-226d1d2f84bc&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F91c49b27638c46f6b50fedeec9f4ec13?alt=media&token=45f39cf0-8107-4b99-ae70-ed4e5fc75591&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q3 2024": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F4430fbb40b964680b46bab63fd8ce0e6?alt=media&token=3c224ec2-9803-4a06-afad-44a21a811be4&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fa193cd4275544adfab8bfa5c6c051484?alt=media&token=4b065022-4a74-445e-a024-3d92237e3216&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q2 2024": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fb445566fb47e401e87a54887af3bf6d0?alt=media&token=f743fca4-6f66-4ae8-8b07-58b6d89f2eba&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fee66e082429b45909e1ff5f000606ddb?alt=media&token=71cec016-1309-4809-8670-7c87cf9e2aa7&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q1 2024": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Ff565011c208346998a55bc5255dd992f?alt=media&token=62c9aa8a-7a0c-40dd-aab7-f1b5c2364e04&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Ffb409dcdf4b44086bdb023e90df57ad9?alt=media&token=ac6414b0-5f40-4e16-8992-2825f58ef482&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q4 2023": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fc85aa27a87cf4afb8c28f652cdeba567?alt=media&token=e7b87185-b3fd-4a3e-a554-f9a13f13a7ff&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Ff89b71d38e724014b04e717e021b0e26?alt=media&token=59b398c4-487c-4a10-8a9f-bb79334d4960&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q3 2023": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F8747dfe3e5f04098b887827f2dabd4f3?alt=media&token=ae6186f9-e6d6-4a8e-9a31-e06cb6e216a5&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F2c81e81c985d46679b298442d977775a?alt=media&token=7847d3c6-cdb1-4fff-9582-8489c9dce279&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q2 2023": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F1b8da39d4c914c7180493076b0a28ac4?alt=media&token=5b567f10-2301-4e66-b334-a47ba46fb2ae&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fe51be4fadde94a06bda8af48c11802d8?alt=media&token=66c51853-89a3-4cf4-a946-adfcbfdd26d7&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q1 2023": {
    slides:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2F8d5e433b53d84a189a1bc5b1fffd1454?alt=media&token=490ccbcc-7217-4640-9031-17742bdbdb18&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
    filings:
      "https://cdn.builder.io/o/assets%2F2e5c7fb020194c1a8ee80f743d0b923e%2Fc58c3f3068c545458ea4aae858e04c60?alt=media&token=3bd352c5-dee0-4058-9a3f-797b5a9d3801&apiKey=2e5c7fb020194c1a8ee80f743d0b923e",
  },
  "Q4 2022": {
    slides: "https://www.ab-inbev.com/assets/pressreleases/2023/ABInBev%204Q22%20Webcast_External.pdf",
    filings:
      "https://www.ab-inbev.com/assets/pressreleases/2023/FY22_AB%20InBev_Press%20Release_FINAL_EN.pdf",
  },
  "Q3 2022": {
    slides:
      "https://www.ab-inbev.com/assets/pressreleases/2022/10/ABInBev%203Q22%20Webcast_External_vF.pdf",
    filings:
      "https://www.ab-inbev.com/assets/pressreleases/2022/10/3Q22_AB%20InBev_Press%20Release_FINAL_EN.pdf",
  },
  "Q2 2022": {
    slides:
      "https://www.ab-inbev.com/assets/pressreleases/2022/07/ABInBev%202Q22%20Webcast_External.pdf",
    filings:
      "https://www.ab-inbev.com/assets/pressreleases/2022/07/AB%20InBev_HY22%20Press%20Release_FINAL.pdf",
  },
  "Q1 2022": {
    slides: "https://www.ab-inbev.com/assets/presentations/2022/5/ABI%201Q22%20Webcast_External.pdf",
    filings:
      "https://www.ab-inbev.com/assets/pressreleases/2022/05/AB%20InBev_Press%20Release_1Q22_EN_FINAL.pdf",
  },
};

/** True for AB InBev Builder CDN media assets (PDF bytes, no `.pdf` suffix). */
export function isBudBuilderMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== "cdn.builder.io") return false;
    const path = u.pathname;
    const decoded = decodeURIComponent(path);
    const hasKey =
      path.includes(`assets%2F${BUD_BUILDER_API_KEY}%2F`) ||
      decoded.includes(`/assets/${BUD_BUILDER_API_KEY}/`);
    if (!hasKey) return false;
    return u.searchParams.get("alt") === "media";
  } catch {
    return false;
  }
}

export function isBudRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  // Do not reject "webcast" — AB InBev earnings decks are named Webcast_External.
  return /sec\.gov|annual[-_\s]*report|sustainability|10-?q|10-?k|proxy|\.(xls|xlsx|csv)(?:$|[?#])/i.test(
    n,
  );
}

export function isBudIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "cdn.builder.io") {
      return isBudBuilderMediaUrl(url) && !isBudRejected(url);
    }
    if (!(host === "www.ab-inbev.com" || host === "ab-inbev.com" || host.endsWith(".ab-inbev.com"))) {
      return false;
    }
    if (!/\.pdf(?:$|[?#])/i.test(u.pathname)) return false;
    return !isBudRejected(url);
  } catch {
    return false;
  }
}

export function mergeBudKnownQuarterDocs(): Map<string, BudQuarterDocs> {
  return new Map(Object.entries(BUD_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
