#!/usr/bin/env node
/**
 * Superinvestors Phase 2 — performance audit profiler (read-only).
 * Measures DB read, JSON parse/stringify, payload structure, and production API timing.
 */
import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

const SLUGS = [
  { slug: "ken-fisher", cik: "0000850529" },
  { slug: "ray-dalio", cik: "0001350694" },
  { slug: "ken-griffin", cik: "0001423053" },
  { slug: "blackrock", cik: "0002012383" },
  { slug: "renaissance-technologies", cik: "0001037389" },
];

const BASE = process.env.PROFILE_BASE_URL || "https://app.finsepa.com";

function byteSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

function analyzePayload(page) {
  const cmp = page.comparison ?? {};
  const tx = page.transactions ?? {};
  const rows = cmp.rows ?? [];
  const quarters = tx.quarters ?? [];
  const txFlat = quarters.flatMap((q) => q.transactions ?? []);

  const cmpBytes = byteSize(cmp);
  const txBytes = byteSize(tx);
  const totalBytes = byteSize(page);

  // Field repetition: companyName appears in comparison rows AND transaction rows
  const cmpNames = new Set(rows.map((r) => r.companyName?.trim().toLowerCase()));
  const txNames = new Set(txFlat.map((t) => t.companyName?.trim().toLowerCase()));

  const priceFields = txFlat.filter(
    (t) => t.avgClosingPriceUsd != null || t.priceRangeLowUsd != null || t.priceRangeHighUsd != null,
  ).length;

  const nullPriceBytes = byteSize(
    txFlat.map((t) => ({
      ...t,
      avgClosingPriceUsd: null,
      priceRangeLowUsd: null,
      priceRangeHighUsd: null,
    })),
  );

  return {
    totalBytes,
    gzipBytes: gzipSync(Buffer.from(JSON.stringify(page))).length,
    comparisonBytes: cmpBytes,
    transactionsBytes: txBytes,
    comparisonRows: rows.length,
    transactionQuarters: quarters.length,
    transactionRows: txFlat.length,
    soldOutRows: (cmp.soldOut ?? []).length,
    priceFieldsPopulated: priceFields,
    txBytesWithoutPrices: nullPriceBytes,
    potentialPriceFieldSavingsBytes: txBytes - nullPriceBytes,
    repeatedMetadata: {
      filerDisplayNameInBoth: Boolean(cmp.filerDisplayName && tx.filerDisplayName),
      cikInBoth: Boolean(cmp.cik && tx.cik),
      sourceInBoth: Boolean(cmp.source && tx.source),
    },
    avgTxPerQuarter: quarters.length ? txFlat.length / quarters.length : 0,
  };
}

async function profileSnapshot(supabase, cik) {
  const key = `superinvestor_13f_profile_v3_${cik}`;
  const timings = {};

  const t0 = performance.now();
  const { data, error } = await supabase
    .from("market_snapshot")
    .select("key, segment, updated_at, data")
    .eq("key", key)
    .maybeSingle();
  timings.dbQueryMs = Math.round(performance.now() - t0);

  if (error || !data) return { error: error?.message ?? "missing", timings };

  const rawJson = JSON.stringify(data.data);
  timings.dbPayloadBytes = Buffer.byteLength(rawJson, "utf8");
  timings.dbRowCount = 1;

  const t1 = performance.now();
  const parsed = JSON.parse(rawJson);
  timings.jsonParseMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  // Simulate normalization: validate weights, map rows
  const rows = parsed.comparison?.rows ?? [];
  const weightSum = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  const portfolioValue = rows.reduce((s, r) => s + (Number.isFinite(r.valueUsd) ? r.valueUsd : 0), 0);
  const unresolved = rows.filter((r) => !r.ticker?.trim()).length;
  timings.normalizationMs = Math.round(performance.now() - t2);
  timings.derived = { weightSum, portfolioValue, unresolved };

  const t3 = performance.now();
  const serialized = JSON.stringify(parsed);
  timings.serializationMs = Math.round(performance.now() - t3);
  timings.serializedBytes = Buffer.byteLength(serialized, "utf8");
  timings.gzipBytes = gzipSync(Buffer.from(serialized)).length;

  const analysis = analyzePayload(parsed);

  return {
    segment: data.segment,
    updatedAt: data.updated_at,
    timings,
    analysis,
  };
}

async function profileTransactionsApi(slug) {
  const url = `${BASE}/api/superinvestors/${slug}/transactions`;
  const results = { slug, url, runs: [] };

  for (let i = 0; i < 2; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const buf = Buffer.from(await res.arrayBuffer());
    const totalMs = Math.round(performance.now() - t0);
    const rawBytes = buf.length;
    let gzipBytes = rawBytes;
    try {
      gzipBytes = gzipSync(buf).length;
    } catch {
      /* ignore */
    }
    let parsed = null;
    let parseMs = 0;
    if (res.ok) {
      const t1 = performance.now();
      parsed = JSON.parse(buf.toString("utf8"));
      parseMs = Math.round(performance.now() - t1);
    }
    results.runs.push({
      run: i + 1,
      http: res.status,
      totalMs,
      rawBytes,
      gzipBytes,
      jsonParseMs: parseMs,
      cacheControl: res.headers.get("cache-control"),
      quarters: parsed?.quarters?.length ?? null,
      txRows: parsed?.quarters?.flatMap((q) => q.transactions ?? []).length ?? null,
    });
  }
  results.warmRun = results.runs[1];
  results.coldRun = results.runs[0];
  return results;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const report = {
    generatedAt: new Date().toISOString(),
    profileBaseUrl: BASE,
    snapshots: {},
    transactionsApi: {},
  };

  for (const { slug, cik } of SLUGS) {
    report.snapshots[slug] = await profileSnapshot(supabase, cik);
    report.transactionsApi[slug] = await profileTransactionsApi(slug);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
