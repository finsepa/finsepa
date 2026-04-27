import "server-only";

const Q4CDN_FILES = "https://s201.q4cdn.com/141608511/files";

/** Default pattern used for recent quarters (same tree as “Quarterly presentation” on IR). */
export function nvidiaQuarterlyPresentationPdfUrl(fiscalQuarter: number, fiscalYear: number): string {
  const yy = fiscalYear % 100;
  const yy2 = String(yy).padStart(2, "0");
  return `${Q4CDN_FILES}/doc_financials/${fiscalYear}/q${fiscalQuarter}/NVDA-F${fiscalQuarter}Q${yy2}-Quarterly-Presentation-FINAL.pdf`;
}

/**
 * Extra q4cdn URLs to try **before** {@link nvidiaQuarterlyPresentationPdfUrl} (HEAD in order).
 * NVIDIA has used `doc_presentations/…`, `doc_financials/…/Q2/…` (capital quarter folder), and
 * `…_FINAL.pdf` vs `…-FINAL.pdf` naming over time.
 */
const PRESENTATION_PRIORS: Partial<Record<string, string[]>> = {
  "2023-Q1": [`${Q4CDN_FILES}/doc_presentations/2022/05/NVDA-F1Q23-Investor-Presentation-FINAL.pdf`],
  "2023-Q2": [`${Q4CDN_FILES}/doc_financials/2023/Q2/NVDA-F2Q23-Investor-Presentation-FINAL.pdf`],
  "2023-Q3": [`${Q4CDN_FILES}/doc_financials/2023/q3/NVDA-F3Q23-Investor-Presentation_FINAL.pdf`],
  "2023-Q4": [`${Q4CDN_FILES}/doc_presentations/2023/02/nvda-f4q23-investor-presentation-final.pdf`],
  "2024-Q1": [`${Q4CDN_FILES}/doc_presentations/2023/06/nvda-f1q24-investor-presentation-final.pdf`],
  "2024-Q2": [`${Q4CDN_FILES}/doc_presentations/2023/08/nvda-f2q24-investor-presentation-final.pdf`],
  "2024-Q3": [`${Q4CDN_FILES}/doc_presentations/2023/11/nvda-f3q24-investor-presentation-final.pdf`],
};

export function nvidiaQuarterlyPresentationCandidateUrls(fiscalQuarter: number, fiscalYear: number): string[] {
  const key = `${fiscalYear}-Q${fiscalQuarter}`;
  const fallback = nvidiaQuarterlyPresentationPdfUrl(fiscalQuarter, fiscalYear);
  const priors = PRESENTATION_PRIORS[key];
  if (!priors?.length) return [fallback];
  const out = [...priors];
  if (!out.includes(fallback)) out.push(fallback);
  return out;
}
