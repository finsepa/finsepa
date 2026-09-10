/** Banco Santander IR: English earnings presentation as slides, English press as filings. Never institutional / FI / financial-report / ES-only. */

export type SanQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

const DAM = "https://www.santander.com/content/dam/santander-com/en/documentos";

function priv(ymd: string, name: string, kind: "earnings-presentation" | "press-release"): string {
  const [y, m, d] = ymd.split("-");
  return `${DAM}/informacion-privilegiada/${y}/${m}/hr-${y}-${m}-${d}-${name}-${kind}-en.pdf`;
}

function rt(year: number, folder: string, stem: string): string {
  return `${DAM}/resultados-trimestrales/${year}/${folder}/rt-${stem}-${year}-banco-santander-earnings-presentation-en.pdf`;
}

export const SAN_IR_PAGES = [
  "https://www.santander.com/en/shareholders-and-investors/financial-and-economic-information",
] as const;

/** Calendar FY. Publish-date folders are not period-end. Q1/Q2 2022 decks not recovered. */
export const SAN_KNOWN_QUARTER_DOCS: Readonly<Record<string, SanQuarterDocs>> = {
  "Q2 2026": {
    slides: priv("2026-07-22", "second-quarter-2026-results", "earnings-presentation"),
    filings: priv("2026-07-22", "second-quarter-2026-results", "press-release"),
  },
  "Q1 2026": {
    slides: priv("2026-04-29", "first-quarter-2026-results", "earnings-presentation"),
    filings: priv("2026-04-29", "first-quarter-2026-results", "press-release"),
  },
  "Q4 2025": {
    slides: priv("2026-02-03", "2025-results", "earnings-presentation"),
    filings: priv("2026-02-03", "2025-results", "press-release"),
  },
  "Q3 2025": {
    slides: priv("2025-10-29", "third-quarter-2025-results", "earnings-presentation"),
    filings: priv("2025-10-29", "third-quarter-2025-results", "press-release"),
  },
  "Q2 2025": {
    slides: priv("2025-07-30", "second-quarter-2025-results", "earnings-presentation"),
    filings: priv("2025-07-30", "second-quarter-2025-results", "press-release"),
  },
  "Q1 2025": {
    slides: priv("2025-04-30", "first-quarter-2025-results", "earnings-presentation"),
    filings: priv("2025-04-30", "first-quarter-2025-results", "press-release"),
  },
  "Q4 2024": {
    slides: priv("2025-02-05", "2024-results", "earnings-presentation"),
    filings: priv("2025-02-05", "2024-results", "press-release"),
  },
  "Q3 2024": {
    slides: priv("2024-10-29", "third-quarter-2024-results", "earnings-presentation"),
    filings: priv("2024-10-29", "third-quarter-2024-results", "press-release"),
  },
  "Q2 2024": {
    slides: priv("2024-07-24", "first-half-2024-results", "earnings-presentation"),
    filings: priv("2024-07-24", "first-half-2024-results", "press-release"),
  },
  "Q1 2024": {
    slides: priv("2024-04-30", "first-quarter-2024-results", "earnings-presentation"),
    filings: priv("2024-04-30", "first-quarter-2024-results", "press-release"),
  },
  "Q4 2023": {
    slides: priv("2024-01-31", "2023-results", "earnings-presentation"),
    filings: priv("2024-01-31", "2023-results", "press-release"),
  },
  "Q3 2023": {
    slides: priv("2023-10-25", "third-quarter-2023-results", "earnings-presentation"),
    filings: priv("2023-10-25", "third-quarter-2023-results", "press-release"),
  },
  "Q2 2023": {
    slides: priv("2023-07-26", "first-half-2023-results", "earnings-presentation"),
    filings: priv("2023-07-26", "first-half-2023-results", "press-release"),
  },
  "Q1 2023": {
    slides: priv("2023-04-25", "first-quarter-2023-results", "earnings-presentation"),
    filings: priv("2023-04-25", "first-quarter-2023-results", "press-release"),
  },
  "Q4 2022": {
    slides: priv("2023-02-02", "2022-results", "earnings-presentation"),
    filings: priv("2023-02-02", "2022-results", "press-release"),
  },
  "Q3 2022": {
    slides: rt(2022, "3q", "3q"),
    filings: priv("2022-10-26", "third-quarter-2022-results", "press-release"),
  },
  "Q2 2022": {
    slides: null,
    filings: priv("2022-07-28", "first-half-2022-results", "press-release"),
  },
  "Q1 2022": {
    slides: null,
    filings: priv("2022-04-26", "first-quarter-2022-results", "press-release"),
  },
};

export function isSanRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|institutional|presentacion-institucional|renta-fija|fixed[-_\s]?income|financial-report|supplementary|20-?f|-es\.pdf|informe-con-relevancia/i.test(
    n,
  );
}

export function isSanIrPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/santander\.com\/content\/dam\/.+\.pdf/i.test(url)) return false;
  if (isSanRejected(url)) return false;
  return /earnings-presentation-en\.pdf|press-release-en\.pdf/i.test(url);
}

export function mergeSanKnownQuarterDocs(): Map<string, SanQuarterDocs> {
  return new Map(Object.entries(SAN_KNOWN_QUARTER_DOCS).map(([k, v]) => [k, { ...v }]));
}
