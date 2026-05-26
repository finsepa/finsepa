"use client";

import { useEffect, useState } from "react";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { readScreenerCompanyIdentity } from "@/lib/screener/screener-company-identity-storage";
import { cn } from "@/lib/utils";
import { logoColors } from "./data";

const LOGO_INSET_TICKERS = new Set(["AAPL", "GOOGL", "GOOG", "MSFT"]);

/** Full-bleed marks look oversized — pad inside the fixed frame only. */
function brandLogoInsetClass(
  symbol: string | undefined,
  size: "xs" | "sm" | "28" | "md" | "40" | "lg",
): string {
  const sym = symbol?.trim().toUpperCase();
  if (!sym || !LOGO_INSET_TICKERS.has(sym)) return "";
  const mediumInset = sym === "GOOGL" || sym === "GOOG" || sym === "MSFT";
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

function InitialsMark({ name, size }: { name: string; size: "xs" | "sm" | "28" | "md" | "40" | "lg" }) {
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
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
            : size === "lg"
              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold";
  return (
    <div className={`${box} ${colors.bg} ${colors.text} ${colors.border}`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Cash / USD row icon: US flag asset (`/usd.svg`). */
function UsdCashMark({ size }: { size: "xs" | "sm" | "28" | "md" | "40" | "lg" }) {
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
            ? "h-10 w-10 rounded-lg"
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
      className={`${imgBox} shrink-0 border-0 object-cover shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]`}
    />
  );
}

export function CompanyLogo({
  name,
  logoUrl,
  symbol,
  size = "md",
}: {
  name: string;
  logoUrl: string;
  /** When set (e.g. ticker), enables session logo reuse across views. */
  symbol?: string;
  /** `xs` = 20×20, `sm` = 24×24, `28` = 28×28, `md` = 32×32 (default), `40` = 40×40, `lg` = 48×48. */
  size?: "xs" | "sm" | "28" | "md" | "40" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const cachedIdentity = symbol ? readScreenerCompanyIdentity(symbol) : null;
  const displayName = cachedIdentity?.name?.trim() || name;
  const fromServer = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const fromMem = symbol ? readLogoMemory(symbol) : undefined;
  const effective = (fromServer || cachedIdentity?.logoUrl || (fromMem ?? "")).trim();

  useEffect(() => {
    if (symbol && fromServer) mergeLogoMemory(symbol, fromServer);
  }, [symbol, fromServer]);

  if (symbol?.trim().toUpperCase() === "USD") {
    return <UsdCashMark size={size} />;
  }

  const hasLogoUrl =
    effective.length > 0 &&
    (/^https?:\/\//i.test(effective) || effective.startsWith("//") || effective.startsWith("/"));

  if (failed || !hasLogoUrl) {
    return <InitialsMark name={displayName} size={size} />;
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
            ? "h-10 w-10 rounded-lg"
            : size === "lg"
              ? "h-12 w-12 rounded-lg"
              : "h-8 w-8 rounded-lg";
  const sym = symbol?.trim().toUpperCase();
  const intelBoost = sym === "INTC";
  const onLogoError = () => {
    setFailed(true);
    if (symbol) mergeLogoMemory(symbol, null);
  };

  if (intelBoost) {
    return (
      <div
        className={cn(imgBox, "relative shrink-0 overflow-hidden border border-neutral-200 bg-white")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback */}
        <img
          src={effective}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-[1.16] object-contain"
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
      loading="lazy"
      decoding="async"
      className={cn(
        imgBox,
        "shrink-0 border border-neutral-200 bg-white object-contain",
        brandLogoInsetClass(symbol, size),
      )}
      onError={onLogoError}
    />
  );
}
