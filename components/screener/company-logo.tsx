"use client";

import { useState } from "react";
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

export function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [failed, setFailed] = useState(false);
  const normalizedLogoUrl = typeof logoUrl === "string" ? logoUrl.trim() : "";
  const hasLogoUrl =
    normalizedLogoUrl.length > 0 &&
    // Accept absolute URLs, protocol-relative, or root-relative paths.
    (/^https?:\/\//i.test(normalizedLogoUrl) || normalizedLogoUrl.startsWith("//") || normalizedLogoUrl.startsWith("/"));

  if (failed || !hasLogoUrl) {
    return <InitialsMark name={name} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic remote favicon with onError fallback
    <img
      src={normalizedLogoUrl}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      className="h-8 w-8 shrink-0 rounded-lg border border-neutral-200 bg-white object-contain"
      onError={() => setFailed(true)}
    />
  );
}
