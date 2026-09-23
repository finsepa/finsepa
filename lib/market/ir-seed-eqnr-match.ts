/**
 * EQNR IR seed — 12-31.
 * Equinor ASA ADR calendar FY. Slides=CFO/CEO quarterly presentation; Filings=financial-statements-and-review on Sanity CDN. Latest Q2 2026. Scope stats: 18 green / 0 yellow / 0 red quarter(s). Never SEC HTML.
 * Never SEC HTML / transcript / 10-Q / 10-K.
 */

export type EqnrQuarterDocs = {
  slides: string | null;
  filings: string | null;
};

export const EQNR_IR_PAGES = [
  "https://www.equinor.com/investors/quarterly-results",
] as const;

export const EQNR_KNOWN_QUARTER_DOCS: Readonly<Record<string, EqnrQuarterDocs>> = {
  "Q1 2022": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/ab5c8903af7ea2c71a780c4e9ad4dda2574720f8.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/2d87c0b7b42a1e93d07450935afbb8c6e071d7f2.pdf",
  },
  "Q2 2022": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/9ef12d7c74f1a0ca199b064b0683762af77ecc98.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/6594b0bc0fbf52e1552264b131fbf108a3cf532a.pdf",
  },
  "Q3 2022": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/5437206261089f83102cd3b3c435117c1c5dfaa2.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/47fc2210056cff86ad250974c1d874389dd414ab.pdf",
  },
  "Q4 2022": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/43996ff1d2305a724aeddce14fa3330bf5c81562.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/014d3ce10d508b685735bbede6ce3a6279290e9d.pdf",
  },
  "Q1 2023": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/5045471c09d4aef29bf53871466a17aa0553007a.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/84e2662e2cae915fc68fb821a58d46760a908d67.pdf",
  },
  "Q2 2023": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/d7f990e98ee79eac698bbe247452487f9262d00b.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/2ddacbfcb63fe6bfb0a8fcd51d3821a8d3a83985.pdf",
  },
  "Q3 2023": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/8f18674ba10ffd170f90f937c43b9fdaaf0d6691.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/bdb7304f52f2bb1d8232c362de7dfb935565323b.pdf",
  },
  "Q4 2023": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/eb08265780e6a0e9b5fbafb42221548f2b5e41ef.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/8ea5addf8c0d1129734939503b9e6afd311182f3.pdf",
  },
  "Q1 2024": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/04e9588d6a9f667710b0a29815ec9eca3693a37b.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/6fffb8ae54a09e710b2d9536ede600d06adf674d.pdf",
  },
  "Q2 2024": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/9cbb55350a2f1debbe35b73aec6da098f0e127a8.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/86e471e627363b6d0e11b839f19e703d060685fd.pdf",
  },
  "Q3 2024": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/8b30613dae7a7cf1a31a46c9b02f0d68cdc600b3.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/18a02e599d46770217516c36b5adfc1fd905162e.pdf",
  },
  "Q4 2024": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/5e9eac39077fcd6e11d0818ceb48fac8bd09abb9.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/0e669ef01e45012c8392d33c792da2ba6c27a60b.pdf",
  },
  "Q1 2025": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/de4a32d0289a0b7fdf1784f1de1757dc483cb4de.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/ed1b8083e956680ccf1abac2172146bd2c3cc3e5.pdf",
  },
  "Q2 2025": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/53bc84fd8070922ae990494b0098ee9a0b2f8d5e.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/6d7e9ccae521e607f64cd3c3de4ece5c6c514ff3.pdf",
  },
  "Q3 2025": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/3c133a2471688a20092e14a5a2801b066e5cb584.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/1076ae946124491794687a843c115299662e71e0.pdf",
  },
  "Q4 2025": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/74368cc3c5227cb39c30d700443c4b37fd49b2cb.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/a16ada304291bf3d03e3a5dba0ddd68031b143da.pdf",
  },
  "Q1 2026": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/929e4e69128a3125a0515f0b03647e90d3aa6da9.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/53aaf7c1ee7944aea232befdf1c95d6c872a6a76.pdf",
  },
  "Q2 2026": {
    slides: "https://cdn.sanity.io/files/h61q9gi9/global/634ef1d232840f68e2393caf4bd400efc9f200eb.pdf",
    filings: "https://cdn.sanity.io/files/h61q9gi9/global/c0440c05d52a88d521781730b795e0bb635703ba.pdf",
  },
};

export function isEqnrRejected(href: string, title = ""): boolean {
  const n = `${decodeURIComponent(href)} ${title}`.toLowerCase();
  return /sec\.gov|10-?q|10-?k|\b8-?k\b|proxy|transcript|webcast|investor.?day|reconcili|nongaap|\.xls|\.xlsx|\.csv(?:$|[?#])|annual.?report|sustainab|esg|climate|capital.?markets/i.test(n);
}

export function isEqnrIrPdf(href: string | null | undefined): boolean {
  if (!href || isEqnrRejected(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!(host === "cdn.sanity.io" || host.endsWith(".sanity.io"))) return false;
    if (!(u.pathname.includes("/files/h61q9gi9/") || u.pathname.includes("/files/"))) return false;
    return /\.pdf(?:$|[?#])/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function mergeEqnrKnownQuarterDocs(): Map<string, EqnrQuarterDocs> {
  return new Map(Object.entries(EQNR_KNOWN_QUARTER_DOCS));
}
