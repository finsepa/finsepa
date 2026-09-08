/** Shared Q4 CDN URL patterns for generic IR document resolution. */

export type FiscalQuarter = { fq: number; fy: number };

function fySuffix(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

export function q4CdnQuarterDir(financialsBase: string, fy: number, fq: number): string {
  return `${financialsBase.replace(/\/+$/, "")}/${fy}/q${fq}`;
}

export function buildQ4CdnSlidesCandidates(
  financialsBase: string,
  ticker: string,
  fq: number,
  fy: number,
): string[] {
  const yy = fySuffix(fy);
  const sym = ticker.trim().toUpperCase();
  const qDir = q4CdnQuarterDir(financialsBase, fy, fq);
  return [
    // Mastercard: `2Q26-Mastercard-Earnings-Presentation.pdf`
    `${qDir}/${fq}Q${yy}-Mastercard-Earnings-Presentation.pdf`,
    `${qDir}/${fq}Q${yy}-${sym}-Earnings-Presentation.pdf`,
    `${qDir}/${sym}-${fq}Q-${yy}-Earnings-Presentation.pdf`,
    `${qDir}/${sym}-${fq}Q-${yy}-Earnings-Presentation-FINAL.pdf`,
    `${qDir}/${sym}-Q${fq}-${fy}-Earnings-Presentation.pdf`,
    `${qDir}/${sym}-Q${fq}-${fy}-Earnings-Presentation-FINAL.pdf`,
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}.pdf`,
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}-FINAL.pdf`,
    `${qDir}/Earnings-Presentation-Q${fq}-${fy}-Final.pdf`,
    `${qDir}/Q${fq}-FY${yy}-Quarterly-Presentation-FINAL.pdf`,
    `${qDir}/Q${fq}-FY${yy}-Earnings-Presentation-FINAL.pdf`,
    `${qDir}/Webslides_Q${fq}${yy}.pdf`,
    `${qDir}/Webslides_Q${fq}${yy}-FINAL.pdf`,
    `${qDir}/Webslides_Q${fq}${yy}_Final.pdf`,
  ];
}

export function buildQ4CdnFilingsCandidates(
  financialsBase: string,
  ticker: string,
  fq: number,
  fy: number,
): string[] {
  const yy = fySuffix(fy);
  const qDir = q4CdnQuarterDir(financialsBase, fy, fq);
  const sym = ticker.trim().toUpperCase();
  return [
    // Mastercard: `2Q26-Mastercard-Earnings-Release.pdf`
    `${qDir}/${fq}Q${yy}-Mastercard-Earnings-Release.pdf`,
    `${qDir}/${fq}Q${yy}-${sym}-Earnings-Release.pdf`,
    `${qDir}/${sym}-Q${fq}-${fy}-Earnings-Release.pdf`,
    `${qDir}/${sym}-Q${fq}-${fy}-Earnings-Release-FINAL.pdf`,
    `${qDir}/${sym}-Q${fq}-${fy}-Earnings-Release-Final.pdf`,
    `${qDir}/${sym}-F${fq}Q${yy}-Earnings-Release-FINAL.pdf`,
    `${qDir}/Q${fq}-FY${yy}-Exhibit-99-1ER-FINAL.pdf`,
    `${qDir}/Q${fq}-FY${yy}-Earnings-Release-FINAL.pdf`,
    `${qDir}/Q${fq}-FY${yy}-Earnings-Release.pdf`,
    `${qDir}/${sym}-Exhibit-99-1.pdf`,
  ];
}

/** Match scraped q4cdn PDFs to a fiscal quarter via path or filename tokens. */
export function filterQ4CdnPdfLinksForQuarter(
  urls: readonly string[],
  fq: number,
  fy: number,
): string[] {
  const yy = fySuffix(fy);
  const qPath = `/${fy}/q${fq}/`.toLowerCase();
  // qN / Nq alone matches every year (LRCX Q4_2026 on every Dec quarter). Require the year too.
  const yearToken = new RegExp(
    `${fy}|(?:^|[^0-9])fy${yy}(?:[^0-9]|$)|${fq}q-?${yy}|(?:^|[/_-])q${fq}[-_'. ]?${yy}(?:[^0-9]|$)|q${fq}[-_ ]${fy}\\b|f${fq}q${yy}`,
    "i",
  );
  const quarterToken = new RegExp(
    `(?:^|[/_-])q${fq}(?:[^0-9]|$)|(?:^|[/_-])${fq}q(?:[^0-9]|$)`,
    "i",
  );
  return urls.filter((u) => {
    const lower = u.toLowerCase();
    if (lower.includes(qPath)) return true;
    const file = decodeURIComponent(lower.split("/").pop()?.split("?")[0] ?? "");
    const hay = `${file} ${lower}`;
    return yearToken.test(hay) && quarterToken.test(hay);
  });
}
