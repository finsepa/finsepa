#!/usr/bin/env node
/**
 * Superinvestors Phase 2A — before/after metrics for transactions API + profile SSR payload.
 *
 * Usage:
 *   node --env-file=.env.local scripts/superinvestor-phase2a-metrics.mjs
 *   PROFILE_BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/superinvestor-phase2a-metrics.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

const SLUGS = [
  { slug: "ken-fisher", cik: "0000850529", name: "Ken Fisher" },
  { slug: "ray-dalio", cik: "0001350694", name: "Ray Dalio" },
  { slug: "ken-griffin", cik: "0001423053", name: "Citadel" },
  { slug: "blackrock", cik: "0002012383", name: "BlackRock" },
  { slug: "renaissance-technologies", cik: "0001037389", name: "Renaissance" },
];

const BASE = process.env.PROFILE_BASE_URL || "https://app.finsepa.com";

function byteSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}

async function profileTxApi(slug, pass = 1) {
  const url = `${BASE}/api/superinvestors/${slug}/transactions`;
  const started = performance.now();
  const res = await fetch(url, { credentials: "include" });
  const elapsedMs = performance.now() - started;
  const text = await res.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  const headers = {
    cache: res.headers.get("x-superinvestor-tx-cache"),
    totalMs: res.headers.get("x-superinvestor-tx-ms"),
    readMs: res.headers.get("x-superinvestor-tx-read-ms"),
    buildMs: res.headers.get("x-superinvestor-tx-build-ms"),
    payloadBytes: res.headers.get("x-superinvestor-tx-payload-bytes"),
  };
  const bytes = payload ? byteSize(payload) : text.length;
  const txFlat = payload?.quarters?.flatMap((q) => q.transactions ?? []) ?? [];
  return {
    pass,
    slug,
    status: res.status,
    elapsedMs: Math.round(elapsedMs),
    bytes,
    gzipBytes: payload ? gzipSync(Buffer.from(JSON.stringify(payload))).length : null,
    txRows: txFlat.length,
    quarters: payload?.quarters?.length ?? 0,
    headers,
  };
}

async function profileSnapshot(supabase, cik) {
  const keys = {
    profile: `superinvestor_13f_profile_v3_${cik}`,
    fullTx: `superinvestor_13f_transactions_full_v3_${cik}`,
  };
  const out = {};

  for (const [label, key] of Object.entries(keys)) {
    const t0 = performance.now();
    const { data, error } = await supabase
      .from("market_snapshot")
      .select("key, segment, updated_at, data")
      .eq("key", key)
      .maybeSingle();
    const readMs = performance.now() - t0;
    if (error || !data) {
      out[label] = { exists: false, readMs: Math.round(readMs) };
      continue;
    }
    const raw = data.data;
    const bytes = byteSize(raw);
    const parseStart = performance.now();
    JSON.parse(JSON.stringify(raw));
    const parseMs = performance.now() - parseStart;
    out[label] = {
      exists: true,
      segment: data.segment,
      updatedAt: data.updated_at,
      bytes,
      gzipBytes: gzipSync(Buffer.from(JSON.stringify(raw))).length,
      readMs: Math.round(readMs),
      parseMs: Math.round(parseMs),
      comparisonRows: raw?.comparison?.rows?.length ?? null,
      txQuarters: raw?.quarters?.length ?? null,
    };
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && key ? createClient(url, key) : null;

  console.log(`Phase 2A metrics — base ${BASE}\n`);

  const results = [];

  for (const { slug, cik, name } of SLUGS) {
    console.log(`=== ${name} (${slug}) ===`);
    const snap = supabase ? await profileSnapshot(supabase, cik) : { db: "skipped" };

    const warm1 = await profileTxApi(slug, 1);
    const warm2 = await profileTxApi(slug, 2);

    const row = { name, slug, cik, snapshots: snap, warm1, warm2 };
    results.push(row);

    console.log(
      JSON.stringify(
        {
          fullTxSnapshot: snap.fullTx,
          txApiPass1: warm1,
          txApiPass2: warm2,
        },
        null,
        2,
      ),
    );
    console.log("");
  }

  console.log("=== SUMMARY ===");
  for (const r of results) {
    console.log(
      `${r.name.padEnd(14)} | tx pass1 ${r.warm1.elapsedMs}ms ${(r.warm1.bytes / 1e6).toFixed(2)}MB | pass2 ${r.warm2.elapsedMs}ms ${(r.warm2.bytes / 1e6).toFixed(2)}MB | cache ${r.warm2.headers.cache ?? "?"}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
