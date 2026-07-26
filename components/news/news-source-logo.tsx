"use client";

import { useState } from "react";

import { logoDevDomainLogoUrl } from "@/lib/screener/company-logo-url";
import { cn } from "@/lib/utils";

/** Prefer root brand host when Logo.dev is weaker on a subdomain (e.g. finance.yahoo.com). */
const NEWS_SOURCE_LOGO_HOST_ALIAS: Record<string, string> = {
  "finance.yahoo.com": "yahoo.com",
};

export function newsSourceHostFromArticleUrl(articleUrl: string): string | null {
  try {
    const host = new URL(articleUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (!host) return null;
    return NEWS_SOURCE_LOGO_HOST_ALIAS[host] ?? host;
  } catch {
    return null;
  }
}

/** 16px circular source mark via Logo.dev domain proxy (`/api/media/logo`). */
export function NewsSourceLogo({
  articleUrl,
  className,
}: {
  articleUrl: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const host = newsSourceHostFromArticleUrl(articleUrl);
  const src = host ? logoDevDomainLogoUrl(host) : null;

  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- same-origin logo proxy with onError hide
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 rounded-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
