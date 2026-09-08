import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TSMC_SEC_QUARTER_DOCS,
  tsmcSecDocsByFiscalPeriodEnd,
} from "./ir-seed-tsmc-sec-catalog.ts";
import { isIrVaultAllowedUrl } from "./earnings-ir-vault-types.ts";

describe("ir-seed-tsmc-sec-catalog", () => {
  it("covers all vault quarters with SEC slides + filings", () => {
    assert.equal(TSMC_SEC_QUARTER_DOCS.length, 18);
    const by = tsmcSecDocsByFiscalPeriodEnd();
    for (const end of [
      "2022-03-31",
      "2022-06-30",
      "2022-09-30",
      "2022-12-31",
      "2026-06-30",
    ]) {
      const docs = by.get(end);
      assert.ok(docs, `missing ${end}`);
      assert.equal(isIrVaultAllowedUrl(docs!.slides), true);
      assert.equal(isIrVaultAllowedUrl(docs!.filings), true);
      assert.match(docs!.slides, /sec\.gov\/Archives\/edgar/i);
      assert.match(docs!.filings, /sec\.gov\/Archives\/edgar/i);
    }
  });
});
