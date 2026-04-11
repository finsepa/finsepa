import type { PublicPortfolioListingMetrics } from "@/lib/portfolio/public-listing-metrics";

export const PUBLIC_LISTINGS_CHANGED_EVENT = "finsepa-public-portfolio-listings-changed";

export function dispatchPublicListingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PUBLIC_LISTINGS_CHANGED_EVENT));
}

/**
 * Publishes or unpublishes the current user's portfolio on the community `public_portfolio_listings` table.
 * Call when privacy is saved so the /portfolios directory updates without waiting for the debounced sync.
 */
export async function putPublicPortfolioListingRequest(opts: {
  portfolioId: string;
  publish: boolean;
  displayName?: string;
  metrics?: PublicPortfolioListingMetrics;
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch("/api/portfolios/listings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        opts.publish
          ? {
              portfolioId: opts.portfolioId,
              publish: true,
              displayName: opts.displayName ?? "",
              metrics: opts.metrics ?? {},
            }
          : { portfolioId: opts.portfolioId, publish: false },
      ),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; warning?: string };
    if (data.warning === "db_unavailable") return { ok: false };
    return { ok: data.ok !== false };
  } catch {
    return { ok: false };
  }
}
