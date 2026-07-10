/** Temporary allowlist until verified status is stored on user profiles. */
const VERIFIED_OWNER_DISPLAY_NAMES = new Set(["Vladimir Raksha"]);

export function isVerifiedPortfolioOwner(displayName: string | null | undefined): boolean {
  if (!displayName?.trim()) return false;
  return VERIFIED_OWNER_DISPLAY_NAMES.has(displayName.trim());
}
