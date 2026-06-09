import "server-only";

import { isLocalDevHostname } from "@/lib/auth/turnstile-public";

/** True when this request targets a local dev server (never in production). */
export function isLocalDevAuthRequest(request: Request): boolean {
  if (process.env.NODE_ENV !== "development") return false;

  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!isLocalDevHostname(hostname)) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      if (!isLocalDevHostname(o.hostname)) return false;
    } catch {
      return false;
    }
  }

  return true;
}
