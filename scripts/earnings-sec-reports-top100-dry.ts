/**
 * Top-100 SEC Reports matcher dry run. Does not persist cache. Does not backfill ~2,000.
 *
 * Usage: npx tsx --env-file=.env.local scripts/earnings-sec-reports-top100-dry.ts
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

function accessionFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(\d{10,})\/[^/]+$/);
  return m?.[1] ?? url;
}

async function main() {
  const { listEarningsIrVaultUniverse } = await import("../lib/market/earnings-ir-vault-universe.ts");
  const { fetchStockEarningsSecReportsDry } = await import("../lib/market/stock-earnings-tab-data.ts");
  const { resetSecFetchCounters, getSecFetchCounters } = await import(
    "../lib/market/sec-edgar-earnings-documents.ts"
  );
  const { isEarningsFilingsPreviewUrl } = await import("../lib/market/earnings-document-url.ts");

  const tickers = await listEarningsIrVaultUniverse(100);
  console.log(JSON.stringify({ universe: tickers.length, tickers: tickers.join(",") }));

  const startedAll = Date.now();
  let reported = 0;
  let eightHigh = 0;
  let form10High = 0;
  let both = 0;
  let one = 0;
  let neither = 0;
  let duplicateAccessions = 0;
  const perTicker: Record<string, unknown>[] = [];
  const wrong: { ticker: string; fiscal: string; reason: string; url: string }[] = [];
  let secHttp = 0;
  let secChunks = 0;
  let failures = 0;

  for (const ticker of tickers) {
    const started = Date.now();
    resetSecFetchCounters();
    try {
      const payload = await fetchStockEarningsSecReportsDry(ticker);
      const counters = getSecFetchCounters();
      secHttp += counters.http;
      secChunks += counters.submissionsFileChunks;
      const rows = (payload?.history ?? []).filter((r) => r.reported);
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
            wrong.push({
              ticker,
              fiscal,
              reason: `duplicate accession vs ${prev}`,
              url,
            });
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
      perTicker.push({
        ticker,
        reported: rows.length,
        eightK: tEight,
        form10: tForm,
        both: tBoth,
        one: tOne,
        neither: tNeither,
        secHttp: counters.http,
        fileChunks: counters.submissionsFileChunks,
        ms: Date.now() - started,
      });
      console.log(
        JSON.stringify({
          ticker,
          reported: rows.length,
          eightK: `${tEight}/${rows.length}`,
          form10: `${tForm}/${rows.length}`,
          both: `${tBoth}/${rows.length}`,
          secHttp: counters.http,
          fileChunks: counters.submissionsFileChunks,
          ms: Date.now() - started,
        }),
      );
    } catch (e) {
      failures += 1;
      const message = e instanceof Error ? e.message : String(e);
      perTicker.push({ ticker, error: message, ms: Date.now() - started });
      console.error(JSON.stringify({ ticker, error: message }));
    }
  }

  const pct = (n: number) => (reported ? +(100 * n / reported).toFixed(1) : 0);
  console.log(
    JSON.stringify(
      {
        companies: tickers.length,
        ok: tickers.length - failures,
        failures,
        reported,
        eightKHigh: pct(eightHigh),
        form10High: pct(form10High),
        bothHigh: pct(both),
        oneReport: pct(one),
        neither: pct(neither),
        ambiguous: 0,
        missingEightK: pct(reported - eightHigh),
        missingForm10: pct(reported - form10High),
        wrongDuplicateAccessions: duplicateAccessions,
        eightN: eightHigh,
        form10N: form10High,
        bothN: both,
        oneN: one,
        neitherN: neither,
        secHttp,
        secFileChunks: secChunks,
        avgSecHttp: tickers.length ? +(secHttp / tickers.length).toFixed(1) : 0,
        elapsedMs: Date.now() - startedAll,
        wrong,
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
