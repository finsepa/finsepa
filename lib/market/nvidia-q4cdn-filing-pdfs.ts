import "server-only";

/**
 * Direct q4cdn PDFs for NVIDIA Form 10-Q / Form 10-K (investor relations “Filings”),
 * keyed by **fiscal** year and quarter as shown in earnings UI (`Qn YYYY`).
 *
 * Paths mirror `doc_financials/{fy}/…` on q4cdn; one quarter (FY23 Q2) uses a capital `Q2` segment.
 */
const NVDA_Q4CDN_FINANCIALS_BASE = "https://s201.q4cdn.com/141608511/files/doc_financials";

/** `${fiscalYear}-Q${fiscalQuarter}` → path under `doc_financials` (leading slash). */
const FILING_PATH: Record<string, string> = {
  "2023-Q1": "/2023/q1/8b8d4537-83d8-4c94-b065-e7a2cd34da49.pdf",
  "2023-Q2": "/2023/Q2/19426b68-6120-44a3-9032-bb629ef2b3d9.pdf",
  "2023-Q3": "/2023/q3/cd532449-4dc3-404a-a999-25e7b2e8c246.pdf",
  "2023-Q4": "/2023/q4/4e9abe7b-fdc7-4cd2-8487-dc3a99f30e98.pdf",
  "2024-Q1": "/2024/q1/ecefb2b2-efcb-45f3-b72b-212d90fcd873.pdf",
  "2024-Q2": "/2024/q2/19771e6b-cc29-4027-899e-51a0c386111e.pdf",
  "2024-Q3": "/2024/q3/NVIDIA-10Q.pdf",
  "2024-Q4": "/2024/q4/1cbe8fe7-e08a-46e3-8dcc-b429fc06c1a4.pdf",
  "2025-Q1": "/2025/q1/NVIDIA-10Q-20242905.pdf",
  "2025-Q2": "/2025/q2/78501ce3-7816-4c4d-8688-53dd140df456.pdf",
  "2025-Q3": "/2025/q3/ed2a395c-5e9b-4411-8b4a-a718d192155a.pdf",
  "2025-Q4": "/2025/q4/177440d5-3b32-4185-8cc8-95500a9dc783.pdf",
  "2026-Q1": "/2026/q1/b6df1c5c-5cb6-4a41-9d28-dd1bcd34cc26.pdf",
  "2026-Q2": "/2026/q2/2e217538-c226-4d05-8f74-aaca89a21b33.pdf",
  "2026-Q3": "/2026/q3/13e6981b-95ed-4aac-a602-ebc5865d0590.pdf",
  "2026-Q4": "/2026/q4/10K-NVDA.pdf",
};

export function nvidiaQ4cdnFilingPdfUrl(fiscalYear: number, fiscalQuarter: number): string | null {
  const key = `${fiscalYear}-Q${fiscalQuarter}`;
  const path = FILING_PATH[key];
  return path ? `${NVDA_Q4CDN_FINANCIALS_BASE}${path}` : null;
}
