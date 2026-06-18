import { getAuthAppOriginFromEnv } from "@/lib/auth/app-origin";

export function requestOriginFromHeaders(h: Headers): string {
  const fromEnv = getAuthAppOriginFromEnv();
  if (fromEnv) return fromEnv;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
