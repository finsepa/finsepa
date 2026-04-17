import "server-only";

export * from "@/lib/market/crypto-meta";

import { format, parse, subDays } from "date-fns";

import type { CryptoMeta } from "@/lib/market/crypto-meta";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { fetchEodhdCryptoFundamentalsMeta } from "@/lib/market/eodhd-crypto-fundamentals-meta";
import type { EodhdDailyBar, EodhdOpenOnDateResult } from "@/lib/market/eodhd-eod";

/**
 * Last session on or before calendar {@link ymd} using crypto daily bars (close).
 * Same window as stock `fetchEodhdOpenPriceOnOrBefore` (28d lookback).
 */
export async function fetchEodhdCryptoOpenPriceOnOrBefore(
  symbolOrTicker: string,
  ymd: string,
): Promise<EodhdOpenOnDateResult | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;

  const meta = await resolveCryptoMetaForProvider(symbolOrTicker);
  if (!meta) return null;

  const day = parse(ymd, "yyyy-MM-dd", new Date());
  const from = format(subDays(day, 28), "yyyy-MM-dd");
  const to = ymd;

  const candidates =
    meta.symbol === "TON" && meta.eodhdAltSymbols?.length
      ? [meta.eodhdSymbol, ...meta.eodhdAltSymbols]
      : [meta.eodhdSymbol];

  for (const eodSym of candidates) {
    const bars = await fetchEodhdCryptoDailyBars(eodSym, from, to);
    if (!bars?.length) continue;

    const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
    const onOrBefore = sorted.filter((r) => r.date <= ymd);
    const pick = onOrBefore.length ? onOrBefore[onOrBefore.length - 1]! : null;
    if (!pick) continue;

    const price = pick.close;
    if (!Number.isFinite(price)) continue;

    return {
      price,
      barDate: pick.date,
      source: "close",
    };
  }

  return null;
}

export async function fetchEodhdCryptoDailyBars(eodhdCryptoSymbol: string, from: string, to: string): Promise<EodhdDailyBar[] | null> {
  const key = getEodhdApiKey();
  if (!key) return null;

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from,
    to,
  });

  const url = `https://eodhd.com/api/eod/${encodeURIComponent(eodhdCryptoSymbol)}?${params.toString()}`;

  const debugSymbols = new Set(["TONCOIN-USD.CC", "TON-USD.CC"]);
  const shouldDebug = debugSymbols.has(eodhdCryptoSymbol);

  try {
    if (!traceEodhdHttp("fetchEodhdCryptoDailyBars", { symbol: eodhdCryptoSymbol })) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;

    if (shouldDebug) {
      console.log("[crypto daily raw]", eodhdCryptoSymbol, JSON.stringify(data).slice(0, 60000));
    }

    if (!Array.isArray(data)) return null;

    const out: EodhdDailyBar[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const date = row.date;
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

      const close =
        (typeof row.adjusted_close === "number" && Number.isFinite(row.adjusted_close) ? row.adjusted_close : null) ??
        (typeof row.close === "number" && Number.isFinite(row.close) ? row.close : null) ??
        (typeof row.adj_close === "number" && Number.isFinite(row.adj_close) ? row.adj_close : null) ??
        (() => {
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase();
            if (!lk.includes("close")) continue;
            if (lk.includes("previous")) continue;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            if (typeof v === "string" && v.trim()) {
              const n = Number(v.replace(/,/g, ""));
              if (Number.isFinite(n) && n > 0) return n;
            }
          }
          return null;
        })();

      if (close == null || !Number.isFinite(close)) continue;
      out.push({ date, close });
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Try primary + alternate EODHD symbols until daily bars return (matches asset-page behavior for TON, POL, …). */
export async function fetchEodhdCryptoDailyBarsForMeta(
  meta: CryptoMeta,
  from: string,
  to: string,
): Promise<EodhdDailyBar[] | null> {
  const candidates = [meta.eodhdSymbol, ...(meta.eodhdAltSymbols ?? [])];
  let best: EodhdDailyBar[] | null = null;
  for (const sym of candidates) {
    const raw = await fetchEodhdCryptoDailyBars(sym, from, to);
    const bars = Array.isArray(raw) ? raw : [];
    if (bars.length > (best?.length ?? 0)) best = bars;
    if (best && best.length >= 2) break;
  }
  return best;
}

export type EodhdCryptoHighlights = {
  marketCapUsd: number | null;
};

export async function fetchEodhdCryptoFundamentalsHighlights(eodhdCryptoSymbol: string): Promise<EodhdCryptoHighlights | null> {
  const m = await fetchEodhdCryptoFundamentalsMeta(eodhdCryptoSymbol);
  if (!m) return null;
  return { marketCapUsd: m.marketCapUsd };
}

/** Last daily close from bars, when it is a usable positive USD price. */
export function lastPositiveCloseFromCryptoBars(bars: EodhdDailyBar[] | null | undefined): number | null {
  const arr = Array.isArray(bars) ? bars : [];
  if (!arr.length) return null;
  const c = arr[arr.length - 1]?.close;
  return typeof c === "number" && Number.isFinite(c) && c > 0 ? c : null;
}

/**
 * Tries primary + alternate EODHD symbols until a market cap is resolved:
 * reported cap → fully diluted cap → implied (circulating or total supply × last EOD close).
 */
export async function fetchCryptoMarketCapUsdForMeta(
  meta: CryptoMeta,
  lastCloseUsd: number | null = null,
): Promise<number | null> {
  const candidates = [meta.eodhdSymbol, ...(meta.eodhdAltSymbols ?? [])];
  for (const sym of candidates) {
    const m = await fetchEodhdCryptoFundamentalsMeta(sym);
    if (!m) continue;
    if (m.marketCapUsd != null && Number.isFinite(m.marketCapUsd) && m.marketCapUsd > 0) return m.marketCapUsd;
    if (m.fullyDilutedMarketCapUsd != null && Number.isFinite(m.fullyDilutedMarketCapUsd) && m.fullyDilutedMarketCapUsd > 0) {
      return m.fullyDilutedMarketCapUsd;
    }
    const sup = m.circulatingSupply ?? m.totalSupply;
    if (
      lastCloseUsd != null &&
      lastCloseUsd > 0 &&
      sup != null &&
      Number.isFinite(sup) &&
      sup > 0
    ) {
      const implied = lastCloseUsd * sup;
      if (Number.isFinite(implied) && implied > 0) return implied;
    }
  }
  return null;
}
