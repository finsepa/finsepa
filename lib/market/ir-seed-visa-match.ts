/** Visa q4cdn / investor.visa.com Presentation + Earnings Release filename variants. */

const VISA_Q4CDN = "https://s1.q4cdn.com/050606653/files/doc_financials";
const VISA_IR = "https://investor.visa.com/files/doc_financials";

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

function quarterOrdinalWord(fq: 1 | 2 | 3 | 4): "First" | "Second" | "Third" | "Fourth" {
  return fq === 1 ? "First" : fq === 2 ? "Second" : fq === 3 ? "Third" : "Fourth";
}

function visaFileBases(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  return [`${VISA_Q4CDN}/${fy}/q${fq}`, `${VISA_IR}/${fy}/q${fq}`];
}

/** Issuer drift: `Visa-Inc.-…` (dot), `Q4-23-Earnings-Deck-FINAL`. */
export function visaSlidesCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const ord = quarterOrdinalWord(fq);
  const yy = yy2(fy);
  const names = [
    `Visa-Inc.-${ord}-Quarter-${fy}-Financial-Results-Presentation.pdf`,
    `Visa-Inc-${ord}-Quarter-${fy}-Financial-Results-Presentation.pdf`,
    `Visa-Inc-Fiscal-${ord}-Quarter-${fy}-Financial-Results-Presentation.pdf`,
    `Q${fq}-${yy}-Earnings-Deck-FINAL.pdf`,
    `Q${fq}-${fy}-Earnings-Deck-FINAL.pdf`,
  ];
  return visaFileBases(fy, fq).flatMap((base) => names.map((n) => `${base}/${n}`));
}

/** Issuer drift: `…-_FINAL`, `…-vFinal`, `Q1'23-Earnings-Release-FINAL`. */
export function visaFilingsCandidates(fy: number, fq: 1 | 2 | 3 | 4): string[] {
  const yy = yy2(fy);
  const names = [
    `Q${fq}-${fy}-Earnings-Release-_FINAL.pdf`,
    `Q${fq}-${fy}-Earnings-Release-vFinal.pdf`,
    `Q${fq}-${fy}-Earnings-Release-FINAL.pdf`,
    `Q${fq}-${fy}-Earnings-Release_vF.pdf`,
    `Q${fq}-${fy}-Earnings-Release_vF1.pdf`,
    `Q${fq}-${fy}-Earnings-Release.pdf`,
    `Q${fq}'${yy}-Earnings-Release-FINAL.pdf`,
    `Q${fq}%27${yy}-Earnings-Release-FINAL.pdf`,
  ];
  return visaFileBases(fy, fq).flatMap((base) => names.map((n) => `${base}/${n}`));
}
