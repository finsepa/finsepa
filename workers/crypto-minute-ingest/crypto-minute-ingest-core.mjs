export const DEFAULT_FLUSH_DEBOUNCE_MS = 6_000;
export const MIN_FLUSH_DEBOUNCE_MS = 5_000;

export function resolveFlushDebounceMs(rawValue, warn = console.warn) {
  if (rawValue == null || String(rawValue).trim() === "") {
    return DEFAULT_FLUSH_DEBOUNCE_MS;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    warn(
      `Invalid CRYPTO_WS_FLUSH_DEBOUNCE_MS=${JSON.stringify(rawValue)}; using ${DEFAULT_FLUSH_DEBOUNCE_MS}ms`,
    );
    return DEFAULT_FLUSH_DEBOUNCE_MS;
  }

  if (parsed < MIN_FLUSH_DEBOUNCE_MS) {
    warn(
      `CRYPTO_WS_FLUSH_DEBOUNCE_MS=${parsed}ms is below the ${MIN_FLUSH_DEBOUNCE_MS}ms minimum; clamping to ${MIN_FLUSH_DEBOUNCE_MS}ms`,
    );
    return MIN_FLUSH_DEBOUNCE_MS;
  }

  return parsed;
}

export function minuteBucketUnix(tradeSec) {
  return Math.floor(tradeSec / 60) * 60;
}

export function setPendingMinuteClose(pendingUpserts, base, tradeSec, price, updatedAt) {
  const bucketUnix = minuteBucketUnix(tradeSec);
  pendingUpserts.set(`${base}:${bucketUnix}`, {
    ticker: base,
    bucket_unix: bucketUnix,
    close: price,
    updated_at: updatedAt,
  });
}
