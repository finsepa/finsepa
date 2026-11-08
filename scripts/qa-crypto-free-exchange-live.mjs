/**
 * One-shot QA: free-exchange header sources + recent minute bars for the curated gap.
 * Usage: node --env-file=.env.local scripts/qa-crypto-free-exchange-live.mjs
 */
import { createClient } from "@supabase/supabase-js";

const symbols = ["BTC", "MKR", "XMR", "TON", "MNT", "KAS", "LRC", "CRO", "FLR", "HNT", "LEO", "EOS"];

async function fetchBinance(base) {
  const pairBase = { MKR: "SKY", RNDR: "RENDER", FTM: "S" }[base] ?? base;
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pairBase}USDT`);
  if (!res.ok) return null;
  const j = await res.json();
  const price = Number(j.price);
  return Number.isFinite(price) && price > 0 ? { source: "binance", price } : null;
}

async function fetchKraken(base) {
  const rest = {
    XMR: "XMRUSD",
    TON: "TONUSD",
    MNT: "MNTUSD",
    KAS: "KASUSD",
    LRC: "LRCUSD",
    CRO: "CROUSD",
    FLR: "FLRUSD",
    HNT: "HNTUSD",
  }[base];
  if (!rest) return null;
  const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${rest}`);
  if (!res.ok) return null;
  const j = await res.json();
  const row = j.result?.[rest] ?? Object.values(j.result ?? {})[0];
  const price = Number(row?.c?.[0]);
  return Number.isFinite(price) && price > 0 ? { source: "kraken", price } : null;
}

async function fetchOkx(base) {
  if (base !== "LEO") return null;
  const res = await fetch("https://www.okx.com/api/v5/market/ticker?instId=LEO-USDT", {
    headers: { "User-Agent": "Finsepa/1.0" },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const price = Number(j.data?.[0]?.last);
  return Number.isFinite(price) && price > 0 ? { source: "okx", price } : null;
}

async function expectHeader(base) {
  if (["BTC", "MKR"].includes(base)) return fetchBinance(base);
  if (base === "LEO") return fetchOkx(base);
  if (base === "EOS") return { source: "eodhd-fallback", price: null };
  return fetchKraken(base);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("=== header REST (expected free exchange) ===");
for (const s of symbols) {
  const spot = await expectHeader(s);
  console.log(s.padEnd(4), spot ? `${spot.source.padEnd(16)} ${spot.price ?? "-"}` : "NULL");
}

console.log("\n=== latest minute bars ===");
const nowSec = Math.floor(Date.now() / 1000);
for (const s of symbols) {
  const { data, error } = await supabase
    .from("crypto_session_minute_bar")
    .select("ticker,bucket_unix,close,updated_at")
    .eq("ticker", s)
    .order("bucket_unix", { ascending: false })
    .limit(1);
  if (error) {
    console.log(s.padEnd(4), "ERR", error.message);
    continue;
  }
  const row = data?.[0];
  if (!row) {
    console.log(s.padEnd(4), "NO_BAR");
    continue;
  }
  const age = nowSec - row.bucket_unix;
  console.log(
    s.padEnd(4),
    `close=${row.close}`.padEnd(22),
    `ageSec=${age}`.padEnd(12),
    row.updated_at,
  );
}

try {
  const health = await (await fetch("http://127.0.0.1:18080/health")).json();
  console.log("\n=== ingest health ===");
  console.log({
    binanceConnected: health.binanceConnected,
    krakenConnected: health.krakenConnected,
    okxConnected: health.okxConnected,
    eodhdPairs: health.pairs,
    lastTradeSource: health.lastTradeSource,
    lastTradeAt: health.lastTradeAt,
  });
} catch (e) {
  console.log("\n=== ingest health === unavailable", e.message);
}
