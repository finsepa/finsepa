/**
 * SnapTrade order fill gate — never import open / unfilled brokerage orders.
 * Pure / isomorphic.
 */

/** Statuses that may carry a positive filled_quantity into the ledger. */
const FILL_STATUSES = new Set([
  "EXECUTED",
  "FILLED",
  "PARTIAL",
  "PARTIALLY_FILLED",
  "PARTIAL_CANCELED", // may still have filled_quantity > 0
]);

const OPEN_STATUSES = new Set([
  "NONE",
  "PENDING",
  "ACCEPTED",
  "NEW",
  "QUEUED",
  "TRIGGERED",
  "ACTIVATED",
  "REPLACE_PENDING",
  "CANCEL_PENDING",
  "PENDING_RISK_REVIEW",
  "CONTINGENT_ORDER",
  "FAILED",
  "REJECTED",
  "CANCELED",
  "CANCELLED",
  "EXPIRED",
  "REPLACED",
  "STOPPED",
  "SUSPENDED",
]);

export function normalizeSnaptradeOrderStatus(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/**
 * Whether this order row should become a trade draft.
 * Requires a real fill: filled_quantity > 0 and status not an open/pending mapping.
 */
export function isSnaptradeOrderFillEligible(args: {
  status: string | null | undefined;
  filledQuantity: number | null | undefined;
}): boolean {
  const status = normalizeSnaptradeOrderStatus(args.status);
  const filled =
    typeof args.filledQuantity === "number" && Number.isFinite(args.filledQuantity) ?
      args.filledQuantity
    : 0;

  if (filled <= 0) return false;
  if (OPEN_STATUSES.has(status)) return false;
  // Unknown empty status: only allow when there is a positive fill (some brokers omit status).
  if (!status) return filled > 0;
  if (FILL_STATUSES.has(status)) return true;
  // Best-effort: treat anything with "FILL" / "EXECut" as filled; reject the rest.
  if (status.includes("FILL") || status.includes("EXECUT")) return true;
  return false;
}
