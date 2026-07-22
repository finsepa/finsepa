/**
 * Stable, deterministic external identifiers for SnapTrade-imported rows.
 *
 * These IDs are the idempotency key for {@link mergeSnaptradeSyncSafe}. They must be:
 *  - Deterministic  — the same provider event always maps to the same id.
 *  - Namespaced      — never collide with a manual row or another provider.
 *  - Full precision  — fallback hashing never rounds shares/price/amount (unlike the
 *                      legacy content-dedupe key which rounded to 4dp / 2dp).
 *
 * Pure / isomorphic (no node built-ins) so it is safe to import from tests and the client.
 */

const NS = "snaptrade";

/** FNV-1a 32-bit hash → 8-char hex. Deterministic across runtimes. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Two-pass hash (forward + reverse-mixed) plus length to lower collision odds for the
 * fallback key. Still fully deterministic and full precision.
 */
function stableHash(input: string): string {
  const forward = fnv1a(input);
  const reverse = fnv1a(`${input.length}:${input.split("").reverse().join("")}`);
  return `${forward}${reverse}`;
}

function coerce(part: string | null | undefined): string {
  return (part ?? "").trim();
}

/** `snaptrade:activity:{accountId}:{activityId}` */
export function snaptradeActivityExternalId(accountId: string, activityId: string): string {
  return `${NS}:activity:${coerce(accountId)}:${coerce(activityId)}`;
}

/** `snaptrade:order:{accountId}:{orderId}` */
export function snaptradeOrderExternalId(accountId: string, orderId: string): string {
  return `${NS}:order:${coerce(accountId)}:${coerce(orderId)}`;
}

/**
 * Deterministic id when the provider did not return a usable activity/order id.
 * Hashes the FULL-precision field set (no rounding) so distinct economics stay distinct.
 */
export function snaptradeFallbackExternalId(
  accountId: string,
  fields: Record<string, string | number | null | undefined>,
): string {
  const parts = Object.keys(fields)
    .sort()
    .map((k) => {
      const v = fields[k];
      // Preserve full numeric precision — never round.
      const s = typeof v === "number" && Number.isFinite(v) ? v.toString() : v == null ? "" : String(v);
      return `${k}=${s}`;
    })
    .join("|");
  return `${NS}:fallback:${coerce(accountId)}:${stableHash(parts)}`;
}

/**
 * Stable id for a synthetic reconciliation / emulation row (`SNAPTRADE_ADJUSTMENT`).
 * `kind` is e.g. `holding` | `cash` | `emulated`; `key` is the symbol or currency.
 * Stable across syncs so a later sync upserts (not duplicates) the adjustment.
 */
export function snaptradeAdjustmentExternalId(accountId: string, kind: string, key: string): string {
  return `${NS}:adjust:${coerce(accountId)}:${coerce(kind)}:${coerce(key).toUpperCase()}`;
}
