"use client";

import { useState } from "react";
import { UserRound } from "@/lib/icons";

import { cn } from "@/lib/utils";

/** White-on-dark logos need a dark tile or they disappear on the default gray circle. */
function avatarNeedsDarkTile(src: string): boolean {
  return src.includes("blackrock");
}

/**
 * Profile header avatar: local `/public` paths only — native `img` avoids `next/image`
 * optimizer quirks with protected-route static files; `onError` falls back to the generic icon.
 */
const headerShell =
  "relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] ring-1 ring-white";
const donutShell =
  "relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] ring-[1px] ring-white shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]";

export function SuperinvestorProfileAvatar({
  src,
  name,
  size = "header",
}: {
  src: string;
  name: string;
  /** `donut` matches portfolio allocation center avatar (72px). */
  size?: "header" | "donut";
}) {
  const [failed, setFailed] = useState(false);
  const trimmed = src.trim();
  const iconClass = size === "donut" ? "h-9 w-9" : "h-8 w-8";

  if (!trimmed || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]",
          size === "donut" ? "h-[72px] w-[72px] ring-[1px] ring-white shadow-[0px_1px_4px_0px_rgba(10,10,10,0.08)]" : "h-14 w-14",
        )}
        aria-hidden
      >
        <UserRound className={iconClass} strokeWidth={1.75} />
      </span>
    );
  }

  const darkTile = avatarNeedsDarkTile(trimmed);
  const shell = size === "donut" ? donutShell : headerShell;

  return (
    <span
      className={cn(shell, darkTile ? "bg-[#09090B]" : "bg-[#F4F4F5]")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- public /superinvestors avatars */}
      <img
        src={trimmed}
        alt={name}
        width={56}
        height={56}
        className={cn("h-full w-full", darkTile ? "object-contain p-2" : "object-cover")}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
