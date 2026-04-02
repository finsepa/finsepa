"use client";

import { useEffect, useState } from "react";
import { mergeLogoMemory, readLogoMemory } from "@/lib/logos/logo-memory";
import { logoColors } from "./data";

function InitialsMark({ name }: { name: string }) {
  const colors = logoColors[name] ?? {
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  };
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function CompanyLogo({
  name,
  logoUrl,
  symbol,
}: {
  name: string;
  logoUrl: string;
  /** When set (e.g. ticker), enables session logo reuse across views. */
  symbol?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fromServer = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const fromMem = symbol ? readLogoMemory(symbol) : undefined;
  const effective = (fromServer || (fromMem ?? "")).trim();

  useEffect(() => {
    if (symbol && fromServer) mergeLogoMemory(symbol, fromServer);
  }, [symbol, fromServer]);

  const hasLogoUrl =
    effective.length > 0 &&
    (/^https?:\/\//i.test(effective) || effective.startsWith("//") || effective.startsWith("/"));

  if (failed || !hasLogoUrl) {
    return <InitialsMark name={name} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback
    <img
      src={effective}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      className="h-8 w-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain"
      onError={() => {
        setFailed(true);
        if (symbol) mergeLogoMemory(symbol, null);
      }}
    />
  );
}
