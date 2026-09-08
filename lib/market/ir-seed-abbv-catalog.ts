/**
 * AbbVie IR static-files UUIDs (press releases = Filings).
 * Slides = earnings-day Pipeline Update from investors.abbvie.com/presentations
 * (matched by "As of {report date}"). Do not reuse JPM / acquisition decks.
 */

export type AbbvQuarterDocs = {
  fq: number;
  fy: number;
  filings?: string;
  slides?: string;
};

const S = "https://investors.abbvie.com/static-files";

/** Curated from investors.abbvie.com financial-releases (Q1 2022+). */
export const ABBV_IR_QUARTER_DOCS: readonly AbbvQuarterDocs[] = [
  {
    fq: 2,
    fy: 2026,
    filings: `${S}/54e24524-1f24-4a49-8b48-c0333a96dc39`,
    slides: `${S}/de1828c0-47ed-42cb-8573-24fe42ceb748`,
  },
  {
    fq: 1,
    fy: 2026,
    filings: `${S}/223dc800-fb24-45bc-b0ad-7a179610fda5`,
    slides: `${S}/5bb173b5-053e-4e6e-b028-c82cf2ee96a0`,
  },
  {
    fq: 4,
    fy: 2025,
    filings: `${S}/d9f96450-a1f3-431a-998f-1510cefacda4`,
    slides: `${S}/a88f5dbd-340e-4cfc-ba72-39bf41ec207e`,
  },
  { fq: 3, fy: 2025, filings: `${S}/f270b0f4-666c-4cb1-841d-5fde4a1838cc` },
  { fq: 2, fy: 2025, filings: `${S}/a3a87cb9-4571-48a0-aa85-d355ae65a371` },
  { fq: 1, fy: 2025, filings: `${S}/3f892a1f-9727-4aae-b39d-29f8dd904cb5` },
  {
    fq: 4,
    fy: 2024,
    filings: `${S}/db848c7a-c2f9-4805-9978-f4f714fcaa33`,
    slides: `${S}/40321791-a852-4854-af07-d45e2d6590ef`,
  },
  { fq: 3, fy: 2024, filings: `${S}/31b7f467-aace-41a4-9c4f-ac6a25ddf2e7` },
  { fq: 2, fy: 2024, filings: `${S}/c9936258-3a4c-48f0-968b-6d533ead6dee` },
  { fq: 1, fy: 2024, filings: `${S}/af510304-0bc1-4781-9090-b6c4a9be5edb` },
  {
    fq: 4,
    fy: 2023,
    filings: `${S}/831c0d3d-8813-4942-b7af-a3dade33bea5`,
    slides: `${S}/aefa6da8-17b6-4527-906f-bebc7aab2d5d`,
  },
  { fq: 3, fy: 2023, filings: `${S}/296839c1-fd45-44b5-875e-c11e77924358` },
  { fq: 2, fy: 2023, filings: `${S}/4e2baf8c-1b83-4167-8afc-eb468995afab` },
  { fq: 1, fy: 2023, filings: `${S}/5ee232f8-f714-422b-8b8e-9f475f7ad4e2` },
  {
    fq: 4,
    fy: 2022,
    filings: `${S}/3a5af393-efb3-4661-8325-3198d93e2771`,
    slides: `${S}/9200a822-5d4b-4a1d-a4f3-720cb7b76723`,
  },
  { fq: 3, fy: 2022, filings: `${S}/de6bbd95-f5be-4aeb-9417-bdbb94695045` },
  { fq: 2, fy: 2022, filings: `${S}/96b45631-9073-42ad-a490-a09f1d108cb1` },
  { fq: 1, fy: 2022, filings: `${S}/b37af441-45e9-4e16-b2e9-74a115d615a0` },
];

export function abbvDocsByLabel(): Map<string, AbbvQuarterDocs> {
  const m = new Map<string, AbbvQuarterDocs>();
  for (const d of ABBV_IR_QUARTER_DOCS) m.set(`Q${d.fq} ${d.fy}`, d);
  return m;
}
