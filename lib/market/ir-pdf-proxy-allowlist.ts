/**
 * Hosts allowed for streaming through `GET /api/ir-pdf` so PDFs can load in an in-app `<iframe>`
 * (avoids `X-Frame-Options` on some CDNs).
 */
export function isIrPdfProxyUrlAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const h = parsed.hostname.toLowerCase();
  if (h === "q4cdn.com" || h.endsWith(".q4cdn.com")) return true;
  if (h === "nvidia.com" || h.endsWith(".nvidia.com")) return true;
  if (h === "nike.com" || h.endsWith(".nike.com")) return true;
  if (h === "apple.com" || h.endsWith(".apple.com")) return true;
  if (h === "www.sec.gov" || h === "sec.gov") {
    const p = parsed.pathname.toLowerCase();
    return p.includes("/archives/edgar/") && p.endsWith(".pdf");
  }
  return false;
}
