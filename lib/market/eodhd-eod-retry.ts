/**
 * Retry wrapper for flaky EODHD daily fetches (rate limits / transient empty).
 */
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch EOD bars; retry once after a short delay when the first result is empty/null. */
export async function fetchEodhdEodDailyRetry(
  symbolOrTicker: string,
  from: string,
  to: string,
  opts?: { retries?: number; delayMs?: number },
): Promise<EodhdDailyBar[]> {
  const retries = opts?.retries ?? 1;
  const delayMs = opts?.delayMs ?? 350;
  let last: EodhdDailyBar[] | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchEodhdEodDaily(symbolOrTicker, from, to);
    if (last != null && last.length > 0) return last;
    if (attempt < retries) await sleep(delayMs);
  }
  return last ?? [];
}
