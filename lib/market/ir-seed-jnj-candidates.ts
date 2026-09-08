/**
 * Johnson & Johnson q4cdn `doc_financials` URL candidates (IR site is Cloudflare-walled).
 * Filenames vary: Final / Webcast / Draft / V2 / messy press-release drafts.
 */

export const JNJ_Q4CDN_FINANCIALS = "https://s203.q4cdn.com/636242992/files/doc_financials";
export const JNJ_Q4CDN_FILES = "https://s203.q4cdn.com/636242992/files";

export type JnjQuarterDocs = { slides?: string; filings?: string };

function yy2(fy: number): string {
  return String(fy % 100).padStart(2, "0");
}

function qLabel(fq: number, fy: number): string {
  return `Q${fq} ${fy}`;
}

/**
 * GET-verified first-party PDFs. q4cdn HEAD often 404/403 on these names even when GET
 * returns `%PDF-`, so apply overlays them without a HEAD probe.
 */
export const JNJ_KNOWN_QUARTER_DOCS: Readonly<Record<string, JnjQuarterDocs>> = {
  [qLabel(1, 2022)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2022/q1/1Q22-Press-Release-with-attachments.pdf`,
  },
  [qLabel(2, 2022)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2022/q2/2Q22-Press-Release-with-attachments.pdf`,
  },
  [qLabel(3, 2022)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2022/q3/3Q22-Press-Release-with-attachments.pdf`,
  },
  [qLabel(4, 2022)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2022/q4/4Q22-Press-Release-with-attachments.pdf`,
  },
  [qLabel(1, 2023)]: {
    slides: `${JNJ_Q4CDN_FINANCIALS}/2023/q1/FINAL-JNJ-Earnings-Presentation-Q1-2023.pdf`,
    filings: `${JNJ_Q4CDN_FINANCIALS}/2023/q1/1Q23-Press-Release_Final_with-guidance_with-attachments.pdf`,
  },
  [qLabel(2, 2023)]: {
    slides: `${JNJ_Q4CDN_FINANCIALS}/2023/q2/FINAL-JNJ-Earnings-Presentation-Q2-2023.pdf`,
    filings: `${JNJ_Q4CDN_FILES}/doc_news/Johnson--Johnson-Reports-Q2-2023-Results-2023.pdf`,
  },
  [qLabel(3, 2023)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2023/q3/3Q23-Press-Release_Final_With-Guidance_With-Attachments.pdf`,
  },
  [qLabel(4, 2023)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2023/q4/4Q23-Press-Release_Final-_With-Guidance-_With-Attachments-1.pdf`,
  },
  [qLabel(2, 2024)]: {
    slides: `${JNJ_Q4CDN_FINANCIALS}/2024/q2/FINAL-JNJ-Earnings-Presentation-Q2-2024-Webcast.pdf`,
  },
  [qLabel(3, 2024)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2024/q3/3Q24-Press-Release-with-attachments.pdf`,
  },
  [qLabel(4, 2024)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2024/q4/4Q24-Press-Release-with-attachments.pdf`,
  },
  [qLabel(1, 2025)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2025/q1/1Q25-Earnings-Press-Release-Final-Draft-4-14-with-Attachments.pdf`,
  },
  [qLabel(2, 2025)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2025/q2/2Q25-Earnings-Press-Release-Final-7-15-with-Attachments.pdf`,
  },
  [qLabel(3, 2025)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2025/q3/3Q25-Earnings-Press-Release-Final-Draft-10-13-25-3PM-With-Attachments.pdf`,
  },
  [qLabel(1, 2026)]: {
    filings: `${JNJ_Q4CDN_FINANCIALS}/2026/q1/2026-Q1-Form-10-Q-29Mar2026-04222026.pdf`,
  },
};

export function jnjKnownDocsForQuarter(fq: number, fy: number): JnjQuarterDocs | undefined {
  return JNJ_KNOWN_QUARTER_DOCS[qLabel(fq, fy)];
}

export function jnjSlidesCandidateUrls(fq: number, fy: number): string[] {
  const base = `${JNJ_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  const yy = yy2(fy);
  const oneOffs: string[] = [];
  if (fq === 3 && fy === 2025) {
    oneOffs.push(`${base}/JNJ-Earnings-Presentation-Q3-2025-Final-Draft-10-13-2025-2PM.pdf`);
  }
  if (fq === 4 && fy === 2023) {
    oneOffs.push(`${base}/UPDATE-FINAL-JNJ-Earnings-Presentation-Q4-2023-1.pdf`);
  }
  if (fq === 1 && fy === 2023) {
    oneOffs.push(`${base}/FINAL-JNJ-Earnings-Presentation-Q1-2023.pdf`);
  }
  if (fq === 2 && fy === 2023) {
    oneOffs.push(`${base}/FINAL-JNJ-Earnings-Presentation-Q2-2023.pdf`);
  }
  return [
    `${base}/JNJ-Earnings-Presentation-Q${fq}-${fy}-Final.pdf`,
    `${base}/JNJ-Earnings-Presentation-Q${fq}-${fy}-Final-V2.pdf`,
    `${base}/JNJ-Earnings-Presentation-Q${fq}-Final.pdf`,
    `${base}/Final-JNJ-Earnings-Presentation-Q${fq}-${fy}-Webcast.pdf`,
    `${base}/Final-JNJ-Earnings-Presentation-${fq}Q${fy}-Webcast.pdf`,
    `${base}/Final-JNJ-Earnings-Presentation-${fq}Q${yy}-Webcast.pdf`,
    `${base}/Final-JNJ-Earnings-Presentation-${fq}Q${fy}.pdf`,
    `${base}/Final-JNJ-Earnings-Presentation-${fq}Q${yy}.pdf`,
    `${base}/FINAL-JNJ-Earnings-Presentation-Q${fq}-${fy}.pdf`,
    `${base}/FINAL-JNJ-Earnings-Presentation-Q${fq}-${fy}-Webcast.pdf`,
    ...oneOffs,
  ];
}

export function jnjFilingsCandidateUrls(fq: number, fy: number): string[] {
  const base = `${JNJ_Q4CDN_FINANCIALS}/${fy}/q${fq}`;
  const yy = yy2(fy);
  const oneOffs: string[] = [];
  const known = jnjKnownDocsForQuarter(fq, fy);
  if (known?.filings) oneOffs.push(known.filings);
  if (fq === 4 && fy === 2025) {
    oneOffs.push(`${base}/4Q25-Earnings-Press-Release-Final-Draft-01-20-26-6PM-With-Attachments.pdf`);
  }
  if (fq === 1 && fy === 2024) {
    oneOffs.push(`${base}/16/1q24-press-release_final-with-attachments.pdf`);
  }
  if (fq === 2 && fy === 2024) {
    oneOffs.push(`${base}/2Q24-Press-Release_FINAL-7-16-24_with-Attachments.pdf`);
  }
  return [
    `${base}/${fq}Q${yy}-Earnings-Press-Release-Final.pdf`,
    `${base}/${fq}Q${yy}-Earnings-Press-Release.pdf`,
    `${base}/JNJ-${fq}Q${yy}-Earnings-Press-Release-Final.pdf`,
    `${base}/JNJ-${fq}Q${yy}-Earnings-Press-Release.pdf`,
    `${base}/${fq}Q${yy}-Earnings-Release-Final.pdf`,
    `${base}/Final-${fq}Q${yy}-Earnings-Press-Release.pdf`,
    `${base}/${fq}Q${yy}-Press-Release-Final.pdf`,
    `${base}/${fq}Q${yy}-Press-Release-with-attachments.pdf`,
    `${base}/${fq}Q${yy}-Press-Release_Final_with-guidance_with-attachments.pdf`,
    `${base}/${fq}Q${yy}-Press-Release_Final_With-Guidance_With-Attachments.pdf`,
    ...oneOffs,
  ];
}
