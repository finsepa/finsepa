/**
 * Hosted IR earnings PDF bucket (Quartr-style mirror).
 * Public object URLs: `{SUPABASE_URL}/storage/v1/object/public/earnings-ir-docs/{ticker}/{fiscal_end}/{kind}.pdf`
 */

export const EARNINGS_IR_DOCS_BUCKET = "earnings-ir-docs";

export type EarningsIrDocKind = "slides" | "filings";

export function earningsIrDocObjectPath(
  ticker: string,
  fiscalPeriodEndYmd: string,
  kind: EarningsIrDocKind,
): string {
  const t = ticker.trim().toUpperCase();
  const end = fiscalPeriodEndYmd.trim();
  return `${t}/${end}/${kind}.pdf`;
}

/** True when URL is a public object in our earnings-ir-docs bucket. */
export function isEarningsIrDocsHostedUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host.endsWith(".supabase.co") && !host.includes("supabase")) return false;
    return (
      u.pathname.includes(`/storage/v1/object/public/${EARNINGS_IR_DOCS_BUCKET}/`) &&
      /\.pdf(?:$|[?#])/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function earningsIrDocPublicUrl(supabaseUrl: string, objectPath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const path = objectPath.replace(/^\//, "");
  return `${base}/storage/v1/object/public/${EARNINGS_IR_DOCS_BUCKET}/${path}`;
}
