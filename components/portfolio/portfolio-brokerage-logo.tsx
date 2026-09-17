"use client";

import { useEffect, useState } from "react";
import { GitMerge } from "@/lib/icons";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import {
  portfolioIsCombined,
  type PortfolioEntry,
  type PortfolioSnaptradeLink,
} from "@/components/portfolio/portfolio-types";
import {
  resolveBrokerageLogoStyleFromImage,
  resolveBrokerageLogoStyleFromMeta,
  type BrokerageLogoRenderStyle,
} from "@/lib/snaptrade/brokerage-logo-style";
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
    <div
      className={cn(
        shellClass,
        // Dark: white plate + black mark (matches inverted primary CTA).
        "dark:border-transparent dark:bg-white dark:shadow-[0px_1px_2px_0px_rgba(0,0,0,0.24)]",
      )}
      aria-hidden
    >
      <FinsepaLogo
        size={brandMarkSize}
        className="text-fg dark:text-[#141414]"
        title=""
      />
    </div>
  );
}

function BrokerageLogoMark({
  logoUrl,
  style,
  size,
  className,
  onError,
}: {
  logoUrl: string;
  style: BrokerageLogoRenderStyle;
  size: PortfolioLogoSize;
  className?: string;
  onError: () => void;
}) {
  if (style.kind === "markOnBrandBackdrop") {
    return (
      <div
        className={portfolioLogoShellClass(size, className)}
        style={{ backgroundColor: style.backdrop }}
        aria-hidden
      >
        {/* Colored SnapTrade glyphs (eToro green, etc.) → force white on the brand plate. */}
        <img
          src={logoUrl}
          alt=""
          className="h-[60%] w-[60%] object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          onError={onError}
        />
      </div>
    );
  }

  if (style.kind === "markOnBrandPlate") {
    return (
      <div
        className={portfolioLogoShellClass(size, className)}
        style={{ backgroundColor: style.backdrop }}
        aria-hidden
      >
        <img
          src={logoUrl}
          alt=""
          className="h-[88%] w-[88%] object-contain"
          onError={onError}
        />
      </div>
    );
  }

  if (style.kind === "markOnSurface") {
    return (
      <div className={portfolioLogoShellClass(size, className)} aria-hidden>
        <img
          src={logoUrl}
          alt=""
          className="h-[76%] w-[76%] object-contain"
          onError={onError}
        />
      </div>
    );
  }

  // fullBleed — mild scale like iOS (1.12), not the old 1.42 crop.
  return (
    <div className={portfolioLogoShellClass(size, className)} aria-hidden>
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full scale-[1.12] object-cover"
        onError={onError}
      />
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
  const name = snaptrade?.brokerageName?.trim() || "Brokerage";
  const slug = snaptrade?.brokerageSlug ?? null;
  const metaStyle = resolveBrokerageLogoStyleFromMeta(slug, name);
  const [style, setStyle] = useState<BrokerageLogoRenderStyle>(
    () => metaStyle ?? { kind: "fullBleed" },
  );

  useEffect(() => {
    setLogoUrl(snaptrade?.brokerageLogoUrl?.trim() ?? "");
    setFailed(false);
    setStyle(resolveBrokerageLogoStyleFromMeta(slug, name) ?? { kind: "fullBleed" });
  }, [snaptrade?.authorizationId, snaptrade?.brokerageLogoUrl, slug, name]);

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

  // When meta doesn't force a style, sample opacity after the image loads (iOS parity).
  useEffect(() => {
    if (!logoUrl || metaStyle) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      setStyle(resolveBrokerageLogoStyleFromImage(img, slug, name));
    };
    img.onerror = () => {
      /* keep fullBleed fallback */
    };
    img.src = logoUrl;
    return () => {
      cancelled = true;
    };
  }, [logoUrl, metaStyle, slug, name]);

  if (!snaptrade) return null;

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
    <BrokerageLogoMark
      logoUrl={logoUrl}
      style={style}
      size={size}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
