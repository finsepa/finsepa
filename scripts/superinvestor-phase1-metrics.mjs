#!/usr/bin/env node
/**
 * Superinvestors Phase 1 coverage / validation metrics against market_snapshot.
 *
 * Usage:
 *   node --env-file=.env.local scripts/superinvestor-phase1-metrics.mjs
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

const WEIGHT_TOL = 0.05;

function validateComparison(comparison) {
  const rows = comparison?.rows ?? [];
  const holdingCount = rows.length;
  const portfolioValueUsd = rows.reduce((s, r) => s + (Number.isFinite(r.valueUsd) ? r.valueUsd : 0), 0);
  const weightSum = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  const unresolvedTickerCount = rows.filter((r) => !String(r.ticker ?? "").trim()).length;
  const seen = new Map();
  for (const row of rows) {
    const k =
      row.cusip && String(row.cusip).length >= 6
        ? `CUSIP:${String(row.cusip).toUpperCase()}`
        : `ISS:${String(row.companyName ?? "").trim().toUpperCase()}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const duplicateKeyCount = [...seen.values()].filter((n) => n > 1).length;
  const errors = [];
  if (holdingCount <= 0) errors.push("empty_holdings");
  if (holdingCount > 0 && portfolioValueUsd <= 0) errors.push("non_positive_portfolio_value");
  if (holdingCount > 0 && Math.abs(weightSum - 100) > WEIGHT_TOL) {
    errors.push(`weight_sum_out_of_tolerance:${weightSum.toFixed(4)}`);
  }
  if (duplicateKeyCount > 0) errors.push(`duplicate_holdings:${duplicateKeyCount}`);
  return {
    ok: errors.length === 0,
    holdingCount,
    portfolioValueUsd,
    weightSum,
    unresolvedTickerCount,
    duplicateKeyCount,
    errors,
    resolutionRate: holdingCount > 0 ? (holdingCount - unresolvedTickerCount) / holdingCount : 1,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await supabase
    .from("market_snapshot")
    .select("key, segment, updated_at, data")
    .like("key", "superinvestor_13f_profile_v3_%");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));
  const managers = [];
  let missing = 0;
  let unresolvedTotal = 0;
  let holdingsTotal = 0;
  let failingValidation = 0;
  let newestFiling = null;
  let newestAcc = null;

  for (const [slug, cik] of Object.entries(SLUG_CIK)) {
    const key = `superinvestor_13f_profile_v3_${cik}`;
    const row = byKey.get(key);
    if (!row) {
      missing += 1;
      managers.push({ slug, cik, hasSnapshot: false });
      continue;
    }
    const page = row.data;
    const v = validateComparison(page?.comparison);
    unresolvedTotal += v.unresolvedTickerCount;
    holdingsTotal += v.holdingCount;
    if (!v.ok) failingValidation += 1;
    const filingDate = page?.comparison?.current?.filingDate ?? null;
    const acc = page?.comparison?.current?.accessionNumber ?? null;
    if (filingDate && (!newestFiling || filingDate > newestFiling)) {
      newestFiling = filingDate;
      newestAcc = acc;
    }
    managers.push({
      slug,
      cik,
      hasSnapshot: true,
      segment: row.segment,
      updatedAt: row.updated_at,
      filingDate,
      accession: acc,
      ...v,
    });
  }

  const present = 18 - missing;
  const resolutionRate = holdingsTotal > 0 ? (holdingsTotal - unresolvedTotal) / holdingsTotal : null;

  const report = {
    generatedAt: new Date().toISOString(),
    phase0Baseline: {
      managersWithProfileSnapshot: 4,
      managersTotal: 18,
      note: "Phase 0 audit (2026-07-21): void upserts + cron timeout left most profiles without durable snapshots",
    },
    now: {
      managersTotal: 18,
      managersWithProfileSnapshot: present,
      managersMissingSnapshots: missing,
      unresolvedTickers: unresolvedTotal,
      holdingsTotal,
      tickerResolutionRate: resolutionRate,
      portfoliosFailingValidation: failingValidation,
      newestSECAccession: newestAcc,
      newestFilingDate: newestFiling,
    },
    managers: managers.sort((a, b) => a.slug.localeCompare(b.slug)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
