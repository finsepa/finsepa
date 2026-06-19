"use client";

import { useEffect, useState } from "react";
import { Briefcase, GitMerge } from "@/lib/icons";

import {
  portfolioIsCombined,
  type PortfolioEntry,
  type PortfolioSnaptradeLink,
} from "@/components/portfolio/portfolio-types";
import { cn } from "@/lib/utils";

function BrokerageInitials({ name, className }: { name: string; className?: string }) {
  const label = name.trim() || "BR";
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5] text-[11px] font-semibold text-[#71717A]",
        className,
      )}
      aria-hidden
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

const portfolioListLogoShellClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#F4F4F5]";

/** Top bar squircle — matches `topbarSquircleIconClass` (36×36). */
export const portfolioTopbarLogoClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]";

type PortfolioLogoSize = "list" | "topbar";

/** Logo in portfolio picker rows — brokerage image, or icon tile for manual / combined. */
export function PortfolioListLogo({
  portfolio,
  className,
  size = "list",
}: {
  portfolio: PortfolioEntry;
  className?: string;
  size?: PortfolioLogoSize;
}) {
  const shellClass = cn(
    size === "topbar" ? portfolioTopbarLogoClass : portfolioListLogoShellClass,
    className,
  );
  const iconClass = size === "topbar" ? "h-5 w-5" : "h-4 w-4";

  if (portfolioIsCombined(portfolio)) {
    return (
      <div className={shellClass} aria-hidden>
        <GitMerge className={cn(iconClass, "text-[#71717A]")} strokeWidth={2} />
      </div>
    );
  }

  if (portfolio.snaptrade) {
    return <PortfolioBrokerageLogo snaptrade={portfolio.snaptrade} size={size} className={className} />;
  }

  return (
    <div className={shellClass} aria-hidden>
      <Briefcase className={cn(iconClass, "text-[#71717A]")} strokeWidth={2} />
    </div>
  );
}

export function PortfolioBrokerageLogo({
  snaptrade,
  className,
  size = "list",
}: {
  snaptrade?: PortfolioSnaptradeLink | null;
  className?: string;
  size?: PortfolioLogoSize;
}) {
  const [logoUrl, setLogoUrl] = useState(() => snaptrade?.brokerageLogoUrl?.trim() ?? "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLogoUrl(snaptrade?.brokerageLogoUrl?.trim() ?? "");
    setFailed(false);
  }, [snaptrade?.authorizationId, snaptrade?.brokerageLogoUrl]);

  useEffect(() => {
    if (!snaptrade?.authorizationId || logoUrl) return;
    const ac = new AbortController();
    void fetch(
      `/api/snaptrade/brokerage-logo?authorizationId=${encodeURIComponent(snaptrade.authorizationId)}`,
      { cache: "no-store", signal: ac.signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { brokerageLogoUrl?: unknown } | null) => {
        const next = typeof data?.brokerageLogoUrl === "string" ? data.brokerageLogoUrl.trim() : "";
        if (next) setLogoUrl(next);
      })
      .catch(() => {
        /* ignore */
      });
    return () => ac.abort();
  }, [snaptrade?.authorizationId, logoUrl]);

  if (!snaptrade) return null;

  const name = snaptrade.brokerageName?.trim() || "Brokerage";
  const hasLogo = logoUrl.length > 0 && !failed;

  if (!hasLogo) {
    return (
      <BrokerageInitials
        name={name}
        className={cn(
          size === "topbar" ? portfolioTopbarLogoClass : undefined,
          className,
        )}
      />
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className={cn(
        size === "topbar" ?
          cn(portfolioTopbarLogoClass, "bg-white object-contain p-0.5")
        : "h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-white object-contain p-0.5",
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
