"use client";

import { useEffect, useState } from "react";
import { cryptoRouteBase } from "@/lib/crypto/crypto-symbol-base";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { withLogoDevTheme } from "@/lib/screener/company-logo-url";
import { indexLogoPublicPath } from "@/lib/market/index-logo-url";
import { useClientMounted, useLogoDevTheme } from "@/lib/theme/use-logo-dev-theme";
import { cn } from "@/lib/utils";
import { logoColors } from "./data";

const LOGO_INSET_TICKERS = new Set(["AAPL", "GOOGL", "GOOG", "MSFT", "MU", "GLXY"]);
/** Edge-to-edge marks (circle / square fills the canvas) — larger inset so the tile corners don't clip them. */
const LOGO_MEDIUM_INSET_TICKERS = new Set(["GOOGL", "GOOG", "MSFT", "MU", "GLXY"]);

/** Per-ticker tile background (brand color behind transparent / white marks). */
const LOGO_TILE_BG: Partial<Record<string, string>> = {
  AVGO: "bg-[#CF2032]",
};

/** Per-ticker zoom inside the fixed frame (logos with baked-in whitespace). */
const LOGO_SCALE_BOOST: Partial<Record<string, number>> = {
  INTC: 1.16,
  HD: 1.28,
  // Crypto marks carry padding — bump so they fill the frame.
  BTC: 1.32,
  DOGE: 1.3,
  LTC: 1.28,
  BCH: 1.3,
};

type LogoSize = "xs" | "sm" | "28" | "md" | "40" | "lg";

const LOGO_BOX_SIZE: Record<LogoSize, string> = {
  xs: "h-5 w-5",
  sm: "h-6 w-6",
  "28": "h-7 w-7",
  md: "h-8 w-8",
  "40": "h-10 w-10",
  lg: "h-12 w-12",
};

const LOGO_PX: Record<LogoSize, number> = { xs: 20, sm: 24, "28": 28, md: 32, "40": 40, lg: 48 };

/** Every asset mark (company, crypto, index, cash, initials) is a circle. */
function logoBoxClass(size: LogoSize): string {
  return `${LOGO_BOX_SIZE[size]} rounded-full`;
}

/** Normalize `BTC-USD` / `ETH.CC` → base for tile/scale lookups. */
function logoLookupSymbol(symbol: string | undefined): string | undefined {
  const raw = symbol?.trim().toUpperCase();
  if (!raw) return undefined;
  const base = cryptoRouteBase(raw);
  return base || raw;
}

function logoTileBgClass(symbol: string | undefined): string {
  const sym = logoLookupSymbol(symbol);
  if (!sym) return "bg-surface";
  return LOGO_TILE_BG[sym] ?? "bg-surface";
}

function logoScaleBoost(symbol: string | undefined): number | null {
  const sym = logoLookupSymbol(symbol);
  if (!sym) return null;
  return LOGO_SCALE_BOOST[sym] ?? null;
}

/** Full-bleed marks look oversized — pad inside the fixed frame only. */
function brandLogoInsetClass(
  symbol: string | undefined,
  size: LogoSize,
): string {
  const sym = symbol?.trim().toUpperCase();
  if (!sym || !LOGO_INSET_TICKERS.has(sym)) return "";
  const mediumInset = LOGO_MEDIUM_INSET_TICKERS.has(sym);
  switch (size) {
    case "lg":
      return mediumInset ? "p-1.5" : "p-2";
    case "40":
      return mediumInset ? "p-1" : "p-1.5";
    case "md":
    case "28":
      return mediumInset ? "p-1.5" : "p-1";
    default:
      return mediumInset ? "p-1" : "p-0.5";
  }
}

function InitialsMark({
  name,
  size,
  className,
}: {
  name: string;
  size: LogoSize;
  className?: string;
}) {
  const colors = logoColors[name] ?? {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-stroke-muted",
  };
  const textSize =
    size === "xs" ? "text-[9px]" : size === "sm" || size === "28" ? "text-[10px]" : size === "md" ? "text-[11px]" : "text-[12px]";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border font-bold",
        logoBoxClass(size),
        textSize,
        colors.bg,
        colors.text,
        colors.border,
        className,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Cash / USD row icon: US flag asset (`/usd.svg`). */
function UsdCashMark({
  size,
  className,
}: {
  size: LogoSize;
  className?: string;
}) {
  const px = LOGO_PX[size];
  const imgBox = logoBoxClass(size);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public SVG
    <img
      src="/usd.svg"
      alt="US Dollar"
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={cn(
        imgBox,
        "shrink-0 border-0 object-cover shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
        className,
      )}
    />
  );
}

/** Bundled index mark (iOS `IndexLogoAssets` PNGs under `/indices/`). */
function BundledIndexMark({
  src,
  name,
  size,
  className,
  eagerLoad = false,
}: {
  src: string;
  name: string;
  size: LogoSize;
  className?: string;
  eagerLoad?: boolean;
}) {
  const px = LOGO_PX[size];
  const imgBox = logoBoxClass(size);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static public PNG
    <img
      src={src}
      alt={name}
      width={px}
      height={px}
      loading={eagerLoad ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eagerLoad ? "high" : undefined}
      className={cn(
        imgBox,
        "shrink-0 border-0 object-cover shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-06))]",
        className,
      )}
    />
  );
}

export function CompanyLogo({
  name,
  logoUrl,
  symbol,
  size = "md",
  fill = false,
  eagerLoad = false,
  className,
}: {
  name: string;
  logoUrl: string;
  /** When set (e.g. ticker), enables session logo reuse across views. */
  symbol?: string;
  /** `xs` = 20×20, `sm` = 24×24, `28` = 28×28, `md` = 32×32 (default), `40` = 40×40, `lg` = 48×48. */
  size?: LogoSize;
  /** Zoom logo to fill the square (earnings grid, etc.). Inset brands keep their padding. */
  fill?: boolean;
  /** Screenshot export — load immediately (no lazy) so html-to-image captures the bitmap. */
  eagerLoad?: boolean;
  className?: string;
}) {
  const logoTheme = useLogoDevTheme();
  const mounted = useClientMounted();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const cachedIdentity =
    mounted && symbol ? readScreenerCompanyIdentity(symbol) : null;
  const displayName = cachedIdentity?.name?.trim() || name;
  const fromServer = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const fromMem = mounted && symbol ? readLogoMemory(symbol) : undefined;
  const effectiveBase = (fromServer || cachedIdentity?.logoUrl || (fromMem ?? "")).trim();
  const effective = withLogoDevTheme(effectiveBase, logoTheme, symbol);
  const failed = failedSrc === effective;

  useEffect(() => {
    if (symbol && fromServer) mergeLogoMemory(symbol, fromServer);
  }, [symbol, fromServer]);

  if (symbol?.trim().toUpperCase() === "USD") {
    return <UsdCashMark size={size} className={className} />;
  }

  const bundledIndexSrc = indexLogoPublicPath(symbol);
  if (bundledIndexSrc) {
    return (
      <BundledIndexMark
        src={bundledIndexSrc}
        name={displayName}
        size={size}
        className={className}
        eagerLoad={eagerLoad}
      />
    );
  }

  const hasLogoUrl =
    effective.length > 0 &&
    (/^https?:\/\//i.test(effective) || effective.startsWith("//") || effective.startsWith("/"));

  if (failed || !hasLogoUrl) {
    return <InitialsMark name={displayName} size={size} className={className} />;
  }
  const px = LOGO_PX[size];
  const imgBox = logoBoxClass(size);
  const sym = symbol?.trim().toUpperCase();
  const scaleBoost = logoScaleBoost(sym);
  const useFillFrame =
    (fill && !LOGO_INSET_TICKERS.has(sym ?? "")) || scaleBoost != null;
  const fillScale = scaleBoost ?? 1.22;
  const onLogoError = () => {
    setFailedSrc(effective);
    if (symbol) mergeLogoMemory(symbol, null);
  };

  const imgLoading = eagerLoad ? "eager" : "lazy";

  if (useFillFrame) {
    return (
      <div
        className={cn(
          imgBox,
          "relative shrink-0 overflow-hidden border border-stroke-muted",
          logoTileBgClass(sym),
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback */}
        <img
          src={effective}
          alt=""
          width={px}
          height={px}
          loading={imgLoading}
          decoding="async"
          fetchPriority={eagerLoad ? "high" : undefined}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: `scale(${fillScale})` }}
          onError={onLogoError}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback
    <img
      src={effective}
      alt=""
      width={px}
      height={px}
      loading={imgLoading}
      decoding="async"
      fetchPriority={eagerLoad ? "high" : undefined}
      className={cn(
        imgBox,
        "shrink-0 border border-stroke-muted object-contain",
        logoTileBgClass(sym),
        brandLogoInsetClass(symbol, size),
        className,
      )}
      onError={onLogoError}
    />
  );
}
