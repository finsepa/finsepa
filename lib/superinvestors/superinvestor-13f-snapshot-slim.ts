import type { Superinvestor13fProfilePageData } from "@/lib/superinvestors/types";
import type { SuperinvestorTransactionsPayload } from "@/lib/superinvestors/types";

/** Drop bulky price fields on huge tx blobs so PostgREST upserts stay reliable (UI tolerates nulls). */
export function slimSuperinvestorProfileForSnapshot(
  payload: Superinvestor13fProfilePageData,
  maxBytes = 1_800_000,
): Superinvestor13fProfilePageData {
  const raw = JSON.stringify(payload);
  if (raw.length <= maxBytes) return payload;

  const slimTx: SuperinvestorTransactionsPayload = {
    ...payload.transactions,
    quarters: payload.transactions.quarters.map((q) => ({
      ...q,
      transactions: q.transactions.map((t) => ({
        ...t,
        avgClosingPriceUsd: null,
        priceRangeLowUsd: null,
        priceRangeHighUsd: null,
      })),
    })),
  };
  const slim: Superinvestor13fProfilePageData = {
    comparison: payload.comparison,
    transactions: slimTx,
  };
  if (JSON.stringify(slim).length <= maxBytes) return slim;

  // Last resort: keep comparison + empty quarters (profile holdings still durable).
  return {
    comparison: payload.comparison,
    transactions: {
      ...payload.transactions,
      quarters: payload.transactions.quarters.map((q) => ({
        ...q,
        transactions: [],
      })),
    },
  };
}
