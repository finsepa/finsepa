/** Mastercard q4cdn earnings Presentation / Release filename variants. */

const MA_Q4CDN_FINANCIALS = "https://s25.q4cdn.com/479285134/files/doc_financials";

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

export function maSlidesUrl(fq: number, fy: number): string {
  return maSlidesCandidates(fq, fy)[0]!;
}

export function maFilingsUrl(fq: number, fy: number): string {
  return maFilingsCandidates(fq, fy)[0]!;
}

/** Issuer filename drift: `3Q23-Mastercard-…`, `1Q25-Earnings-Release`, `2Q25-…-Website`. */
export function maSlidesCandidates(fq: number, fy: number): string[] {
  const yy = yy2(fy);
  const q = `${fq}Q${yy}`;
  const base = `${MA_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  return [
    `${base}/${q}-Mastercard-Earnings-Presentation.pdf`,
    `${base}/${q}-Earnings-Presentation-Website.pdf`,
    `${base}/${q}-Earnings-Presentation.pdf`,
  ];
}

export function maFilingsCandidates(fq: number, fy: number): string[] {
  const yy = yy2(fy);
  const q = `${fq}Q${yy}`;
  const base = `${MA_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  return [
    `${base}/${q}-Mastercard-Earnings-Release.pdf`,
    `${base}/${q}-Earnings-Release-Final.pdf`,
    `${base}/${q}-Earnings-Release.pdf`,
    `${base}/${fq}Q-${fy}-Mastercard-Earnings-Release.pdf`,
  ];
}
