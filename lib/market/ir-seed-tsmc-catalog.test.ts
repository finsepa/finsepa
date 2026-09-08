import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TSMC_IR_QUARTER_DOCS,
  tsmcDocsByLabel,
  tsmcFilingsPackageUrls,
  tsmcFilingsUrlFromPackage,
} from "./ir-seed-tsmc-catalog.ts";

describe("ir-seed-tsmc-catalog", () => {
  it("covers Q1 2022 through latest with slides + filings package lead", () => {
    const by = tsmcDocsByLabel();
    assert.ok(by.has("Q1 2022"));
    assert.ok(by.has("Q2 2026"));
    assert.equal(TSMC_IR_QUARTER_DOCS.length, 18);

    for (const docs of TSMC_IR_QUARTER_DOCS) {
      assert.ok(docs.slides, `Q${docs.fq} ${docs.fy} missing slides`);
      const filings = tsmcFilingsUrlFromPackage(docs);
      assert.ok(filings, `Q${docs.fq} ${docs.fy} missing filings package`);
      assert.match(filings, /EarningsRelease|ManagementReport|FS\.pdf/i);
      assert.ok(tsmcFilingsPackageUrls(docs).length >= 2);
    }
  });

  it("Q2 2026 matches Quartr mapping (Presentation slides, EarningsRelease filings lead)", () => {
    const docs = tsmcDocsByLabel().get("Q2 2026");
    assert.ok(docs?.slides?.includes("2Q26%20Presentation"));
    assert.equal(
      tsmcFilingsUrlFromPackage(docs!),
      "https://investor.tsmc.com/english/encrypt/files/encrypt_file/reports/2026-07/a80d7933be643644081584087731f73b22ea5a2c/2Q26%20EarningsRelease.pdf",
    );
    const pkg = tsmcFilingsPackageUrls(docs!);
    assert.ok(pkg.some((u) => u.includes("ManagementReport")));
    assert.ok(pkg.some((u) => u.endsWith("/FS.pdf") || u.includes("/FS.pdf")));
  });
});
