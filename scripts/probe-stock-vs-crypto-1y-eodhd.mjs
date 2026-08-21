/**
 * Evidence-only: direct EODHD provider timing for stock vs crypto 1Y sources.
 * No Next imports.
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

function loadEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();
const key = process.env.EODHD_API_KEY || process.env.EODHD_TOKEN;
if (!key) {
  console.error("Missing EODHD_API_KEY");
  process.exit(1);
}

function ymd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  const ms = performance.now() - t0;
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return {
    status: res.status,
    ms: Math.round(ms),
    bytes: Buffer.byteLength(text),
    count: Array.isArray(data) ? data.length : null,
    parseOk: Array.isArray(data),
  };
}

async function main() {
  const now = new Date();
  const to = ymd(now);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  const from = ymd(fromDate);
  const nowSec = Math.floor(now.getTime() / 1000);
  const oneYearStart = nowSec - 365 * 86400;
  const intraFrom = oneYearStart - 14 * 86400;

  const results = [];

  // Stock 1Y production primary source: 1h intraday ~379d
  for (const ticker of ["AAPL", "MSFT"]) {
    const url = `https://eodhd.com/api/intraday/${ticker}?api_token=${key}&fmt=json&interval=1h&from=${intraFrom}&to=${nowSec}`;
    const r = await fetchJson(url);
    results.push({
      asset: ticker,
      kind: "stock",
      provider: "eodhd-intraday-1h (~379d lookback)",
      ...r,
      note: "Production stock 1Y prefers this, then downsamples to ~2 pts/day",
    });
  }

  // Stock 1Y fallback: daily EOD
  for (const ticker of ["AAPL.US", "MSFT.US"]) {
    const url = `https://eodhd.com/api/eod/${ticker}?api_token=${key}&fmt=json&period=d&order=a&from=${from}&to=${to}`;
    const r = await fetchJson(url);
    results.push({
      asset: ticker.replace(".US", ""),
      kind: "stock-fallback",
      provider: "eodhd-eod-daily-1Y",
      ...r,
    });
  }

  // Crypto 1Y production: daily EOD only
  for (const pair of [
    { asset: "BTC", sym: "BTC-USD.CC" },
    { asset: "SOL", sym: "SOL-USD.CC" },
  ]) {
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(pair.sym)}?api_token=${key}&fmt=json&period=d&order=a&from=${from}&to=${to}`;
    const r = await fetchJson(url);
    results.push({
      asset: pair.asset,
      kind: "crypto",
      provider: `eodhd-eod-daily-1Y (${pair.sym})`,
      ...r,
      note: "Production crypto 1Y uses this path only (no intraday for 1Y)",
    });
  }

  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), from, to, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
