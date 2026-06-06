"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { PortfolioPageView } from "@/components/portfolio/portfolio-page-view";
import { PortfolioPageLoadingShell } from "@/components/portfolio/portfolio-page-loading";
import { PublicPortfolioViewProvider } from "@/components/portfolio/public-portfolio-view-provider";
import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { PublicPortfolioListingSnapshot } from "@/lib/portfolio/public-listing-snapshot";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Wallet } from "@/lib/icons";

type ListingDetail = {
  id: string;
  name: string;
  snapshot: PublicPortfolioListingSnapshot | null;
};

function PublicPortfolioPageInner({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolios/listings/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("This portfolio is no longer public or does not exist.");
          setListing(null);
          return;
        }
        throw new Error("Failed to load");
      }
      const data = (await res.json()) as {
        id?: string;
        name?: string;
        snapshot?: PublicPortfolioListingSnapshot | null;
      };
      setListing({
        id: data.id ?? listingId,
        name: typeof data.name === "string" ? data.name : "Portfolio",
        snapshot: data.snapshot ?? null,
      });
    } catch {
      setError("Could not load this portfolio. Try again later.");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <PortfolioPageLoadingShell />;
  }

  if (error || !listing) {
    return (
      <div className="flex min-h-full flex-col bg-white px-4 py-8 sm:px-9">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/portfolios" className="text-[#71717A] hover:text-[#09090B]">
            Portfolios
          </Link>
        </nav>
        <Empty variant="card" className="min-h-[min(50vh,400px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Portfolio unavailable</EmptyTitle>
            <EmptyDescription>{error ?? "Portfolio not found."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!listing.snapshot) {
    return (
      <div className="flex min-h-full flex-col bg-white px-4 py-8 sm:px-9">
        <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-2 text-sm">
          <Link href="/portfolios" className="shrink-0 text-[#71717A] hover:text-[#09090B]">
            Portfolios
          </Link>
          <span className="shrink-0 text-[#71717A]" aria-hidden>
            /
          </span>
          <span className="min-w-0 truncate text-sm font-normal text-[#09090B]" aria-current="page">
            {listing.name}
          </span>
        </nav>
        <Empty variant="card" className="min-h-[min(50vh,400px)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Snapshot not available</EmptyTitle>
            <EmptyDescription>
              This listing was published before detailed snapshots were supported. The owner can re-save the
              portfolio as Public to refresh the community view.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const holdings: PortfolioHolding[] = listing.snapshot.holdings;
  const transactions: PortfolioTransaction[] = listing.snapshot.transactions;
  const tabBasePath = `/portfolios/${listing.id}`;

  return (
    <PublicPortfolioViewProvider
      portfolioName={listing.name}
      holdings={holdings}
      transactions={transactions}
    >
      <PortfolioPageView
        portfolioName={listing.name}
        holdings={holdings}
        transactions={transactions}
        readOnly
        showPortfoliosBreadcrumb
        tabBasePath={tabBasePath}
        publicListingId={listing.id}
      />
    </PublicPortfolioViewProvider>
  );
}

export function PublicPortfolioPageClient({ listingId }: { listingId: string }) {
  return (
    <Suspense fallback={<PortfolioPageLoadingShell />}>
      <PublicPortfolioPageInner listingId={listingId} />
    </Suspense>
  );
}
