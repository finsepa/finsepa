"use client";

import { useEffect, useState } from "react";

import type { PortfolioSnaptradeLink } from "@/components/portfolio/portfolio-types";
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

export function PortfolioBrokerageLogo({
  snaptrade,
  className,
}: {
  snaptrade?: PortfolioSnaptradeLink | null;
  className?: string;
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
    return <BrokerageInitials name={name} className={className} />;
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className={cn(
        "h-8 w-8 shrink-0 rounded-lg border border-[#E4E4E7] bg-white object-contain p-0.5",
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
