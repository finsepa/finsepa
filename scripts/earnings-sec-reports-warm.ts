/**
 * Persist HIGH SEC Reports for eligible US 10-Q/10-K issuers.
 * Does not touch the IR vault / Slides. Does not warm FPIs or ADRs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/earnings-sec-reports-warm.ts --eligible-us --limit=500
 *   npx tsx --env-file=.env.local scripts/earnings-sec-reports-warm.ts --eligible-us --limit=2000 --resume
 *   npx tsx --env-file=.env.local scripts/earnings-sec-reports-warm.ts --tickers=AAPL,COST
 */
import { createRequire } from "node:module";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

const DEFAULT_TICKERS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "JPM", "V",
  "MA", "WMT", "COST", "HD", "KO", "PEP", "CAT", "GE", "XOM", "CVX",
  "JNJ", "LLY", "UNH", "ADBE", "CRM",
];

const DEFAULT_PROGRESS = path.join("/tmp", "finsepa-sec-reports-warm.ndjson");

function argValue(flag: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return arg ? arg.slice(flag.length + 1) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseTickersFlag(): string[] | null {
  const raw = argValue("--tickers");
  if (!raw) return null;
  return raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

function accessionFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(\d{10,})\/[^/]+$/);
  return m?.[1] ?? url;
}

function readDoneTickers(progressPath: string): Set<string> {
  const done = new Set<string>();
  if (!existsSync(progressPath)) return done;
  const text = readFileSync(progressPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const row = JSON.parse(t) as { ticker?: string; ok?: boolean };
      if (typeof row.ticker === "string" && row.ok !== false) done.add(row.ticker.toUpperCase());
    } catch {
      /* skip */
    }
  }
  return done;
}

async function main() {
  const { warmStockEarningsDocumentCacheWithHistory, fetchStockEarningsTabPayload } = await import(
    "../lib/market/stock-earnings-tab-data.ts"
  );
  const { listSecEarningsReportsUniverse } = await import("../lib/market/sec-earnings-reports-universe.ts");
  const { resetSecFetchCounters, getSecFetchCounters } = await import(
    "../lib/market/sec-edgar-earnings-documents.ts"
  );
  const { isEarningsFilingsPreviewUrl } = await import("../lib/market/earnings-document-url.ts");

  const eligibleUs = hasFlag("--eligible-us");
  const resume = hasFlag("--resume");
  const limit = Math.max(1, Number.parseInt(argValue("--limit") ?? (eligibleUs ? "500" : "0"), 10) || (eligibleUs ? 500 : 0));
  const progressPath = argValue("--progress") ?? DEFAULT_PROGRESS;
  const previewCheck = argValue("--preview-check");

  const tickersFlag = parseTickersFlag();
  let tickers: string[];
  let universeMeta: { scanned?: number; skipped?: number } = {};
  if (tickersFlag) {
    tickers = tickersFlag;
  } else if (eligibleUs) {
    const listed = await listSecEarningsReportsUniverse(limit);
    tickers = listed.tickers;
    universeMeta = { scanned: listed.scanned, skipped: listed.skipped };
  } else {
    tickers = DEFAULT_TICKERS;
  }

  const done = resume ? readDoneTickers(progressPath) : new Set<string>();
  const listOnly = hasFlag("--list-only");
  if (!resume && eligibleUs && !listOnly) {
    writeFileSync(progressPath, "");
  }
  const skippedInUniverse = tickers.filter((t) => done.has(t)).length;

  console.log(
    JSON.stringify({
      mode: eligibleUs ? "eligible-us" : tickersFlag ? "tickers" : "default-25",
      universe: tickers.length,
      ...universeMeta,
      resume,
      alreadyDone: done.size,
      skippedInUniverse,
      remaining: tickers.length - skippedInUniverse,
      progressPath,
      tickers: tickers.join(","),
    }),
  );

  if (listOnly) {
    return;
  }

  const startedAll = Date.now();
  let reported = 0;
  let eightHigh = 0;
  let form10High = 0;
  let both = 0;
  let one = 0;
  let neither = 0;
  let duplicateAccessions = 0;
  let secHttp = 0;
  let secChunks = 0;
  let failures = 0;
  let processed = 0;
  let cacheWrites = 0;
  const wrong: { ticker: string; fiscal: string; reason: string; url: string }[] = [];
  const partial: string[] = [];

  for (const ticker of tickers) {
    if (done.has(ticker)) continue;
    const started = Date.now();
    resetSecFetchCounters();
    try {
      const { stats, history } = await warmStockEarningsDocumentCacheWithHistory(ticker);
      const counters = getSecFetchCounters();
      secHttp += counters.http;
      secChunks += counters.submissionsFileChunks;
      processed += 1;
      cacheWrites += 1;

      const rows = history.filter((r) => r.reported);
      const accSeen = new Map<string, string>();
      let tEight = 0;
      let tForm = 0;
      let tBoth = 0;
      let tOne = 0;
      let tNeither = 0;
      for (const row of rows) {
        reported += 1;
        const eight = isEarningsFilingsPreviewUrl(row.eightKUrl);
        const form10 = isEarningsFilingsPreviewUrl(row.form10Url);
        if (eight) tEight += 1;
        if (form10) tForm += 1;
        if (eight && form10) tBoth += 1;
        else if (eight || form10) tOne += 1;
        else tNeither += 1;
        for (const url of [row.eightKUrl, row.form10Url]) {
          const acc = accessionFromUrl(url);
          if (!acc || !url) continue;
          const prev = accSeen.get(acc);
          const fiscal = row.fiscalPeriodEndYmd ?? "?";
          if (prev && prev !== fiscal) {
            duplicateAccessions += 1;
            wrong.push({ ticker, fiscal, reason: `duplicate accession vs ${prev}`, url });
          } else {
            accSeen.set(acc, fiscal);
          }
        }
      }
      eightHigh += tEight;
      form10High += tForm;
      both += tBoth;
      one += tOne;
      neither += tNeither;
      if (tEight < rows.length || tForm < rows.length) partial.push(ticker);

      const line = JSON.stringify({
        ticker,
        ok: true,
        reported: rows.length,
        eightK: `${tEight}/${rows.length}`,
        form10: `${tForm}/${rows.length}`,
        both: `${tBoth}/${rows.length}`,
        secHttp: counters.http,
        fileChunks: counters.submissionsFileChunks,
        slides: stats.withSlides,
        ms: Date.now() - started,
      });
      console.log(line);
      appendFileSync(progressPath, `${line}\n`);
    } catch (e) {
      failures += 1;
      const message = e instanceof Error ? e.message : String(e);
      const line = JSON.stringify({ ticker, ok: false, error: message, ms: Date.now() - started });
      console.error(line);
      appendFileSync(progressPath, `${line}\n`);
    }
  }

  const pct = (n: number) => (reported ? +(100 * n / reported).toFixed(1) : 0);
  const summary = {
    companies: tickers.length,
    processed,
    skippedResume: skippedInUniverse,
    failures,
    reported,
    eightKHigh: pct(eightHigh),
    form10High: pct(form10High),
    bothHigh: pct(both),
    oneReport: pct(one),
    neither: pct(neither),
    ambiguous: 0,
    wrongDuplicateAccessions: duplicateAccessions,
    eightN: eightHigh,
    form10N: form10High,
    bothN: both,
    oneN: one,
    neitherN: neither,
    secHttp,
    secFileChunks: secChunks,
    avgSecHttp: processed ? +(secHttp / processed).toFixed(1) : 0,
    cacheWriteTickers: cacheWrites,
    elapsedMs: Date.now() - startedAll,
    partialEightKOrForm10: partial,
    wrong,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (previewCheck) {
    const { getSecFetchCounters: countersNow, resetSecFetchCounters: resetNow } = await import(
      "../lib/market/sec-edgar-earnings-documents.ts"
    );
    resetNow();
    const payload = await fetchStockEarningsTabPayload(previewCheck.toUpperCase(), { preview: true });
    const after = countersNow();
    console.log(
      JSON.stringify({
        previewCheck: previewCheck.toUpperCase(),
        reported: (payload?.history ?? []).filter((r) => r.reported).length,
        withEightK: (payload?.history ?? []).filter((r) => r.eightKUrl).length,
        withForm10: (payload?.history ?? []).filter((r) => r.form10Url).length,
        secHttp: after.http,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
