"use client";

import { useEffect, useState } from "react";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { cn } from "@/lib/utils";
import { logoColors } from "./data";

const LOGO_INSET_TICKERS = new Set(["AAPL", "GOOGL", "GOOG", "MSFT", "MU"]);

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

function logoScaleBoost(symbol: string | undefined): number | null {
  const sym = symbol?.trim().toUpperCase();
  if (!sym) return null;
  return LOGO_SCALE_BOOST[sym] ?? null;
}

/** Full-bleed marks look oversized — pad inside the fixed frame only. */
function brandLogoInsetClass(
  symbol: string | undefined,
  size: "xs" | "sm" | "28" | "md" | "40" | "lg",
): string {
  const sym = symbol?.trim().toUpperCase();
  if (!sym || !LOGO_INSET_TICKERS.has(sym)) return "";
  const mediumInset = sym === "GOOGL" || sym === "GOOG" || sym === "MSFT" || sym === "MU";
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
  size: "xs" | "sm" | "28" | "md" | "40" | "lg";
  className?: string;
}) {
  const colors = logoColors[name] ?? {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  };
  const box =
    size === "xs"
      ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[9px] font-bold"
      : size === "sm"
        ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-bold"
        : size === "28"
          ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
          : size === "40"
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border text-[12px] font-bold"
            : size === "lg"
              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold";
  return (
    <div className={cn(box, colors.bg, colors.text, colors.border, className)}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Cash / USD row icon: US flag asset (`/usd.svg`). */
function UsdCashMark({
  size,
  className,
}: {
  size: "xs" | "sm" | "28" | "md" | "40" | "lg";
  className?: string;
}) {
  const px =
    size === "xs" ? 20 : size === "sm" ? 24 : size === "28" ? 28 : size === "lg" ? 48 : size === "40" ? 40 : 32;
  const imgBox =
    size === "xs"
      ? "h-5 w-5 rounded-md"
      : size === "sm"
        ? "h-6 w-6 rounded-[8px]"
        : size === "28"
          ? "h-7 w-7 rounded-md"
          : size === "40"
            ? "h-10 w-10 rounded-[12px]"
            : size === "lg"
              ? "h-12 w-12 rounded-lg"
              : "h-8 w-8 rounded-lg";
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
        "shrink-0 border-0 object-cover shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]",
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
  size?: "xs" | "sm" | "28" | "md" | "40" | "lg";
  /** Zoom logo to fill the square (earnings grid, etc.). Inset brands keep their padding. */
  fill?: boolean;
  /** Screenshot export — load immediately (no lazy) so html-to-image captures the bitmap. */
  eagerLoad?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  useEffect(() => {
    setStorageHydrated(true);
  }, []);

  const cachedIdentity =
    storageHydrated && symbol ? readScreenerCompanyIdentity(symbol) : null;
  const displayName = cachedIdentity?.name?.trim() || name;
  const fromServer = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const fromMem = storageHydrated && symbol ? readLogoMemory(symbol) : undefined;
  const effective = (fromServer || cachedIdentity?.logoUrl || (fromMem ?? "")).trim();

  useEffect(() => {
    if (symbol && fromServer) mergeLogoMemory(symbol, fromServer);
  }, [symbol, fromServer]);

  if (symbol?.trim().toUpperCase() === "USD") {
    return <UsdCashMark size={size} className={className} />;
  }

  const hasLogoUrl =
    effective.length > 0 &&
    (/^https?:\/\//i.test(effective) || effective.startsWith("//") || effective.startsWith("/"));

  if (failed || !hasLogoUrl) {
    return <InitialsMark name={displayName} size={size} className={className} />;
  }
  const px =
    size === "xs" ? 20 : size === "sm" ? 24 : size === "28" ? 28 : size === "lg" ? 48 : size === "40" ? 40 : 32;
  const imgBox =
    size === "xs"
      ? "h-5 w-5 rounded-md"
      : size === "sm"
        ? "h-6 w-6 rounded-[8px]"
        : size === "28"
          ? "h-7 w-7 rounded-md"
          : size === "40"
            ? "h-10 w-10 rounded-[12px]"
            : size === "lg"
              ? "h-12 w-12 rounded-lg"
              : "h-8 w-8 rounded-lg";
  const sym = symbol?.trim().toUpperCase();
  const scaleBoost = logoScaleBoost(sym);
  const useFillFrame =
    (fill && !LOGO_INSET_TICKERS.has(sym ?? "")) || scaleBoost != null;
  const fillScale = scaleBoost ?? 1.22;
  const onLogoError = () => {
    setFailed(true);
    if (symbol) mergeLogoMemory(symbol, null);
  };

  const imgLoading = eagerLoad ? "eager" : "lazy";

  if (useFillFrame) {
    return (
      <div
        className={cn(
          imgBox,
          "relative shrink-0 overflow-hidden border border-neutral-200 bg-white",
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
        "shrink-0 border border-neutral-200 bg-white object-contain",
        brandLogoInsetClass(symbol, size),
        className,
      )}
      onError={onLogoError}
    />
  );
}
