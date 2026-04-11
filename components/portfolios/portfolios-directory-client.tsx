"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CompanyLogo } from "@/components/screener/company-logo";
import { UserAvatar } from "@/components/user/user-avatar";
import { displayLogoUrlForPortfolioSymbol } from "@/lib/portfolio/portfolio-asset-display-logo";
import { PortfoliosDirectorySkeleton } from "@/components/portfolios/portfolios-directory-skeleton";
import { PUBLIC_LISTINGS_CHANGED_EVENT } from "@/lib/portfolio/sync-public-listing-client";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type PublicListingRow = {
  id: string;
  name: string;
  metrics: Record<string, unknown>;
  updatedAt: string | null;
};

function metricNum(m: Record<string, unknown>, key: string): number | null {
  const v = m[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metricStr(m: Record<string, unknown>, key: string): string | null {
  const v = m[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function metricStringArray(m: Record<string, unknown>, key: string): string[] {
  const v = m[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return usd.format(n);
}

function fmtPct(n: number | null, signed: boolean): string {
  if (n == null) return "—";
  const body = pctFmt.format(Math.abs(n));
  if (!signed) return `${pctFmt.format(n)}%`;
  if (n > 0) return `+${body}%`;
  if (n < 0) return `-${body}%`;
  return `${body}%`;
}

function athReturnClass(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-[#09090B]";
  if (Math.abs(n) < 0.0005) return "text-[#09090B]";
  return n >= 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function initialsFromOwnerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function StatCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[4px]">
      <p className="text-xs font-medium leading-5 tracking-normal text-[#71717A]">{label}</p>
      <div className="text-sm font-medium leading-5 tracking-normal text-[#09090B]">{children}</div>
    </div>
  );
}

/** Community directory card — layout aligned with Figma (avatar, owner, portfolio name, ATH return, stats row). */
function PublicPortfolioBlock({ listing }: { listing: PublicListingRow }) {
  const m = listing.metrics;
  const value = metricNum(m, "valueUsd");
  const ath = metricNum(m, "returnsAthPct") ?? metricNum(m, "totalProfitPct");
  const holdingCount = metricNum(m, "holdingCount");
  const ownerName = metricStr(m, "ownerDisplayName") ?? "Member";
  const ownerAvatar = metricStr(m, "ownerAvatarUrl");
  const topSyms = metricStringArray(m, "topSymbols").slice(0, 5);

  const updatedLabel =
    listing.updatedAt && !Number.isNaN(Date.parse(listing.updatedAt)) ?
      format(parseISO(listing.updatedAt), "MMM d, yyyy")
    : "—";

  return (
    <div
      className="mb-6 rounded-[12px] border border-[#E4E4E7] bg-white p-[20px] shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]"
      role="group"
      aria-label={`Public portfolio ${listing.name} by ${ownerName}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar
            imageSrc={
              ownerAvatar && (ownerAvatar.startsWith("http") || ownerAvatar.startsWith("/")) ?
                ownerAvatar
              : null
            }
            initials={initialsFromOwnerName(ownerName)}
            size="portfolios"
          />
          <div className="flex min-w-0 flex-col gap-[4px]">
            <h2 className="truncate text-xl font-semibold leading-7 tracking-normal text-[#09090B]">{ownerName}</h2>
            <p
              className="truncate text-sm font-normal leading-6 tracking-normal text-[#71717A]"
              title={listing.name}
            >
              {listing.name}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[4px] text-right">
          <p
            className={cn(
              "text-base font-semibold leading-6 tabular-nums tracking-normal",
              athReturnClass(ath),
            )}
          >
            {fmtPct(ath, true)}
          </p>
          <p className="text-sm font-normal leading-6 tracking-normal text-[#71717A]">Returns (ATH)</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <StatCell label="Value">
            <span className="tabular-nums">{fmtUsd(value)}</span>
          </StatCell>
          <StatCell label="No. of Holdings">
            <span className="tabular-nums">
              {holdingCount != null ? `${Math.round(holdingCount)} assets` : "—"}
            </span>
          </StatCell>
          <StatCell label="Last updates">
            <span className="tabular-nums">{updatedLabel}</span>
          </StatCell>
          <div className="flex min-w-0 flex-col gap-[4px] md:col-span-1">
            <p className="text-xs font-medium leading-5 tracking-normal text-[#71717A]">Top 5 Holdings</p>
            <div className="flex items-center">
              {topSyms.length === 0 ? (
                <span className="text-sm font-medium leading-5 tracking-normal text-[#A1A1AA]">—</span>
              ) : (
                <div className="flex flex-row items-center">
                  {topSyms.map((sym, i) => (
                    <div
                      key={`${sym}-${i}`}
                      className="-ml-1 first:ml-0"
                      style={{ zIndex: topSyms.length - i }}
                    >
                      <div className="overflow-hidden rounded-full ring-2 ring-white">
                        <CompanyLogo
                          name={sym}
                          logoUrl={displayLogoUrlForPortfolioSymbol(sym)}
                          symbol={sym}
                          size="xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end md:justify-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-[#FAFAFA] text-[#71717A]"
            aria-hidden
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfoliosDirectoryClient() {
  const pathname = usePathname();
  const [listings, setListings] = useState<PublicListingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/portfolios/listings", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setListings([]);
          return;
        }
        throw new Error("Failed to load portfolios");
      }
      const data = (await res.json()) as { listings?: PublicListingRow[] };
      setListings(Array.isArray(data.listings) ? data.listings : []);
    } catch {
      setError("Could not load community portfolios.");
      setListings([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const onListingsChanged = () => void load();
    window.addEventListener(PUBLIC_LISTINGS_CHANGED_EVENT, onListingsChanged);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(PUBLIC_LISTINGS_CHANGED_EVENT, onListingsChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (listings === null) {
    return <PortfoliosDirectorySkeleton cards={2} />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#E4E4E7] bg-white px-6 py-12 text-center text-sm text-[#71717A]">
        {error}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <Empty variant="card" className="min-h-[min(50vh,420px)] w-full">
        <EmptyHeader className="gap-3">
          <EmptyMedia variant="icon">
            <Wallet className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No public portfolios yet</EmptyTitle>
          <EmptyDescription className="max-w-md">
            When someone sets a portfolio to Public, it will appear here for everyone signed in. Open My Portfolio, edit
            the portfolio, choose Public, and save — your snapshot updates automatically.
          </EmptyDescription>
        </EmptyHeader>
        <Link
          href="/portfolio"
          className="mt-8 text-sm font-medium text-[#2563EB] transition-colors hover:text-[#1D4ED8] hover:underline"
        >
          Go to My Portfolio
        </Link>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col">
      {listings.map((row) => (
        <PublicPortfolioBlock key={row.id} listing={row} />
      ))}
    </div>
  );
}
