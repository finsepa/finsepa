import assert from "node:assert/strict";
import test from "node:test";

import { fiscalQuarterFromPeriodEndYmd } from "./fiscal-quarter-label.ts";
import { ARM_FY_END, ARM_KNOWN_QUARTER_DOCS, isArmRejected } from "./ir-seed-arm-match.ts";
import { babaYmFromPeriodEndYmd, babaYmFromTitle, parseBabaQuarterlyListJson, pressPdfFromBabaDocumentJson } from "./ir-seed-baba-match.ts";
import { PANW_FY_END, PANW_KNOWN_QUARTER_DOCS, isPanwRejected } from "./ir-seed-panw-match.ts";
import { isShelRejected, parseShelQuarterlyModelJson } from "./ir-seed-shel-match.ts";
import { isWfcRejected, wfcFilingsUrl, wfcSlidesCandidates } from "./ir-seed-wfc-match.ts";

test("WFC prefers financial-results then presentation; never supplement", () => {
  const q2 = wfcSlidesCandidates(2, 2026);
  assert.match(q2[0] ?? "", /second-quarter-2026-financial-results\.pdf/);
  assert.match(q2[1] ?? "", /second-quarter-2026-presentation\.pdf/);
  assert.match(wfcFilingsUrl(2, 2026), /second-quarter-2026-earnings\.pdf/);
  const q3 = wfcSlidesCandidates(3, 2025);
  assert.match(q3[0] ?? "", /third-quarter-2025-presentation\.pdf/);
  assert.equal(
    isWfcRejected("https://www.wellsfargo.com/assets/pdf/about/investor-relations/earnings/first-quarter-2026-earnings-supplement.pdf"),
    true,
  );
});

test("SHEL model JSON maps slides and press; rejects QRA and transcript", () => {
  const raw = JSON.stringify({
    a: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q2-2026-slides.pdf",
    b: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q2-2026-quarterly-press-release.pdf",
    c: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q2-2026-qra-document.pdf",
    d: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q2-2026-speech-transcript.pdf",
    e: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q1-2022-slide.pdf",
    f: "/content/experience-fragments/shell/corporate/quarterly/master/_jcr_content/x/q1-2022-quarterly-press.pdf",
  });
  const map = parseShelQuarterlyModelJson(raw);
  assert.match(map.get("Q2 2026")?.slides ?? "", /q2-2026-slides\.pdf/);
  assert.match(map.get("Q2 2026")?.filings ?? "", /q2-2026-quarterly-press-release\.pdf/);
  assert.match(map.get("Q1 2022")?.slides ?? "", /q1-2022-slide\.pdf/);
  assert.match(map.get("Q1 2022")?.filings ?? "", /q1-2022-quarterly-press\.pdf/);
  assert.equal(isShelRejected("https://www.shell.com/x/q2-2026-qra-document.pdf"), true);
});

test("BABA June Quarter maps to period-end month, not March FY", () => {
  assert.equal(babaYmFromTitle("June Quarter 2026 Results"), "2026-06");
  assert.equal(babaYmFromPeriodEndYmd("2026-06-30"), "2026-06");
  const parsed = parseBabaQuarterlyListJson({
    success: true,
    content: [
      {
        documentTitle: { en_US: "June Quarter 2026 Results" },
        pressRelease: "2026456290057781248",
        urls: {
          presentationUrl_en_US:
            "https://data.alibabagroup.com/ecms-files/1567773279/a9d0a2f3-beca-402c-b3c1-526c2064d10f/June%20Quarter%202026%20Results.pdf",
          transcriptUrl_en_US:
            "https://data.alibabagroup.com/ecms-files/x/EN%20Jun%202026%20Q%20-%20Alibaba%20Earnings%20Call.pdf",
        },
      },
    ],
  });
  assert.match(parsed.get("2026-06")?.slides ?? "", /June%20Quarter%202026%20Results\.pdf/);
  assert.equal(parsed.get("2026-06")?.pressId, "2026456290057781248");
  const press = pressPdfFromBabaDocumentJson({
    content: {
      documentTitle: { en_US: "Alibaba Group Announces June Quarter 2026 Results" },
      documentContentEnUS:
        '<a href="https://data.alibabagroup.com/ecms-files/1532295521/fa5d65fc-9b3e-4e82-a8fc-4ce1c3e2c407/Alibaba%20Group%20Announces%20June%20Quarter%202026%20Results.pdf">PDF</a>',
    },
  });
  assert.match(press ?? "", /Announces%20June%20Quarter%202026%20Results\.pdf/);
});

test("ARM March FY: Jun 30 is Q1 next FY; catalog Q4 2026; reject transcript", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-06-30", ARM_FY_END), { fq: 1, fy: 2027 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-03-31", ARM_FY_END), { fq: 4, fy: 2026 });
  assert.match(ARM_KNOWN_QUARTER_DOCS["Q4 2026"]?.slides ?? "", /33244a6e-1929-4a61-ac25-e8a30fcfa4d5/);
  assert.equal(isArmRejected("https://investors.arm.com/static-files/x-transcript"), true);
  assert.equal(isArmRejected("https://group.softbank/investor-arm_q1fy2026_01_en.pdf"), true);
});

test("PANW July FY: Jul 31 is Q4; catalog Q3 2026; reject supplement", () => {
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2026-07-31", PANW_FY_END), { fq: 4, fy: 2026 });
  assert.deepEqual(fiscalQuarterFromPeriodEndYmd("2025-10-31", PANW_FY_END), { fq: 1, fy: 2026 });
  assert.match(PANW_KNOWN_QUARTER_DOCS["Q3 2026"]?.slides ?? "", /67ce9226-4fe0-43cd-b83e-42efb035f38c/);
  assert.equal(PANW_KNOWN_QUARTER_DOCS["Q3 2026"]?.filings, null);
  assert.equal(isPanwRejected("https://investors.paloaltonetworks.com/static-files/x", "Supplemental Financials"), true);
  assert.equal(isPanwRejected("https://investors.paloaltonetworks.com/static-files/x", "Earnings Call Transcript"), true);
});
