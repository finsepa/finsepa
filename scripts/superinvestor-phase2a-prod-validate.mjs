#!/usr/bin/env node
/**
 * Phase 2A production validation — read-only except optional cold-rebuild probe.
 * Usage: node --env-file=.env.local scripts/superinvestor-phase2a-prod-validate.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

const BASE = process.env.PROFILE_BASE_URL || "https://app.finsepa.com";

const MANAGERS = [
  { slug: "ken-fisher", cik: "0000850529", name: "Ken Fisher" },
  { slug: "ray-dalio", cik: "0001350694", name: "Ray Dalio" },
  { slug: "ken-griffin", cik: "0001423053", name: "Citadel" },
  { slug: "blackrock", cik: "0002012383", name: "BlackRock" },
  { slug: "renaissance-technologies", cik: "0001037389", name: "Renaissance" },
];

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((s, n) => s + n, 0);
  return {
    n: sorted.length,
    min: sorted[0] ?? 0,
    avg: sorted.length ? sum / sorted.length : 0,
    p95: pct(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function parseHeaders(res) {
  return {
    cache: res.headers.get("x-superinvestor-tx-cache"),
    totalMs: Number(res.headers.get("x-superinvestor-tx-ms") ?? NaN),
    readMs: Number(res.headers.get("x-superinvestor-tx-read-ms") ?? NaN),
    buildMs: Number(res.headers.get("x-superinvestor-tx-build-ms") ?? NaN),
    payloadBytes: Number(res.headers.get("x-superinvestor-tx-payload-bytes") ?? NaN),
  };
}

function analyzePayload(payload) {
  const quarters = payload?.quarters ?? [];
  const txFlat = quarters.flatMap((q) => (q.transactions ?? []).map((t) => ({ ...t, _group: q })));
  const issues = [];
  if (!payload?.filerDisplayName || !payload?.cik) issues.push("missing_meta");
  if (!Array.isArray(quarters) || quarters.length === 0) issues.push("no_quarters");

  let missingGroupMeta = 0;
  let dupQuarterOnTx = 0;
  let priceFields = 0;
  for (const q of quarters) {
    if (!q.quarterLabel || !q.reportDate) missingGroupMeta++;
    for (const t of q.transactions ?? []) {
      if (t.quarterLabel != null || t.reportDate != null) dupQuarterOnTx++;
      if (t.avgClosingPriceUsd != null || t.priceRangeLowUsd != null || t.priceRangeHighUsd != null) priceFields++;
      if (!t.kind || !t.companyName) issues.push("bad_tx_row");
    }
  }

  const kinds = new Set(txFlat.map((t) => t.kind));
  const uniqueCusips = new Set(txFlat.map((t) => t.cusip).filter(Boolean));

  return {
    quarters: quarters.length,
    txRows: txFlat.length,
    bytes: Buffer.byteLength(JSON.stringify(payload)),
    missingGroupMeta,
    dupQuarterOnTx,
    priceFields,
    kinds: [...kinds],
    uniqueCusips: uniqueCusips.size,
    issues: [...new Set(issues)],
    sampleQuarter: quarters[0]
      ? {
          label: quarters[0].quarterLabel,
          reportDate: quarters[0].reportDate,
          txCount: quarters[0].transactions?.length ?? 0,
        }
      : null,
  };
}

/** Semantic fingerprint — stable across slim format. */
function payloadFingerprint(payload) {
  const quarters = payload?.quarters ?? [];
  const parts = [];
  for (const q of quarters) {
    for (const t of q.transactions ?? []) {
      parts.push(`${q.reportDate}|${t.kind}|${t.cusip ?? ""}|${t.companyName}|${t.sharesDelta ?? ""}|${t.sharesChangePct ?? ""}`);
    }
  }
  parts.sort();
  return parts.join("\n");
}

async function fetchTx(slug) {
  const url = `${BASE}/api/superinvestors/${slug}/transactions`;
  const started = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const wallMs = performance.now() - started;
  const text = await res.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  const parseStart = performance.now();
  if (payload) JSON.parse(text);
  const deserializeMs = performance.now() - parseStart;
  const serializeStart = performance.now();
  if (payload) JSON.stringify(payload);
  const serializeMs = performance.now() - serializeStart;

  return {
    status: res.status,
    wallMs,
    headers: parseHeaders(res),
    payload,
    analyze: payload ? analyzePayload(payload) : null,
    deserializeMs,
    serializeMs,
    fingerprint: payload ? payloadFingerprint(payload) : null,
  };
}

async function stressWarm(slug, n = 10) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const r = await fetchTx(slug);
    rows.push({
      i: i + 1,
      wallMs: r.wallMs,
      totalMs: r.headers.totalMs,
      readMs: r.headers.readMs,
      buildMs: r.headers.buildMs,
      cache: r.headers.cache,
      bytes: r.analyze?.bytes ?? 0,
      deserializeMs: r.deserializeMs,
      serializeMs: r.serializeMs,
    });
  }
  return {
    wall: stats(rows.map((r) => r.wallMs)),
    total: stats(rows.map((r) => r.totalMs).filter(Number.isFinite)),
    read: stats(rows.map((r) => r.readMs).filter(Number.isFinite)),
    deserialize: stats(rows.map((r) => r.deserializeMs)),
    serialize: stats(rows.map((r) => r.serializeMs)),
    cacheHits: rows.filter((r) => r.cache === "hit").length,
    rows,
  };
}

async function readSnapshot(supabase, cik) {
  const key = `superinvestor_13f_transactions_full_v3_${cik}`;
  const t0 = performance.now();
  const { data, error } = await supabase
    .from("market_snapshot")
    .select("key, segment, updated_at, data")
    .eq("key", key)
    .maybeSingle();
  const readMs = performance.now() - t0;
  if (error || !data) return { exists: false, readMs, key, error: error?.message };

  const raw = data.data;
  const bytes = Buffer.byteLength(JSON.stringify(raw));
  const parseStart = performance.now();
  const parsed = JSON.parse(JSON.stringify(raw));
  const parseMs = performance.now() - parseStart;
  const quarters = parsed?.quarters ?? [];
  const txRows = quarters.flatMap((q) => q.transactions ?? []).length;

  return {
    exists: true,
    key,
    segment: data.segment,
    updatedAt: data.updated_at,
    readMs: Math.round(readMs),
    parseMs: Math.round(parseMs),
    bytes,
    quarters: quarters.length,
    txRows,
  };
}

async function fetchSecAccession(cik) {
  const ua = process.env.SEC_EDGAR_USER_AGENT || "Finsepa validation script (hi@finsepa.com)";
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { "User-Agent": ua, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const recent = j.filings?.recent ?? j;
  const forms = recent.form ?? [];
  const acc = recent.accessionNumber ?? [];
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "13F-HR" || forms[i] === "13F-HR/A") {
      const a = acc[i]?.trim();
      if (a) return a.replace(/-/g, "").toLowerCase();
    }
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && key ? createClient(url, key) : null;

  console.log(`Phase 2A production validation @ ${BASE}`);
  console.log(`Commit target: 47d0c0d\n`);

  const report = { managers: {}, stress: {}, checks: {} };

  for (const m of MANAGERS) {
    console.log(`--- ${m.name} (${m.slug}) ---`);
    const snap = supabase ? await readSnapshot(supabase, m.cik) : { skipped: true };
    const warm1 = await fetchTx(m.slug);
    const warm2 = await fetchTx(m.slug);
    const secSegment = await fetchSecAccession(m.cik);

    const segmentMatch =
      snap.exists && secSegment ? snap.segment === secSegment : snap.exists ? "unknown_sec" : false;

    report.managers[m.slug] = {
      snapshot: snap,
      secSegment,
      segmentMatch,
      warm1: {
        status: warm1.status,
        wallMs: Math.round(warm1.wallMs),
        headers: warm1.headers,
        analyze: warm1.analyze,
      },
      warm2: {
        status: warm2.status,
        wallMs: Math.round(warm2.wallMs),
        headers: warm2.headers,
        fingerprintMatch: warm1.fingerprint === warm2.fingerprint,
      },
    };

    console.log(
      JSON.stringify(
        {
          snapshot: snap,
          secSegment,
          segmentMatch,
          warm1_ms: Math.round(warm1.wallMs),
          warm1_cache: warm1.headers.cache,
          warm1_build_ms: warm1.headers.buildMs,
          warm1_read_ms: warm1.headers.readMs,
          warm2_ms: Math.round(warm2.wallMs),
          warm2_cache: warm2.headers.cache,
          payload_mb: warm1.analyze ? (warm1.analyze.bytes / 1e6).toFixed(2) : null,
          txRows: warm1.analyze?.txRows,
          quarters: warm1.analyze?.quarters,
          integrity: warm1.analyze,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  // Stress: Citadel + Renaissance
  for (const slug of ["ken-griffin", "renaissance-technologies"]) {
    console.log(`=== STRESS 10x warm: ${slug} ===`);
    const s = await stressWarm(slug, 10);
    report.stress[slug] = s;
    console.log(
      JSON.stringify(
        {
          cacheHitRatio: `${s.cacheHits}/10`,
          wallMs: s.wall,
          serverTotalMs: s.total,
          dbReadMs: s.read,
          deserializeMs: s.deserialize,
          serializeMs: s.serialize,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  // Aggregate checks
  const allWarm = Object.values(report.managers);
  report.checks = {
    allSnapshotsExist: allWarm.every((m) => m.snapshot.exists),
    allWarmHit: allWarm.every((m) => m.warm2.headers.cache === "hit"),
    allWarmNoBuild: allWarm.every((m) => m.warm2.headers.buildMs === 0),
    allHttp200: allWarm.every((m) => m.warm1.status === 200 && m.warm2.status === 200),
    allFingerprintStable: allWarm.every((m) => m.warm2.fingerprintMatch),
    allSegmentMatch: allWarm.every((m) => m.segmentMatch === true),
    citadelStressHitRatio: report.stress["ken-griffin"]?.cacheHits / 10,
    renaissanceStressHitRatio: report.stress["renaissance-technologies"]?.cacheHits / 10,
  };

  console.log("=== CHECKLIST ===");
  console.log(JSON.stringify(report.checks, null, 2));

  // Verdict heuristics
  const fisherMs = report.managers["ken-fisher"]?.warm2.wallMs ?? 99999;
  const citadelP95 = report.stress["ken-griffin"]?.wall.p95 ?? 99999;
  const renaissanceP95 = report.stress["renaissance-technologies"]?.wall.p95 ?? 99999;

  let verdict = "PASS";
  const watchReasons = [];
  if (!report.checks.allSnapshotsExist) watchReasons.push("missing_snapshots");
  if (!report.checks.allWarmHit) watchReasons.push("warm_cache_miss");
  if (!report.checks.allWarmNoBuild) watchReasons.push("warm_sec_build");
  if (citadelP95 > 4000 || renaissanceP95 > 4000) watchReasons.push("large_portfolio_warm_over_4s");
  if (fisherMs > 3000) watchReasons.push("fisher_warm_over_3s");
  if (!report.checks.allHttp200) verdict = "ROLLBACK";
  else if (watchReasons.length) verdict = "WATCH";

  console.log("\n=== VERDICT ===");
  console.log(verdict);
  if (watchReasons.length) console.log("Watch reasons:", watchReasons.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
