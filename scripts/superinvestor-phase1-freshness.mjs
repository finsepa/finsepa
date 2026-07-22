#!/usr/bin/env node
/**
 * Compare production market_snapshot accessions vs SEC latest 13F-HR head.
 */
import { createClient } from "@supabase/supabase-js";

const SLUG_CIK = {
  "berkshire-hathaway": "0001067983",
  "bill-ackman": "0001336528",
  "terry-smith": "0001569205",
  "michael-burry": "0001649339",
  "cathie-wood": "0001697748",
  "li-lu": "0001709323",
  "ray-dalio": "0001350694",
  "ken-fisher": "0000850529",
  "primecap-management": "0000763212",
  "ken-griffin": "0001423053",
  "charlie-munger": "0000783412",
  blackrock: "0002012383",
  "baillie-gifford": "0001088875",
  "renaissance-technologies": "0001037389",
  point72: "0001603466",
  "first-eagle": "0001325447",
  "chris-hohn": "0001647251",
  "jeremy-grantham": "0001352662",
};

const UA = process.env.SEC_EDGAR_USER_AGENT || "Finsepa finsepa@finsepa.com";

function normAcc(a) {
  return String(a || "").replace(/-/g, "");
}

async function secHead(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const j = await res.json();
  const forms = j.filings?.recent?.form ?? [];
  const acc = j.filings?.recent?.accessionNumber ?? [];
  const dates = j.filings?.recent?.filingDate ?? [];
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "13F-HR" || forms[i] === "13F-HR/A") {
      return { accession: acc[i], filingDate: dates[i], form: forms[i] };
    }
  }
  return null;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: rows } = await supabase
    .from("market_snapshot")
    .select("key, segment, updated_at, data")
    .like("key", "superinvestor_13f_profile_v3_%");

  const byCik = new Map();
  for (const r of rows ?? []) {
    const cik = r.key.replace("superinvestor_13f_profile_v3_", "");
    byCik.set(cik, r);
  }

  const out = [];
  let stale = 0;
  let missing = 0;
  for (const [slug, cik] of Object.entries(SLUG_CIK)) {
    const row = byCik.get(cik);
    const pageAcc = row?.data?.comparison?.current?.accessionNumber ?? null;
    const pageFiling = row?.data?.comparison?.current?.filingDate ?? null;
    const holdingCount = row?.data?.comparison?.rows?.length ?? 0;
    let head = null;
    try {
      head = await secHead(cik);
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      head = { error: String(e) };
    }
    const snapSeg = row?.segment ?? null;
    const secAccNorm = normAcc(head?.accession);
    const pageAccNorm = normAcc(pageAcc);
    const fresh = Boolean(row && secAccNorm && pageAccNorm && secAccNorm === pageAccNorm);
    if (!row) missing++;
    else if (!fresh) stale++;
    out.push({
      slug,
      cik,
      hasSnapshot: Boolean(row),
      holdingCount,
      snapshotSegment: snapSeg,
      pageAccession: pageAcc,
      pageFilingDate: pageFiling,
      snapshotUpdatedAt: row?.updated_at ?? null,
      secAccession: head?.accession ?? null,
      secFilingDate: head?.filingDate ?? null,
      accessionMatch: fresh,
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        managersTotal: Object.keys(SLUG_CIK).length,
        missingSnapshots: missing,
        staleVsSec: stale,
        freshCount: Object.keys(SLUG_CIK).length - missing - stale,
        managers: out,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
