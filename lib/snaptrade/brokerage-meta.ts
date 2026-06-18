function asRecord(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function readString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

/** Prefer square logo for compact UI (title row, menus). */
export function readSnapTradeBrokerageLogoUrl(brokerage: unknown): string | null {
  const o = asRecord(brokerage);
  if (!o) return null;
  return readString(o.aws_s3_square_logo_url) ?? readString(o.aws_s3_logo_url);
}

export function readSnapTradeBrokerageSlug(brokerage: unknown): string | null {
  return readString(asRecord(brokerage)?.slug);
}

export function readSnapTradeBrokerageName(brokerage: unknown): string | null {
  const o = asRecord(brokerage);
  if (!o) return null;
  return readString(o.display_name) ?? readString(o.name);
}

export function readSnapTradeIsRealTimeConnection(brokerage: unknown): boolean {
  const o = asRecord(brokerage);
  return o?.is_real_time_connection === true;
}
