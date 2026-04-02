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

export const PROVIDER_TRACE_ENABLED = process.env.FINSEPA_PROVIDER_TRACE === "1";

type TraceBucket = {
  label: string;
  eodhdHttp: number;
  byFn: Record<string, number>;
};

const als = new AsyncLocalStorage<TraceBucket>();

export function runWithProviderTrace<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const bucket: TraceBucket = { label, eodhdHttp: 0, byFn: {} };
  return als.run(bucket, async () => {
    const result = await fn();
    if (PROVIDER_TRACE_ENABLED) {
      console.info(
        `[FINSEPA_PROVIDER_TRACE] scope=${label} eodhd_http=${bucket.eodhdHttp} byFn=${JSON.stringify(bucket.byFn)}`,
      );
    }
    return result;
  });
}

/** One outbound HTTP request to eodhd.com (count once per fetch()). */
export function traceEodhdHttp(fnName: string, meta?: Record<string, unknown>) {
  const b = als.getStore();
  if (b) {
    b.eodhdHttp += 1;
    b.byFn[fnName] = (b.byFn[fnName] ?? 0) + 1;
  }
  if (PROVIDER_TRACE_ENABLED) {
    const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console.info(`[FINSEPA_PROVIDER_TRACE] EODHD ${fnName}${extra}`);
  }
}
