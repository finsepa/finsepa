"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { normalizeUsdForDisplay } from "@/lib/portfolio/overview-metrics";
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

function profitUsdClassNormalized(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-[#09090B]";
  if (Math.abs(n) < 0.005) return "text-[#09090B]";
  return n > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function profitPctClass(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-[#09090B]";
  if (Math.abs(n) < 0.0005) return "text-[#09090B]";
  return n > 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function spyClass(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-[#09090B]";
  if (Math.abs(n) < 0.0005) return "text-[#09090B]";
  return n >= 0 ? "text-[#16A34A]" : "text-[#DC2626]";
}

function ListingMetricShell({
  label,
  children,
  footer,
}: {
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]">
      <p className="text-xs font-medium text-[#71717A]">{label}</p>
      {children}
      {footer ? <div className="mt-2 text-sm text-[#71717A]">{footer}</div> : null}
    </div>
  );
}

function PublicPortfolioBlock({ listing }: { listing: PublicListingRow }) {
  const m = listing.metrics;
  const value = metricNum(m, "valueUsd");
  const profitUsd = metricNum(m, "totalProfitUsd");
  const profitPct = metricNum(m, "totalProfitPct");
  const spy = metricNum(m, "spyReturnPct");
  const divY = metricNum(m, "dividendsYieldPct");
  const profitNorm = profitUsd != null ? normalizeUsdForDisplay(profitUsd) : null;

  return (
    <div
      className="mb-8 rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)]"
      role="group"
      aria-label={`Public portfolio ${listing.name}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#F4F4F5] pb-4">
        <h2 className="text-lg font-semibold leading-7 text-[#09090B]">{listing.name}</h2>
        {listing.updatedAt ? (
          <span className="text-xs text-[#71717A] tabular-nums">
            Updated {new Date(listing.updatedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ListingMetricShell label="Value" footer="—">
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
            {fmtUsd(value)}
          </p>
        </ListingMetricShell>

        <ListingMetricShell label="Total profit" footer={<span className="text-xs font-medium text-[#09090B]">Open P/L %</span>}>
          <p className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", profitUsdClassNormalized(profitNorm))}>
            {profitNorm != null ? `${profitNorm >= 0 ? "+" : ""}${usd.format(profitNorm)}` : "—"}
          </p>
          <div className="mt-2">
            <span className={cn("text-sm font-medium tabular-nums", profitPctClass(profitPct))}>
              {profitPct != null ? fmtPct(profitPct, true) : "—"}
            </span>
          </div>
        </ListingMetricShell>

        <ListingMetricShell label="S&P 500" footer="Compare to S&P 500">
          <p className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", spyClass(spy))}>
            {spy != null ? fmtPct(spy, true) : "—"}
          </p>
        </ListingMetricShell>

        <ListingMetricShell label="Dividends" footer={divY != null ? "Weighted yield" : "—"}>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#09090B]">
            {divY != null ? `${pctFmt.format(divY)}%` : "—"}
          </p>
        </ListingMetricShell>
      </div>
    </div>
  );
}

export function PortfoliosDirectoryClient() {
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
  }, [load]);

  if (listings === null) {
    return (
      <div className="flex min-h-[min(50vh,420px)] items-center justify-center text-sm text-[#71717A]">
        Loading…
      </div>
    );
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
