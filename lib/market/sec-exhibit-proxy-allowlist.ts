import { isSecEdgarExhibitHtmlUrl } from "@/lib/market/earnings-document-url";

/** Hosts/paths allowed for streaming through `GET /api/sec-exhibit`. */
export function isSecExhibitProxyUrlAllowed(url: string): boolean {
  return isSecEdgarExhibitHtmlUrl(url);
}
