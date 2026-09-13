/** Verizon (VZ) IR — calendar FY. Slides = Presentation PDF; Filings = Financial Statements PDF. Never transcript / infographic / non-GAAP / HTML news. */

export type VzQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

function file(id: number, token: string): string {
  return `https://www.verizon.com/about/file/${id}/download?token=${token}`;
}

export const VZ_IR_PAGES = [
  "https://www.verizon.com/about/investors/quarterly-earnings",
] as const;

/** Browser/HTTP-verified Drupal file downloads from each quarter webcast page. */
export const VZ_KNOWN_QUARTER_DOCS: Readonly<Record<string, VzQuarterDocs>> = {
  "Q2 2026": { slides: file(78237, "KV8JW0Dr"), filings: file(78229, "qv4Debqh") },
  "Q1 2026": { slides: file(78041, "tBL4ZiFX"), filings: file(78047, "DqgIJF0k") },
  "Q4 2025": { slides: file(77407, "WuOO5xIN"), filings: file(77411, "N9QLvNww") },
  "Q3 2025": { slides: file(76647, "4aIsX69l"), filings: file(76633, "P8wDXRsG") },
  "Q2 2025": { slides: file(75785, "kpMIKbqE"), filings: file(75789, "wNIH2JVz") },
  "Q1 2025": { slides: file(75393, "YV9pzrj3"), filings: file(75383, "Yvwzkpoi") },
  "Q4 2024": { slides: file(74415, "mnXZnAvn"), filings: file(74375, "O3eldbCM") },
  "Q3 2024": { slides: file(73259, "4dsov7CX"), filings: file(73263, "CG1DKjoV") },
  "Q2 2024": { slides: file(72021, "abh5ZwJd"), filings: file(71959, "YzbNVmUA") },
  "Q1 2024": { slides: file(70849, "c7aQukVC"), filings: file(70853, "1NvBuv4v") },
  "Q4 2023": { slides: file(69541, "Ytyee1KY"), filings: file(69545, "0ya98vW3") },
  "Q3 2023": { slides: file(68535, "rjIRr5NE"), filings: file(68515, "mj5LgNSj") },
  "Q2 2023": { slides: file(67263, "UU48aiYv"), filings: file(67267, "AqC973TQ") },
  "Q1 2023": { slides: file(66885, "z7Kpm2cT"), filings: file(66887, "rVh3Y4fM") },
  "Q4 2022": { slides: file(65599, "QKBL4TSJ"), filings: file(65593, "LvhSDVwf") },
  "Q3 2022": { slides: file(64431, "Nvk6nRGL"), filings: file(64433, "ff62cvVq") },
  "Q2 2022": { slides: file(62869, "TvT32njv"), filings: file(63075, "EvxSjaCc") },
  "Q1 2022": { slides: file(62013, "IzvhdvD4"), filings: file(62449, "HXxs0nV9") },
};

export function isVzRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|transcript|infographic|non-?gaap|reconcil|8-?k|10-?q|10-?k/i.test(n);
}

export function isVzIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!(u.hostname === "www.verizon.com" || u.hostname === "verizon.com")) return false;
    if (/\/about\/file\/\d+\/download\/?$/i.test(u.pathname) && u.searchParams.has("token")) return true;
    return u.pathname.includes("/about/sites/default/files/") && /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeVzKnownQuarterDocs(): Map<string, VzQuarterDocs> {
  return new Map(Object.entries(VZ_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
