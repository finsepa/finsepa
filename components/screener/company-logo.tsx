"use client";

import { useEffect, useState } from "react";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { logoColors } from "./data";

function InitialsMark({ name, size }: { name: string; size: "sm" | "md" | "lg" }) {
  const colors = logoColors[name] ?? {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  };
  const box =
    size === "sm"
      ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
      : size === "lg"
        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold";
  return (
    <div className={`${box} ${colors.bg} ${colors.text} ${colors.border}`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Cash / USD row icon: blue tile with black dollar (product default). */
function UsdCashMark({ size }: { size: "sm" | "md" | "lg" }) {
  const box =
    size === "sm"
      ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#1D4ED8] text-[11px] font-bold leading-none"
      : size === "lg"
        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#1D4ED8] text-[20px] font-semibold leading-none"
        : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1D4ED8] text-[15px] font-semibold leading-none";
  return (
    <div
      className={`${box} bg-[#2563EB] text-white shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]`}
      role="img"
      aria-label="US Dollar"
    >
      $
    </div>
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
  /** `sm` = 24×24, `md` = 32×32 (default), `lg` = 48×48. */
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const fromServer = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const fromMem = symbol ? readLogoMemory(symbol) : undefined;
  const effective = (fromServer || (fromMem ?? "")).trim();

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
    return <InitialsMark name={name} size={size} />;
  }
  const px = size === "sm" ? 24 : size === "lg" ? 48 : 32;
  const imgBox =
    size === "sm" ? "h-6 w-6 rounded-md" : size === "lg" ? "h-12 w-12 rounded-lg" : "h-8 w-8 rounded-lg";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback
    <img
      src={effective}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={`${imgBox} shrink-0 border border-neutral-200 bg-white object-contain`}
      onError={() => {
        setFailed(true);
        if (symbol) mergeLogoMemory(symbol, null);
      }}
    />
  );
}
