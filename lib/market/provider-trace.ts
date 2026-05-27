import "server-only";

/**
 * Temporary instrumentation for counting external EODHD HTTP calls vs server entry scopes.
 *
 * Enable: FINSEPA_PROVIDER_TRACE=1 in .env.local (server). Restart dev server.
 * Optional browser→app fetch log: NEXT_PUBLIC_FINSEPA_PROVIDER_TRACE=1
 *
 * One browser "Screener refresh" = multiple independent server requests (RSC + /api/*);
 * each scope logs its own EODHD total; sum scopes from one full page load in the console.
 */

import { AsyncLocalStorage } from "async_hooks";

import { tryConsumeEodhdRequestSlot } from "@/lib/market/eodhd-hourly-budget";

export const PROVIDER_TRACE_ENABLED = process.env.FINSEPA_PROVIDER_TRACE === "1";

type TraceBucket = {
  label: string;
  eodhdHttp: number;
  byFn: Record<string, number>;
};

const als = new AsyncLocalStorage<TraceBucket>();

export type ProviderTraceSnapshot = {
  label: string;
  eodhdHttp: number;
  byFn: Record<string, number>;
};

function logProviderTrace(bucket: TraceBucket) {
  if (PROVIDER_TRACE_ENABLED) {
    console.info(
      `[FINSEPA_PROVIDER_TRACE] scope=${bucket.label} eodhd_http=${bucket.eodhdHttp} byFn=${JSON.stringify(bucket.byFn)}`,
    );
  }
}

export function runWithProviderTrace<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const bucket: TraceBucket = { label, eodhdHttp: 0, byFn: {} };
  return als.run(bucket, async () => {
    const result = await fn();
    logProviderTrace(bucket);
    return result;
  });
}

/** Same as {@link runWithProviderTrace} but returns per-scope EODHD counts (P6 probes). */
export async function runWithProviderTraceCollect<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; trace: ProviderTraceSnapshot }> {
  const bucket: TraceBucket = { label, eodhdHttp: 0, byFn: {} };
  const result = await als.run(bucket, fn);
  logProviderTrace(bucket);
  return {
    result,
    trace: { label, eodhdHttp: bucket.eodhdHttp, byFn: { ...bucket.byFn } },
  };
}

/**
 * Reserve hourly + optional daily EODHD budget and optional per-scope trace. Call immediately before `fetch` to eodhd.com.
 * @returns false when the rolling-hour or rolling-day cap is full — skip the fetch and return empty data upstream.
 */
export function traceEodhdHttp(fnName: string, meta?: Record<string, unknown>): boolean {
  if (!tryConsumeEodhdRequestSlot()) {
    return false;
  }
  const b = als.getStore();
  if (b) {
    b.eodhdHttp += 1;
    b.byFn[fnName] = (b.byFn[fnName] ?? 0) + 1;
  }
  if (PROVIDER_TRACE_ENABLED) {
    const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console.info(`[FINSEPA_PROVIDER_TRACE] EODHD ${fnName}${extra}`);
  }
  return true;
}
