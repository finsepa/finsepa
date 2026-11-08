#!/usr/bin/env node
/**
 * Always-on crypto WebSocket → Supabase 1m bars for the live crypto 1D chart.
 *
 * - Default: EODHD `/ws/crypto` for the allowlisted pairs.
 * - Hybrid free exchanges (excluded from EODHD):
 *   - `CRYPTO_BINANCE_BASES` ↔ `CRYPTO_BINANCE_LIVE_DEFAULT_BASES` (USDT trades)
 *   - `CRYPTO_KRAKEN_BASES` ↔ `CRYPTO_KRAKEN_LIVE_DEFAULT_BASES` (USD trades)
 *   - `CRYPTO_OKX_BASES` ↔ `CRYPTO_OKX_LIVE_DEFAULT_BASES` (USDT trades, e.g. LEO)
 * - Coalesces one close per UTC minute bucket → `crypto_session_minute_bar`.
 * - Heartbeat ~60s from last price while trades stay fresh.
 * - `/health` for Railway.
 *
 * Under Supabase 522 / timeouts: exponential backoff before retry (no immediate re-flush storm).
 */

import dns from "node:dns";
import http from "node:http";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import {
  resolveFlushDebounceMs,
  setPendingMinuteClose,
} from "./crypto-minute-ingest-core.mjs";

dns.setDefaultResultOrder("ipv4first");

/** `BTC-USD` | `BTC-USD.CC` → `BTC` (base symbol we store). */
function baseSymbolFromPair(pair) {
  const up = String(pair ?? "").trim().toUpperCase();
  if (!up) return null;
  const base = up.replace(/\.(CC|US)$/i, "").split("-")[0];
  return base && /^[A-Z0-9]{1,12}$/.test(base) ? base : null;
}

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();

/** Full pair list before Binance carve-out (WS symbol form, e.g. BTC-USD). */
const ALL_WS_PAIRS = (process.env.CRYPTO_WS_PAIRS ??
  "0G-USD,1000CAT-USD,1000CHEEMS-USD,1000SATS-USD,1INCH-USD,1MBABYDOGE-USD,2Z-USD,A-USD,AAOIB-USD,AAPLB-USD,AAVE-USD,ACE-USD,ACH-USD,ACM-USD,ACT-USD,ADA-USD,ADBEB-USD,ADX-USD,AERO-USD,AEVO-USD,AGLD-USD,AGPUB-USD,AI-USD,AIGENSYN-USD,AIXBT-USD,ALABB-USD,ALGO-USD,ALICE-USD,ALLO-USD,ALPINE-USD,ALT-USD,AMATB-USD,AMCB-USD,AMDB-USD,AMP-USD,AMZNB-USD,ANIME-USD,ANKR-USD,APE-USD,API3-USD,APPB-USD,APT-USD,AR-USD,ARB-USD,ARK-USD,ARKM-USD,ARMB-USD,ARPA-USD,ASMLB-USD,ASR-USD,ASTER-USD,ASTR-USD,ASTSB-USD,AT-USD,ATM-USD,ATOM-USD,AUCTION-USD,AUDIO-USD,AVA-USD,AVAX-USD,AVGOB-USD,AVNT-USD,AWE-USD,AXL-USD,AXS-USD,AXTIB-USD,BABAB-USD,BABY-USD,BANANA-USD,BANANAS31-USD,BAND-USD,BANK-USD,BAR-USD,BARD-USD,BAT-USD,BB-USD,BBB-USD,BCH-USD,BEAMX-USD,BEB-USD,BEL-USD,BERA-USD,BICO-USD,BIGTIME-USD,BIO-USD,BLUR-USD,BMNRB-USD,BMT-USD,BNB-USD,BNCB-USD,BNSOL-USD,BNT-USD,BOME-USD,BONK-USD,BOTB-USD,BREV-USD,BRKBB-USD,BROCCOLI714-USD,BSPB-USD,BTC-USD,BTTC-USD,C-USD,C98-USD,CAKE-USD,CATI-USD,CBRSB-USD,CELO-USD,CELR-USD,CETUS-USD,CFG-USD,CFX-USD,CGPT-USD,CHIP-USD,CHR-USD,CHZ-USD,CITY-USD,CKB-USD,COHRB-USD,COINB-USD,COMP-USD,COOKIE-USD,COTI-USD,COW-USD,CRCLB-USD,CRDOB-USD,CRMB-USD,CRV-USD,CRWDB-USD,CRWVB-USD,CTK-USD,CTSI-USD,CVC-USD,CVX-USD,CYBER-USD,CYPHB-USD,DASH-USD,DCR-USD,DELLB-USD,DEXE-USD,DGB-USD,DIA-USD,DJTB-USD,DODO-USD,DOGE-USD,DOGS-USD,DOLO-USD,DOT-USD,DRAMB-USD,DUSK-USD,DYDX-USD,DYM-USD,EDEN-USD,EDU-USD,EGLD-USD,EIGEN-USD,ENA-USD,ENJ-USD,ENS-USD,ENSO-USD,ERA-USD,ESP-USD,ETC-USD,ETH-USD,ETHFI-USD,EUL-USD,EWYB-USD,F-USD,FET-USD,FF-USD,FIDA-USD,FIL-USD,FLNCB-USD,FLOKI-USD,FLOW-USD,FLUX-USD,FOGO-USD,FORM-USD,FRAX-USD,FTT-USD,FWDIB-USD,G-USD,GALA-USD,GAS-USD,GENIUS-USD,GEVB-USD,GIGGLE-USD,GLM-USD,GLMR-USD,GLWB-USD,GMEB-USD,GMT-USD,GMX-USD,GNO-USD,GNS-USD,GOOGLB-USD,GPROB-USD,GPS-USD,GRAM-USD,GRT-USD,GSB-USD,GTC-USD,GUN-USD,HAEDAL-USD,HBAR-USD,HEI-USD,HEMI-USD,HIMSB-USD,HIVE-USD,HMSTR-USD,HOLO-USD,HOME-USD,HOODB-USD,HOT-USD,HPEB-USD,HUMA-USD,HYPE-USD,HYPER-USD,IBMB-USD,ICP-USD,ID-USD,ILV-USD,IMX-USD,INIT-USD,INJ-USD,INTCB-USD,INTWB-USD,IO-USD,IOST-USD,IOTA-USD,IOTX-USD,IQ-USD,IRENB-USD,JASMY-USD,JOE-USD,JPMB-USD,JST-USD,JTO-USD,JUP-USD,JUV-USD,KAIA-USD,KAITO-USD,KAT-USD,KAVA-USD,KERNEL-USD,KGST-USD,KITE-USD,KMNO-USD,KNC-USD,KORUB-USD,KSM-USD,KSTRB-USD,LA-USD,LAYER-USD,LAZIO-USD,LDO-USD,LINEA-USD,LINK-USD,LISTA-USD,LITEB-USD,LLYB-USD,LPT-USD,LQTY-USD,LSK-USD,LTC-USD,LUMIA-USD,LUNA-USD,LUNC-USD,MAGIC-USD,MANA-USD,MANTA-USD,MANTRA-USD,MARSCOIN-USD,MASK-USD,MAV-USD,MBL-USD,MDBB-USD,ME-USD,MEGA-USD,MEME-USD,MET-USD,METAB-USD,METIS-USD,MINA-USD,MIRA-USD,MITO-USD,MMT-USD,MORPHO-USD,MOVE-USD,MOVR-USD,MRNAB-USD,MRVLB-USD,MSFTB-USD,MSTRB-USD,MTL-USD,MUB-USD,MUBARAK-USD,MUUB-USD,MVLLB-USD,NBISB-USD,NEAR-USD,NEIRO-USD,NEO-USD,NEWT-USD,NEXO-USD,NFLXB-USD,NIGHT-USD,NIL-USD,NMR-USD,NOKB-USD,NOM-USD,NOT-USD,NVDAB-USD,NXPC-USD,OG-USD,OGN-USD,ONDO-USD,ONE-USD,ONG-USD,ONT-USD,OP-USD,OPEN-USD,OPG-USD,OPN-USD,ORCA-USD,ORCLB-USD,ORDI-USD,OSMO-USD,PARTI-USD,PAXG-USD,PDDB-USD,PENDLE-USD,PENGB-USD,PENGU-USD,PEOPLE-USD,PEPE-USD,PHA-USD,PIXEL-USD,PLTRB-USD,PLUME-USD,PNUT-USD,POL-USD,POLYX-USD,PORTAL-USD,PORTO-USD,POWR-USD,PROM-USD,PROVE-USD,PSG-USD,PUMP-USD,PUNDIX-USD,PYPLB-USD,PYTH-USD,QCOMB-USD,QI-USD,QKC-USD,QNT-USD,QNTB-USD,QQQB-USD,QTUM-USD,RAD-USD,RARE-USD,RAY-USD,RDDTB-USD,RE-USD,RED-USD,RENDER-USD,REQ-USD,RESOLV-USD,REZ-USD,RIF-USD,RKLBB-USD,RLC-USD,RLUSD-USD,ROBO-USD,RONIN-USD,ROSE-USD,RPL-USD,RSR-USD,RUNE-USD,RVN-USD,RWUSD-USD,S-USD,SAGA-USD,SAHARA-USD,SAND-USD,SANTOS-USD,SAPIEN-USD,SC-USD,SCR-USD,SECZB-USD,SEI-USD,SENT-USD,SFP-USD,SHAZB-USD,SHELL-USD,SHIB-USD,SIGN-USD,SKDDB-USD,SKHYB-USD,SKL-USD,SKUUB-USD,SKY-USD,SLP-USD,SMCIB-USD,SMHB-USD,SNDKB-USD,SNX-USD,SNXXB-USD,SOL-USD,SOLV-USD,SOMI-USD,SOPH-USD,SOXLB-USD,SOXSB-USD,SPCXB-USD,SPELL-USD,SPK-USD,SPYB-USD,SQQQB-USD,SSV-USD,STEEM-USD,STO-USD,STRAX-USD,STRK-USD,STX-USD,STXB-USD,SUI-USD,SUN-USD,SUPER-USD,SUSHI-USD,SXT-USD,SYN-USD,SYRUP-USD,T-USD,TAO-USD,TFUEL-USD,THE-USD,THETA-USD,TIA-USD,TKO-USD,TLM-USD,TMFB-USD,TNSR-USD,TOWNS-USD,TQQQB-USD,TRB-USD,TREE-USD,TRUMP-USD,TRX-USD,TSLAB-USD,TSMB-USD,TST-USD,TURBO-USD,TURTLE-USD,TUT-USD,TWT-USD,U-USD,UMA-USD,UNI-USD,USARB-USD,USDEB-USD,USDS-USD,USTC-USD,USUAL-USD,UVXYB-USD,VANA-USD,VET-USD,VIRTUAL-USD,VSTB-USD,VTHO-USD,W-USD,WAL-USD,WAXP-USD,WBETH-USD,WBTC-USD,WCT-USD,WDCB-USD,WENB-USD,WIF-USD,WIN-USD,WLD-USD,WLFI-USD,WOO-USD,XAI-USD,XAUT-USD,XEC-USD,XLM-USD,XNO-USD,XPL-USD,XRP-USD,XTZ-USD,XUSD-USD,XVG-USD,XVS-USD,YB-USD,YFI-USD,YGG-USD,ZAMA-USD,ZBT-USD,ZEC-USD,ZEN-USD,ZIL-USD,ZK-USD,ZKC-USD,ZKP-USD,ZMB-USD,ZRO-USD,ZRX-USD,币安人生-USD,牛来-USD,RNDR-USD,FTM-USD,XMR-USD,LEO-USD,TON-USD,MKR-USD,MNT-USD,EOS-USD,KAS-USD,LRC-USD,CRO-USD,FLR-USD,HNT-USD")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

/**
 * Bases ingested from Binance USDT trades instead of EODHD.
 * Default matches app `CRYPTO_BINANCE_LIVE_DEFAULT_BASES`. Set `CRYPTO_BINANCE_BASES=` (empty)
 * to disable Binance.
 */
const BINANCE_BASES = (process.env.CRYPTO_BINANCE_BASES ??
  "0G,1000CAT,1000CHEEMS,1000SATS,1INCH,1MBABYDOGE,2Z,A,AAOIB,AAPLB,AAVE,ACE,ACH,ACM,ACT,ADA,ADBEB,ADX,AERO,AEVO,AGLD,AGPUB,AI,AIGENSYN,AIXBT,ALABB,ALGO,ALICE,ALLO,ALPINE,ALT,AMATB,AMCB,AMDB,AMP,AMZNB,ANIME,ANKR,APE,API3,APPB,APT,AR,ARB,ARK,ARKM,ARMB,ARPA,ASMLB,ASR,ASTER,ASTR,ASTSB,AT,ATM,ATOM,AUCTION,AUDIO,AVA,AVAX,AVGOB,AVNT,AWE,AXL,AXS,AXTIB,BABAB,BABY,BANANA,BANANAS31,BAND,BANK,BAR,BARD,BAT,BB,BBB,BCH,BEAMX,BEB,BEL,BERA,BICO,BIGTIME,BIO,BLUR,BMNRB,BMT,BNB,BNCB,BNSOL,BNT,BOME,BONK,BOTB,BREV,BRKBB,BROCCOLI714,BSPB,BTC,BTTC,C,C98,CAKE,CATI,CBRSB,CELO,CELR,CETUS,CFG,CFX,CGPT,CHIP,CHR,CHZ,CITY,CKB,COHRB,COINB,COMP,COOKIE,COTI,COW,CRCLB,CRDOB,CRMB,CRV,CRWDB,CRWVB,CTK,CTSI,CVC,CVX,CYBER,CYPHB,DASH,DCR,DELLB,DEXE,DGB,DIA,DJTB,DODO,DOGE,DOGS,DOLO,DOT,DRAMB,DUSK,DYDX,DYM,EDEN,EDU,EGLD,EIGEN,ENA,ENJ,ENS,ENSO,ERA,ESP,ETC,ETH,ETHFI,EUL,EWYB,F,FET,FF,FIDA,FIL,FLNCB,FLOKI,FLOW,FLUX,FOGO,FORM,FRAX,FTT,FWDIB,G,GALA,GAS,GENIUS,GEVB,GIGGLE,GLM,GLMR,GLWB,GMEB,GMT,GMX,GNO,GNS,GOOGLB,GPROB,GPS,GRAM,GRT,GSB,GTC,GUN,HAEDAL,HBAR,HEI,HEMI,HIMSB,HIVE,HMSTR,HOLO,HOME,HOODB,HOT,HPEB,HUMA,HYPE,HYPER,IBMB,ICP,ID,ILV,IMX,INIT,INJ,INTCB,INTWB,IO,IOST,IOTA,IOTX,IQ,IRENB,JASMY,JOE,JPMB,JST,JTO,JUP,JUV,KAIA,KAITO,KAT,KAVA,KERNEL,KGST,KITE,KMNO,KNC,KORUB,KSM,KSTRB,LA,LAYER,LAZIO,LDO,LINEA,LINK,LISTA,LITEB,LLYB,LPT,LQTY,LSK,LTC,LUMIA,LUNA,LUNC,MAGIC,MANA,MANTA,MANTRA,MARSCOIN,MASK,MAV,MBL,MDBB,ME,MEGA,MEME,MET,METAB,METIS,MINA,MIRA,MITO,MMT,MORPHO,MOVE,MOVR,MRNAB,MRVLB,MSFTB,MSTRB,MTL,MUB,MUBARAK,MUUB,MVLLB,NBISB,NEAR,NEIRO,NEO,NEWT,NEXO,NFLXB,NIGHT,NIL,NMR,NOKB,NOM,NOT,NVDAB,NXPC,OG,OGN,ONDO,ONE,ONG,ONT,OP,OPEN,OPG,OPN,ORCA,ORCLB,ORDI,OSMO,PARTI,PAXG,PDDB,PENDLE,PENGB,PENGU,PEOPLE,PEPE,PHA,PIXEL,PLTRB,PLUME,PNUT,POL,POLYX,PORTAL,PORTO,POWR,PROM,PROVE,PSG,PUMP,PUNDIX,PYPLB,PYTH,QCOMB,QI,QKC,QNT,QNTB,QQQB,QTUM,RAD,RARE,RAY,RDDTB,RE,RED,RENDER,REQ,RESOLV,REZ,RIF,RKLBB,RLC,RLUSD,ROBO,RONIN,ROSE,RPL,RSR,RUNE,RVN,RWUSD,S,SAGA,SAHARA,SAND,SANTOS,SAPIEN,SC,SCR,SECZB,SEI,SENT,SFP,SHAZB,SHELL,SHIB,SIGN,SKDDB,SKHYB,SKL,SKUUB,SKY,SLP,SMCIB,SMHB,SNDKB,SNX,SNXXB,SOL,SOLV,SOMI,SOPH,SOXLB,SOXSB,SPCXB,SPELL,SPK,SPYB,SQQQB,SSV,STEEM,STO,STRAX,STRK,STX,STXB,SUI,SUN,SUPER,SUSHI,SXT,SYN,SYRUP,T,TAO,TFUEL,THE,THETA,TIA,TKO,TLM,TMFB,TNSR,TOWNS,TQQQB,TRB,TREE,TRUMP,TRX,TSLAB,TSMB,TST,TURBO,TURTLE,TUT,TWT,U,UMA,UNI,USARB,USDEB,USDS,USTC,USUAL,UVXYB,VANA,VET,VIRTUAL,VSTB,VTHO,W,WAL,WAXP,WBETH,WBTC,WCT,WDCB,WENB,WIF,WIN,WLD,WLFI,WOO,XAI,XAUT,XEC,XLM,XNO,XPL,XRP,XTZ,XUSD,XVG,XVS,YB,YFI,YGG,ZAMA,ZBT,ZEC,ZEN,ZIL,ZK,ZKC,ZKP,ZMB,ZRO,ZRX,币安人生,牛来")
  .split(",")
  .map((s) => s.trim().toUpperCase().replace(/USDT$/i, "").split("-")[0])
  .filter((s) => /^[A-Z0-9]{1,12}$/.test(s));
const BINANCE_BASE_SET = new Set(BINANCE_BASES);

/** Finsepa storage ticker for Binance stream bases that renamed. */
const BINANCE_STREAM_TO_STORE = { RENDER: "RNDR", S: "FTM", SKY: "MKR" };

/** Kraken USD trade bases — matches app `CRYPTO_KRAKEN_LIVE_DEFAULT_BASES`. */
const KRAKEN_BASES = (process.env.CRYPTO_KRAKEN_BASES ?? "XMR,TON,MNT,KAS,LRC,CRO,FLR,HNT")
  .split(",")
  .map((s) => s.trim().toUpperCase().split("-")[0])
  .filter((s) => /^[A-Z0-9]{1,12}$/.test(s));
const KRAKEN_BASE_SET = new Set(KRAKEN_BASES);
/** Finsepa base → Kraken WS v2 symbol (USD). */
const KRAKEN_WS_SYMBOL_BY_BASE = {
  XMR: "XMR/USD",
  TON: "TON/USD",
  MNT: "MNT/USD",
  KAS: "KAS/USD",
  LRC: "LRC/USD",
  CRO: "CRO/USD",
  FLR: "FLR/USD",
  HNT: "HNT/USD",
};
const KRAKEN_BASE_BY_WS_SYMBOL = Object.fromEntries(
  Object.entries(KRAKEN_WS_SYMBOL_BY_BASE).map(([base, sym]) => [sym, base]),
);

/** OKX USDT trade bases — matches app `CRYPTO_OKX_LIVE_DEFAULT_BASES`. */
const OKX_BASES = (process.env.CRYPTO_OKX_BASES ?? "LEO")
  .split(",")
  .map((s) => s.trim().toUpperCase().split("-")[0])
  .filter((s) => /^[A-Z0-9]{1,12}$/.test(s));
const OKX_BASE_SET = new Set(OKX_BASES);
const OKX_INST_BY_BASE = { LEO: "LEO-USDT" };
const OKX_BASE_BY_INST = Object.fromEntries(
  Object.entries(OKX_INST_BY_BASE).map(([base, inst]) => [inst, base]),
);

/** Bases covered by a free exchange feed (incl. Finsepa alias storage names). */
const FREE_EXCHANGE_COVERED = new Set([
  ...BINANCE_BASES,
  ...Object.values(BINANCE_STREAM_TO_STORE),
  ...KRAKEN_BASES,
  ...OKX_BASES,
]);

const EODHD_WS_PAIRS = ALL_WS_PAIRS.filter((pair) => {
  const base = baseSymbolFromPair(pair);
  return base && !FREE_EXCHANGE_COVERED.has(base);
});

const HEARTBEAT_MS = Number(process.env.CRYPTO_WS_HEARTBEAT_MS ?? 60_000);
/** Default 6s, clamped to at least 5s, to limit same-minute PostgREST rewrites. */
const FLUSH_DEBOUNCE_MS = resolveFlushDebounceMs(
  process.env.CRYPTO_WS_FLUSH_DEBOUNCE_MS,
  (message) => console.warn(new Date().toISOString(), "[crypto-ws]", message),
);
const FLUSH_MAX_ATTEMPTS = Number(process.env.CRYPTO_WS_FLUSH_MAX_ATTEMPTS ?? 5);
const SUPABASE_UPSERT_TIMEOUT_MS = Number(process.env.SUPABASE_UPSERT_TIMEOUT_MS ?? 15_000);
const HEALTH_PORT = Number(process.env.PORT ?? process.env.CRYPTO_WS_HEALTH_PORT ?? 8080);

const health = {
  ok: true,
  authorized: false,
  subscribed: 0,
  pairs: EODHD_WS_PAIRS,
  binanceBases: BINANCE_BASES,
  binanceConnected: false,
  krakenBases: KRAKEN_BASES,
  krakenConnected: false,
  okxBases: OKX_BASES,
  okxConnected: false,
  lastTradeAt: null,
  lastTradeSource: null,
  lastPrice: null,
  lastFlushAt: null,
  pendingUpserts: 0,
  flushBackoffMs: 0,
  startedAt: new Date().toISOString(),
};

function log(...args) {
  console.log(new Date().toISOString(), "[crypto-ws]", ...args);
}
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (EODHD_WS_PAIRS.length && !EODHD_KEY) fail("Missing EODHD_API_KEY");
if (!SUPABASE_URL || !SUPABASE_KEY) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
if (
  !EODHD_WS_PAIRS.length &&
  !BINANCE_BASES.length &&
  !KRAKEN_BASES.length &&
  !OKX_BASES.length
) {
  fail("No crypto pairs configured");
}

function makeSupabaseFetch(timeoutMs) {
  return function supabaseFetch(url, options = {}) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const outerSignal = options.signal;
    if (outerSignal) {
      if (outerSignal.aborted) ac.abort();
      else outerSignal.addEventListener("abort", () => ac.abort(), { once: true });
    }
    const { signal: _ignored, ...rest } = options;
    return fetch(url, { ...rest, signal: ac.signal })
      .catch((err) => {
        const cause = err instanceof Error && "cause" in err ? err.cause : null;
        if (cause) {
          throw new Error(`${err.message} (${String(cause)})`, { cause: err });
        }
        throw err;
      })
      .finally(() => clearTimeout(timer));
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: makeSupabaseFetch(SUPABASE_UPSERT_TIMEOUT_MS) },
});

function resolveTradeSec(rawTs) {
  const nowSec = Math.floor(Date.now() / 1000);
  let t = rawTs;
  if (typeof t === "string" && t.trim()) t = Number(t);
  if (typeof t !== "number" || !Number.isFinite(t)) return nowSec;
  const sec = t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
  // Guard against absurd timestamps — fall back to now.
  if (sec < nowSec - 86_400 || sec > nowSec + 300) return nowSec;
  return sec;
}

function isTransientUpsertFailure(message) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("522") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("abort") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

function flushBackoffMs(attempt) {
  // Cap high so a Supabase outage cannot spin PostgREST.
  return Math.min(60_000, 1_000 * 2 ** attempt);
}

/** @type {Map<string, { ticker: string, bucket_unix: number, close: number, updated_at: string }>} */
const pendingUpserts = new Map();
/** @type {Map<string, number>} last price per base symbol (for heartbeat). */
const lastPriceBySymbol = new Map();
/** @type {Map<string, number>} last real trade unix-sec per base (heartbeat only while fresh). */
const lastRealTradeSecBySymbol = new Map();
/** @type {Map<string, "eodhd" | "binance" | "kraken" | "okx">} */
const sourceBySymbol = new Map();
/** Stop re-stamping the last price when no real WS trade has arrived for this long. */
const HEARTBEAT_STALE_SEC = Number(process.env.CRYPTO_WS_HEARTBEAT_STALE_SEC ?? 3 * 60);
let flushTimer = null;
let flushInProgress = false;
let consecutiveFlushFailures = 0;

function queueMinuteClose(base, tradeSec, price, { fromHeartbeat = false, source = "eodhd" } = {}) {
  if (!base || !Number.isFinite(price) || price <= 0) return;
  lastPriceBySymbol.set(base, price);
  sourceBySymbol.set(base, source);
  if (!fromHeartbeat) {
    lastRealTradeSecBySymbol.set(base, tradeSec);
    health.lastTradeAt = new Date().toISOString();
    health.lastPrice = price;
    health.lastTradeSource = source;
  }
  setPendingMinuteClose(pendingUpserts, base, tradeSec, price, new Date().toISOString());
  health.pendingUpserts = pendingUpserts.size;
  scheduleFlush();
}

function scheduleFlush(delayMs = FLUSH_DEBOUNCE_MS) {
  if (flushTimer || flushInProgress) return;
  const wait = Math.max(delayMs, health.flushBackoffMs || 0);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingUpserts();
  }, wait);
}

async function flushPendingUpserts() {
  if (!pendingUpserts.size || flushInProgress) return;
  flushInProgress = true;
  const rows = Array.from(pendingUpserts.values());
  pendingUpserts.clear();
  health.pendingUpserts = 0;
  let saved = false;
  let lastError = null;

  for (let attempt = 0; attempt < FLUSH_MAX_ATTEMPTS && !saved; attempt++) {
    try {
      const { error } = await supabase
        .from("crypto_session_minute_bar")
        .upsert(rows, { onConflict: "ticker,bucket_unix" });
      if (error) throw new Error(error.message);
      saved = true;
      consecutiveFlushFailures = 0;
      health.flushBackoffMs = 0;
      health.lastFlushAt = new Date().toISOString();
      log("upserted", rows.length, "minute bars");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log("upsert error", lastError, "rows", rows.length, "attempt", attempt + 1);
      if (attempt < FLUSH_MAX_ATTEMPTS - 1) {
        const wait = flushBackoffMs(attempt);
        health.flushBackoffMs = wait;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  if (!saved) {
    consecutiveFlushFailures += 1;
    for (const row of rows) pendingUpserts.set(`${row.ticker}:${row.bucket_unix}`, row);
    const wait = flushBackoffMs(Math.min(consecutiveFlushFailures + 2, 8));
    health.flushBackoffMs = wait;
    log(
      "upsert deferred",
      "failures",
      consecutiveFlushFailures,
      "backoffMs",
      wait,
      "transient",
      isTransientUpsertFailure(lastError),
    );
  }

  flushInProgress = false;
  health.pendingUpserts = pendingUpserts.size;
  if (pendingUpserts.size > 0) {
    scheduleFlush(saved ? FLUSH_DEBOUNCE_MS : health.flushBackoffMs || FLUSH_DEBOUNCE_MS);
  }
}

/** Keep the line continuous during quiet minutes by re-stamping the last price each minute.
 * Skip when no real trade has arrived recently — otherwise a stuck lastPrice flattens the 24h chart. */
function heartbeatTick() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [base, price] of lastPriceBySymbol.entries()) {
    const lastTradeSec = lastRealTradeSecBySymbol.get(base);
    if (lastTradeSec == null || nowSec - lastTradeSec > HEARTBEAT_STALE_SEC) continue;
    queueMinuteClose(base, nowSec, price, {
      fromHeartbeat: true,
      source: sourceBySymbol.get(base) ?? "eodhd",
    });
  }
}

function clearFeedState(source) {
  for (const [base, src] of sourceBySymbol.entries()) {
    if (src !== source) continue;
    lastPriceBySymbol.delete(base);
    lastRealTradeSecBySymbol.delete(base);
    sourceBySymbol.delete(base);
  }
}

function processEodhdWsText(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    if (text.includes("Authorized") || text.includes("status_code")) return "authorized";
    return null;
  }

  if (msg.status_code != null) {
    log("auth status", msg.status_code, msg.message ?? "");
    return msg.status_code === 200 ? "authorized" : "auth-failed";
  }

  const base = baseSymbolFromPair(msg.s);
  if (!base || FREE_EXCHANGE_COVERED.has(base)) return null;
  const price = Number(msg.p);
  if (!Number.isFinite(price) || price <= 0) return null;
  const tradeSec = resolveTradeSec(msg.t);
  queueMinuteClose(base, tradeSec, price, { source: "eodhd" });
  return "trade";
}

let eodhdWs = null;
/** Multiple combined-stream sockets — Binance caps URL/stream count per connection. */
const binanceSockets = [];
const BINANCE_STREAM_CHUNK = 180;

function connectEodhdWs() {
  if (!EODHD_WS_PAIRS.length) {
    log("EODHD skipped — all pairs on free exchanges");
    return;
  }
  const url = `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${encodeURIComponent(EODHD_KEY)}`;
  eodhdWs = new WebSocket(url);

  eodhdWs.on("open", () => log("EODHD websocket connecting…", EODHD_WS_PAIRS.join(",")));

  eodhdWs.on("message", (raw) => {
    const result = processEodhdWsText(raw.toString());
    if (result === "authorized") {
      health.authorized = true;
      eodhdWs.send(JSON.stringify({ action: "subscribe", symbols: EODHD_WS_PAIRS.join(",") }));
      health.subscribed = EODHD_WS_PAIRS.length;
      log("EODHD subscribed", EODHD_WS_PAIRS.join(","));
    }
  });

  eodhdWs.on("close", (code) => {
    log("EODHD websocket closed", code);
    health.authorized = false;
    health.subscribed = 0;
    clearFeedState("eodhd");
    setTimeout(connectEodhdWs, 5000);
  });

  eodhdWs.on("error", (err) => log("EODHD websocket error", err.message));
}

function onBinanceTradeMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return;
  }
  const d = msg?.data ?? msg;
  if (!d || d.e !== "trade") return;
  const symbol = String(d.s ?? "").toUpperCase();
  if (!symbol.endsWith("USDT")) return;
  const streamBase = symbol.slice(0, -4);
  if (!BINANCE_BASE_SET.has(streamBase)) return;
  const price = Number(d.p);
  if (!Number.isFinite(price) || price <= 0) return;
  const tradeSec = resolveTradeSec(d.T ?? d.E);
  const storeBase = BINANCE_STREAM_TO_STORE[streamBase] ?? streamBase;
  queueMinuteClose(storeBase, tradeSec, price, { source: "binance" });
  // Alias pairs used under both Finsepa names (e.g. SKY stream + MKR page).
  if (storeBase !== streamBase) {
    queueMinuteClose(streamBase, tradeSec, price, { source: "binance" });
  }
}

/** Market-data host — `data-stream.binance.vision` avoids 451 geo-blocks common on Railway US. */
const BINANCE_WS_BASE =
  process.env.CRYPTO_BINANCE_WS_BASE?.trim() || "wss://data-stream.binance.vision";

function connectBinanceWsChunk(bases, chunkIndex) {
  const streams = bases.map((b) => `${b.toLowerCase()}usdt@trade`).join("/");
  const url = `${BINANCE_WS_BASE}/stream?streams=${streams}`;
  const ws = new WebSocket(url);
  binanceSockets[chunkIndex] = ws;

  ws.on("open", () => {
    health.binanceConnected = binanceSockets.some((s) => s && s.readyState === WebSocket.OPEN);
    log("Binance websocket open", `chunk=${chunkIndex}`, `n=${bases.length}`);
  });

  ws.on("message", onBinanceTradeMessage);

  ws.on("close", (code) => {
    log("Binance websocket closed", `chunk=${chunkIndex}`, code);
    health.binanceConnected = binanceSockets.some((s) => s && s.readyState === WebSocket.OPEN);
    if (!health.binanceConnected) clearFeedState("binance");
    setTimeout(() => connectBinanceWsChunk(bases, chunkIndex), 5000);
  });

  ws.on("error", (err) => log("Binance websocket error", `chunk=${chunkIndex}`, err.message));
}

function connectBinanceWs() {
  if (!BINANCE_BASES.length) {
    log("Binance skipped — CRYPTO_BINANCE_BASES empty");
    return;
  }
  for (let i = 0; i < BINANCE_BASES.length; i += BINANCE_STREAM_CHUNK) {
    const chunk = BINANCE_BASES.slice(i, i + BINANCE_STREAM_CHUNK);
    connectBinanceWsChunk(chunk, Math.floor(i / BINANCE_STREAM_CHUNK));
  }
  log(
    "Binance subscribed",
    BINANCE_BASES.length,
    "bases in",
    Math.ceil(BINANCE_BASES.length / BINANCE_STREAM_CHUNK),
    "chunks",
  );
}

let krakenWs = null;

function onKrakenTradeMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (msg?.method === "pong" || msg?.method === "heartbeat") return;
  if (msg?.channel !== "trade" || !Array.isArray(msg?.data)) return;
  for (const trade of msg.data) {
    const wsSymbol = String(trade?.symbol ?? "");
    const base = KRAKEN_BASE_BY_WS_SYMBOL[wsSymbol];
    if (!base || !KRAKEN_BASE_SET.has(base)) continue;
    const price = Number(trade?.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const tradeSec = resolveTradeSec(
      trade?.timestamp != null ? Date.parse(String(trade.timestamp)) / 1000 : undefined,
    );
    queueMinuteClose(base, tradeSec, price, { source: "kraken" });
  }
}

function connectKrakenWs() {
  if (!KRAKEN_BASES.length) {
    log("Kraken skipped — CRYPTO_KRAKEN_BASES empty");
    return;
  }
  const symbols = KRAKEN_BASES.map((b) => KRAKEN_WS_SYMBOL_BY_BASE[b]).filter(Boolean);
  if (!symbols.length) {
    log("Kraken skipped — no WS symbols mapped");
    return;
  }
  krakenWs = new WebSocket("wss://ws.kraken.com/v2");

  krakenWs.on("open", () => {
    health.krakenConnected = true;
    krakenWs.send(
      JSON.stringify({
        method: "subscribe",
        params: { channel: "trade", symbol: symbols },
      }),
    );
    log("Kraken websocket open", `n=${symbols.length}`, symbols.join(","));
  });

  krakenWs.on("message", onKrakenTradeMessage);

  krakenWs.on("close", (code) => {
    log("Kraken websocket closed", code);
    health.krakenConnected = false;
    clearFeedState("kraken");
    setTimeout(connectKrakenWs, 5000);
  });

  krakenWs.on("error", (err) => log("Kraken websocket error", err.message));
}

let okxWs = null;
let okxPingTimer = null;

function onOkxTradeMessage(raw) {
  const text = String(raw);
  if (text === "pong") return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (msg?.event === "subscribe" || msg?.event === "error") {
    if (msg.event === "error") log("OKX subscribe error", msg.code, msg.msg);
    return;
  }
  const channel = String(msg?.arg?.channel ?? "");
  if (!Array.isArray(msg?.data)) return;
  const instId = String(msg?.arg?.instId ?? "");
  const base = OKX_BASE_BY_INST[instId];
  if (!base || !OKX_BASE_SET.has(base)) return;
  if (channel === "trades") {
    for (const trade of msg.data) {
      const price = Number(trade?.px);
      if (!Number.isFinite(price) || price <= 0) continue;
      const tradeSec = resolveTradeSec(trade?.ts);
      queueMinuteClose(base, tradeSec, price, { source: "okx" });
    }
    return;
  }
  // Illiquid names (LEO) may go minutes without trades — tickers keep the tip alive.
  if (channel === "tickers") {
    for (const row of msg.data) {
      const price = Number(row?.last);
      if (!Number.isFinite(price) || price <= 0) continue;
      const tradeSec = resolveTradeSec(row?.ts);
      queueMinuteClose(base, tradeSec, price, { source: "okx" });
    }
  }
}

function connectOkxWs() {
  if (!OKX_BASES.length) {
    log("OKX skipped — CRYPTO_OKX_BASES empty");
    return;
  }
  const instIds = OKX_BASES.map((b) => OKX_INST_BY_BASE[b] ?? `${b}-USDT`).filter(Boolean);
  const args = instIds.flatMap((instId) => [
    { channel: "trades", instId },
    { channel: "tickers", instId },
  ]);
  if (!args.length) {
    log("OKX skipped — no instIds mapped");
    return;
  }
  if (okxPingTimer) {
    clearInterval(okxPingTimer);
    okxPingTimer = null;
  }
  okxWs = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  okxWs.on("open", () => {
    health.okxConnected = true;
    okxWs.send(JSON.stringify({ op: "subscribe", args }));
    okxPingTimer = setInterval(() => {
      if (okxWs && okxWs.readyState === WebSocket.OPEN) okxWs.send("ping");
    }, 20_000);
    log("OKX websocket open", `n=${args.length}`, args.map((a) => a.instId).join(","));
  });

  okxWs.on("message", onOkxTradeMessage);

  okxWs.on("close", (code) => {
    log("OKX websocket closed", code);
    health.okxConnected = false;
    if (okxPingTimer) {
      clearInterval(okxPingTimer);
      okxPingTimer = null;
    }
    clearFeedState("okx");
    setTimeout(connectOkxWs, 5000);
  });

  okxWs.on("error", (err) => log("OKX websocket error", err.message));
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
      res.end(JSON.stringify(health));
      return;
    }
    res.writeHead(404, { Connection: "close" });
    res.end();
  });
  server.keepAliveTimeout = 1000;
  server.headersTimeout = 5000;
  server.listen(HEALTH_PORT, "0.0.0.0", () => log("health server listening", HEALTH_PORT));
}

/** Seed last prices once so quiet pairs still open a tip before the first trade. */
async function seedFreeExchangeLastPrices() {
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    if (KRAKEN_BASES.length) {
      const pairs = KRAKEN_BASES.map((b) => KRAKEN_WS_SYMBOL_BY_BASE[b]?.replace("/", "") ?? `${b}USD`);
      const res = await fetch(
        `https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairs.join(","))}`,
      );
      if (res.ok) {
        const json = await res.json();
        const rows = json?.result ?? {};
        for (const base of KRAKEN_BASES) {
          const ws = KRAKEN_WS_SYMBOL_BY_BASE[base];
          const restKey = ws?.replace("/", "");
          const row =
            rows[restKey] ??
            rows[`X${restKey}`] ??
            Object.entries(rows).find(([k]) => k.includes(base))?.[1];
          const price = Number(row?.c?.[0]);
          if (Number.isFinite(price) && price > 0) {
            queueMinuteClose(base, nowSec, price, { source: "kraken" });
          }
        }
        log("Kraken REST seed", KRAKEN_BASES.length);
      }
    }
  } catch (err) {
    log("Kraken REST seed error", err instanceof Error ? err.message : String(err));
  }

  try {
    for (const base of OKX_BASES) {
      const instId = OKX_INST_BY_BASE[base] ?? `${base}-USDT`;
      const res = await fetch(
        `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`,
        { headers: { "User-Agent": "Finsepa/1.0" } },
      );
      if (!res.ok) continue;
      const json = await res.json();
      const price = Number(json?.data?.[0]?.last);
      if (Number.isFinite(price) && price > 0) {
        queueMinuteClose(base, nowSec, price, { source: "okx" });
      }
    }
    if (OKX_BASES.length) log("OKX REST seed", OKX_BASES.length);
  } catch (err) {
    log("OKX REST seed error", err instanceof Error ? err.message : String(err));
  }

  // Maker (MKR) trades as SKY on Binance — seed both Finsepa names.
  try {
    if (BINANCE_BASE_SET.has("SKY")) {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SKYUSDT");
      if (res.ok) {
        const json = await res.json();
        const price = Number(json?.price);
        if (Number.isFinite(price) && price > 0) {
          queueMinuteClose("MKR", nowSec, price, { source: "binance" });
          queueMinuteClose("SKY", nowSec, price, { source: "binance" });
          log("Binance REST seed MKR/SKY", price);
        }
      }
    }
  } catch (err) {
    log("Binance REST seed error", err instanceof Error ? err.message : String(err));
  }
}

startHealthServer();
connectEodhdWs();
connectBinanceWs();
connectKrakenWs();
connectOkxWs();
void seedFreeExchangeLastPrices();
setInterval(heartbeatTick, HEARTBEAT_MS);

log("crypto WS minute ingest starting", {
  eodhdPairs: EODHD_WS_PAIRS,
  binanceBases: BINANCE_BASES,
  krakenBases: KRAKEN_BASES,
  okxBases: OKX_BASES,
  heartbeatMs: HEARTBEAT_MS,
  flushDebounceMs: FLUSH_DEBOUNCE_MS,
  upsertTimeoutMs: SUPABASE_UPSERT_TIMEOUT_MS,
});
