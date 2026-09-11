import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAdbeFinancialDocumentsHtml } from "./ir-seed-adbe-match.ts";

describe("parseAdbeFinancialDocumentsHtml", () => {
  it("extracts Q3 2026 slides + press release from financial-documents HTML", () => {
    const html = `
      <h2>Fiscal year 2026</h2>
      <h3>Q3</h3>
      <a href="/cc-shared/assets/investor-relations/pdfs/01906202/au56y4ter.pdf">Earnings press release</a>
      <a href="/cc-shared/assets/investor-relations/pdfs/01906202/c6yetrerew.pdf">Earnings script and slides</a>
      <a href="/cc-shared/assets/investor-relations/pdfs/01906202/b75st5a4rwea.pdf">Investor datasheet</a>
    `;
    const map = parseAdbeFinancialDocumentsHtml(html, "https://www.adobe.com/investor-relations/financial-documents.html");
    const q3 = map.get("Q3 2026");
    assert.ok(q3);
    assert.match(q3!.slides!, /c6yetrerew\.pdf$/);
    assert.match(q3!.filings!, /au56y4ter\.pdf$/);
  });
});
