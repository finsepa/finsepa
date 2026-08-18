/**
 * Superinvestor activity notification copy + payload helpers
 * (web inbox card + APNs).
 */

export const SUPERINVESTOR_ACTIVITY_KIND = "superinvestor_activity";

export type SuperinvestorActivityPayload = {
  slug: string;
  managerName: string;
  /** Relative avatar path e.g. `/superinvestors/warren-buffett.png`. */
  avatarSrc?: string;
  /** Absolute URL for APNs / remote images. */
  logoUrl?: string;
  /** Display period, e.g. `Q2 · 2026`. */
  quarterLabel: string;
  activityCount: number;
  accession: string;
  filingDate: string | null;
  href: string;
};

/** `Q2 2026` → `Q2 · 2026` (single middle dot; idempotent if already formatted). */
export function formatSuperinvestorQuarterLabel(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const m = /^Q([1-4])(?:\s*[·.•⋯…]?\s*|\s+)(\d{4})$/i.exec(trimmed);
  if (m) return `Q${m[1]} · ${m[2]}`;
  return trimmed;
}

export function formatSuperinvestorActivitySummary(activityCount: number): string {
  if (activityCount <= 0) return "Holdings updated";
  if (activityCount === 1) return "New 1 activity";
  return `New ${activityCount} activities`;
}

export function formatSuperinvestorPushCopy(input: {
  managerName: string;
  quarterLabel: string;
  activityCount: number;
}): { title: string; body: string } {
  const quarter = formatSuperinvestorQuarterLabel(input.quarterLabel);
  const summary = formatSuperinvestorActivitySummary(input.activityCount);
  const body = quarter ? `${quarter}\n${summary}` : summary;
  return {
    title: input.managerName.trim() || "Superinvestor",
    body,
  };
}

export function parseSuperinvestorActivityPayload(
  payload: Record<string, unknown> | null | undefined,
): SuperinvestorActivityPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const managerName =
    typeof payload.managerName === "string" ? payload.managerName.trim() : "";
  if (!slug || !managerName) return null;

  const activityCount =
    typeof payload.activityCount === "number" && Number.isFinite(payload.activityCount)
      ? Math.max(0, Math.floor(payload.activityCount))
      : 0;
  const quarterLabel =
    typeof payload.quarterLabel === "string" ? payload.quarterLabel.trim() : "";
  const accession = typeof payload.accession === "string" ? payload.accession.trim() : "";
  const href =
    typeof payload.href === "string" && payload.href.trim()
      ? payload.href.trim()
      : `/superinvestors/${encodeURIComponent(slug)}`;

  return {
    slug,
    managerName,
    avatarSrc:
      typeof payload.avatarSrc === "string" && payload.avatarSrc.trim()
        ? payload.avatarSrc.trim()
        : undefined,
    logoUrl:
      typeof payload.logoUrl === "string" && payload.logoUrl.trim()
        ? payload.logoUrl.trim()
        : undefined,
    quarterLabel,
    activityCount,
    accession,
    filingDate:
      typeof payload.filingDate === "string" && payload.filingDate.trim()
        ? payload.filingDate.trim()
        : null,
    href,
  };
}
