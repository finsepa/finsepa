/**
 * TSMC first-party IR PDFs on investor.tsmc.com (opaque encrypt_file hashes).
 *
 * Scraped from investor.tsmc.com/english/quarterly-results/{year}/q{n} (CF-walled for bots).
 *
 * Slides = Presentation Material (E).
 * Filings package (one Filings slot) = Earnings Release + Management Report + Financial Statements;
 * we lock Earnings Release as the filings URL (package lead), with Management Report / FS as fallbacks.
 */

export type TsmcQuarterDocs = {
  fq: number;
  fy: number;
  slides?: string;
  /** Preferred Filings lock target (package lead). */
  earningsRelease?: string;
  managementReport?: string;
  financialStatements?: string;
};

/** Curated Phase-1 map (Q1 2022 – latest). Extend when new quarters publish. */
export const TSMC_IR_QUARTER_DOCS: readonly TsmcQuarterDocs[] = [
  {
    fq: 2,
    fy: 2026,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-07/0e4d9625c9ef46521afd54002f835e45a9035043/2Q26%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-07/a80d7933be643644081584087731f73b22ea5a2c/2Q26%20EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-07/6f49632674bd2d0fd48cb65aaf89ec6ab510b559/2Q26%20ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-07/114aaca0fea2050e96b91fffbab9ed04ba09cd92/FS.pdf",
  },
  {
    fq: 1,
    fy: 2026,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/a7e3abe65a3fbc342aa55f9f53a5490dd621c1ac/1Q26%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/e85216eea8dccd8ca75d7e040e8d57be3ccd618b/1Q26%20EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/5508a9df8981f587c73dbfaf9f577f142e22bbb1/1Q26ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-04/541d1d3dc007a3bbb1dc0e118019964aee9ef0b0/FS.pdf",
  },
  {
    fq: 4,
    fy: 2025,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-01/bb5dd5e3537d7661e694fa2588e7a29f7c0410e6/4Q25%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-01/3e49621566a3ca53bdf8aee2586929b666c17fd6/4Q25EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-01/00fe50f72b38d74e6b9b066398f020f337cd4e9d/4Q25%20Management%20Report.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-02/cb73d5f4e019a8f6d7a494a0f8f6c6da2dfc4ee2/FS.pdf",
  },
  {
    fq: 3,
    fy: 2025,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-10/e2bc3d3489511b11699eed2c65c4ad22162270e3/3Q25%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-10/ff1cf977182dad2178b6d158e61d375ac98ff517/3Q25EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-10/90cb476be2e8406ba477c417a552d36d632db5c3/3Q25ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-10/5db3e377172cf60a48e4a3a2d7fb46963789ec51/FS.pdf",
  },
  {
    fq: 2,
    fy: 2025,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-07/21137c0bdddbdbe5f466d593015ad85db52bbb3e/2Q25%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-07/d9d294ed46ca22c560a17eb060373bc35f2d464a/2Q25EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-07/1fec9df3de99e6e9f190e1eda7179449381ce6d8/2Q25ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-07/a0b313164d9e5620b24929db32e6c6af7f3e6807/FS.pdf",
  },
  {
    fq: 1,
    fy: 2025,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-04/ee52288ce5bd516a6346a4129eb00d1aac300beb/1Q25%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-04/6580235c47b7b8f1056b071faa44d958c2c3ba04/1Q25EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-04/8e7d27fd8fb010c689d221dc3b8450095bbfc7e2/1Q25ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-04/ae894c20458e4885df6919511660de815cc6cf71/FS.pdf",
  },
  {
    fq: 4,
    fy: 2024,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-01/244ed7a603f240c2aaf09c21b22e9356beec897d/4Q24%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-01/cc4e1dec3474f69109d5455fbf8939c3e3cd5a71/4Q24EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2025-01/2d8b2bb6fc3b5887d24ae0635f639c1cdca834f3/4Q24ManagementReport.pdf",
  },
  {
    fq: 3,
    fy: 2024,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-10/9ca706c18831d2f07b460082cbe1776f4632d404/3Q24%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-10/d00bfb55ffe01e36f56863f975e88d827f9943e8/3Q24EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-10/a4e7bb7392eb95e242cf1bef89bee75a6ddbde3a/3Q24ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-10/bde3d1cb4c490f895059ce201f88e6b57bcc03b8/FS.pdf",
  },
  {
    fq: 2,
    fy: 2024,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-07/7512d1adfdcad311ae571119b0a90f9d87171935/2Q24%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-07/a152eded224aa1b83fdf342ed71d4c42af013915/2Q24EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-07/2550bfd736184ea491797ba93a95bc28efa4348c/2Q24ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-07/17399162366195508ba6dadc3f0e29453ddc0a3e/FS.pdf",
  },
  {
    fq: 1,
    fy: 2024,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-04/93ac4d64a5f16b53c2a31320b7316a0e58333f4f/1Q24%20Presentation%20%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-04/e19914dd320b6386af51d5ed27fa5c51af9c441e/1Q24EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-04/9581a862df11956db366e0f18aa0f859e7e0b6db/1Q24ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-04/94814966a7343a852f97d92cf37b751642ae51d8/FS.pdf",
  },
  {
    fq: 4,
    fy: 2023,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-01/3e43ab2cb1ddad664ef9fe09c6ae80fa69167eea/4Q23Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-01/b65d7a92d8dc9da3f66817946d941401fa4b2cda/4Q23EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2024-01/894c1f6b900634fd7f369ef213bdfbf11c617297/4Q23ManagementReport.pdf",
  },
  {
    fq: 3,
    fy: 2023,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-10/58d5eb3be78e2b45aabc7ebd464e3ac3b8e71bcc/3Q23Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-10/fec9688d56fc0c61b747de9a224a8a15c47bdf20/3Q23EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-10/1b3950499f2e6d02b6910adf903705404f829200/3Q23ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-10/668888b99c79add24048c3f09c4922824bbaead2/FS.pdf",
  },
  {
    fq: 2,
    fy: 2023,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-07/aa7d1adbe692cf07f10aa1584c832facb43ee84b/2Q23Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-07/ad504a4ad5534f8078babbe190b3d071aa02cc92/2Q23EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-07/d0aea5e175f63c90dcd121adcd38da8b520537ef/2Q23ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-07/9499f925a76bd9dcdb6d56457dffa0aeb970b2c7/FS.pdf",
  },
  {
    fq: 1,
    fy: 2023,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-04/8647f0e714162975c5740e709c0990a326c3bbb7/1Q23Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-04/765324723cf228ac306b87854f31fef5ebc9cd68/1Q23EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-04/f58bb638a3230c1018f1516c990e535c77fbf187/1Q23ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-04/acd503b6af80e0439baa9987cf144352b5dddbd2/FS.pdf",
  },
  {
    fq: 4,
    fy: 2022,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-01/92c560bc8693eb0e57efc21d3b6b162dad8afafe/4Q22Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-01/1a8d67b6664e51d49cbbbd2b16fcd2ec36b3acab/4Q22EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-01/91107cbb4214c395a1a26e73edb31f5c1813c599/4Q22ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2023-02/8dd8b6bbd00c6c6fc6b6880790247c714597212c/FS.pdf",
  },
  {
    fq: 3,
    fy: 2022,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-10/f5dc70ecc11508db51dffaf9d165c232cc76dcf2/3Q22Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-10/a924f47cae2629ecb5f8801629cf7fb8773e5444/3Q22EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-10/0aad3caf9324d01d834b215a98884f24be5aef77/3Q22ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-10/af5773d7f9f2c0c6ff95d60367c219ab7b718dec/FS.pdf",
  },
  {
    fq: 2,
    fy: 2022,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-07/543ddc8ea483d7767592012bc4b9727e70b09a1b/2Q22Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-07/95e05d031e382c1beaf2b7f088e2dee32e13a0bc/2Q22EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-07/a49bf25516daeca5a101ec03c0852de00c8a1d7c/2Q22ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-07/ce35ed1febcb5bcec8841bf8b041a27a32696da2/FS.pdf",
  },
  {
    fq: 1,
    fy: 2022,
    slides: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-04/18c9e75717e6d3f0c0e02d0c4a938942b7d87a31/1Q22Presentation%28E%29.pdf",
    earningsRelease: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-04/087738faabd68c42b662ed59ce00bf2355e229b0/1Q22EarningsRelease.pdf",
    managementReport: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-07/433cc369bbdb0bbfa43a7d23c05b197249117990/1Q22ManagementReport.pdf",
    financialStatements: "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2022-04/265da6cce43bffd70dff3d0069d0a70c8a966c4c/FS.pdf",
  },
];

/** Pick Filings URL: EarningsRelease first (package lead), then ManagementReport, then FS. */
export function tsmcFilingsUrlFromPackage(docs: TsmcQuarterDocs): string | null {
  return docs.earningsRelease ?? docs.managementReport ?? docs.financialStatements ?? null;
}

export function tsmcFilingsPackageUrls(docs: TsmcQuarterDocs): string[] {
  return [docs.earningsRelease, docs.managementReport, docs.financialStatements].filter(
    (u): u is string => Boolean(u),
  );
}

export function tsmcDocsByLabel(): Map<string, TsmcQuarterDocs> {
  const m = new Map<string, TsmcQuarterDocs>();
  for (const d of TSMC_IR_QUARTER_DOCS) m.set(`Q${d.fq} ${d.fy}`, d);
  return m;
}
