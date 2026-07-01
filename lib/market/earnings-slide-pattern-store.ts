import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isDirectEarningsPdfUrl,
  isKnownEarningsSlideDeckUrl,
  isSecEdgarPresentationExhibitHtml,
} from "@/lib/market/earnings-document-url";

export type SlideDeckFormat =
  | "pdf"
  | "pptx"
  | "static-files"
  | "sec-html"
  | "q4cdn"
  | "cloudfront-presentation"
  | "other";

export type ClassifiedSlideDeckUrl = {
  host: string;
  pathPattern: string;
  deckFormat: SlideDeckFormat;
  sampleUrl: string;
};

export function classifySlideDeckUrl(url: string): ClassifiedSlideDeckUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (isSecEdgarPresentationExhibitHtml(url)) {
    return { host, pathPattern: "/archives/edgar/", deckFormat: "sec-html", sampleUrl: url };
  }
  if (/\/static-files\/[a-f0-9-]{36}/i.test(path)) {
    return { host, pathPattern: "/static-files/{uuid}", deckFormat: "static-files", sampleUrl: url };
  }
  if (host.includes("q4cdn.com") && isDirectEarningsPdfUrl(url)) {
    return { host, pathPattern: "/files/doc_financials/", deckFormat: "q4cdn", sampleUrl: url };
  }
  if (host === "d1io3yog0oux5.cloudfront.net" && /\/presentation\//i.test(path)) {
    return { host, pathPattern: "/presentation/", deckFormat: "cloudfront-presentation", sampleUrl: url };
  }
  if (isKnownEarningsSlideDeckUrl(url)) {
    return {
      host,
      pathPattern: "/is/content/microsoftcorp/SlidesFY",
      deckFormat: "pptx",
      sampleUrl: url,
    };
  }
  if (isDirectEarningsPdfUrl(url)) {
    return { host, pathPattern: path.includes("/presentation/") ? "/presentation/" : "*.pdf", deckFormat: "pdf", sampleUrl: url };
  }
  return { host, pathPattern: path || "/", deckFormat: "other", sampleUrl: url };
}

export async function recordSlideHostPattern(
  ticker: string,
  slideUrl: string,
): Promise<void> {
  if (process.env.FINSEPA_EARNINGS_SLIDE_PATTERN_WRITE === "0") return;

  const hit = classifySlideDeckUrl(slideUrl);
  if (!hit) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const sym = ticker.trim().toUpperCase();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("earnings_slide_host_patterns")
    .select("hit_count")
    .eq("host", hit.host)
    .eq("path_pattern", hit.pathPattern)
    .eq("deck_format", hit.deckFormat)
    .maybeSingle();

  const hitCount = (typeof existing?.hit_count === "number" ? existing.hit_count : 0) + 1;

  const { error } = await admin.from("earnings_slide_host_patterns").upsert(
    {
      host: hit.host,
      path_pattern: hit.pathPattern,
      deck_format: hit.deckFormat,
      sample_url: hit.sampleUrl,
      hit_count: hitCount,
      last_ticker: sym,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "host,path_pattern,deck_format" },
  );

  if (error) {
    console.warn(`earnings_slide_host_patterns_upsert_failed: ${error.message}`);
  }
}

export async function recordSlideHostPatternsFromUrls(
  ticker: string,
  urls: readonly (string | null | undefined)[],
): Promise<void> {
  const seen = new Set<string>();
  for (const raw of urls) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    await recordSlideHostPattern(ticker, raw);
  }
}
