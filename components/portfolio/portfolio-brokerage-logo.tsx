"use client";

import { useEffect, useState } from "react";
import { GitMerge } from "@/lib/icons";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
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
        "flex shrink-0 items-center justify-center rounded-[10px] border border-stroke bg-surface text-[11px] font-semibold text-fg-muted shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
        className,
      )}
      aria-hidden
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

const portfolioListLogoSizeClass = {
  list: "h-9 w-9",
  topbar: "h-9 w-9",
} as const;

const portfolioListLogoShellClass =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-stroke bg-surface shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]";

/** Top bar squircle — matches `topbarSquircleIconClass` (36×36). */
export const portfolioTopbarLogoClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-stroke bg-surface shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]";

type PortfolioLogoSize = "list" | "topbar";

function portfolioLogoShellClass(size: PortfolioLogoSize, className?: string) {
  return cn(portfolioListLogoShellClass, portfolioListLogoSizeClass[size], className);
}

/** Logo in portfolio picker rows — brokerage image, Finsepa tile for manual/demo, icon for combined. */
export function PortfolioListLogo({
  portfolio,
  className,
  size = "list",
}: {
  portfolio: PortfolioEntry;
  className?: string;
  size?: PortfolioLogoSize;
}) {
  const shellClass = portfolioLogoShellClass(size, className);
  const iconClass = size === "topbar" ? "h-[18px] w-[18px]" : "h-4 w-4";
  const brandMarkSize = size === "topbar" ? 20 : 18;

  if (portfolioIsCombined(portfolio)) {
    return (
      <div className={shellClass} aria-hidden>
        <GitMerge className={cn(iconClass, "text-fg-muted")} strokeWidth={2} />
      </div>
    );
  }

  if (portfolio.snaptrade) {
    return <PortfolioBrokerageLogo snaptrade={portfolio.snaptrade} size={size} className={className} />;
  }

  return (
    <div className={shellClass} aria-hidden>
      <FinsepaLogo size={brandMarkSize} className="text-fg" title="" />
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
        className={cn(portfolioListLogoSizeClass[size], className)}
      />
    );
  }

  return (
    <div className={cn(portfolioLogoShellClass(size, className), "p-1")} aria-hidden>
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
