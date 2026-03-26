/** Stable domain-based favicon (no API key). */
export function companyLogoUrlFromDomain(domain: string): string {
  const d = domain.trim().toLowerCase();
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`;
}
