"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/** White-on-dark logos need a dark tile or they disappear on the default gray circle. */
function avatarNeedsDarkTile(src: string): boolean {
  return src.includes("blackrock");
}

/**
 * Profile header avatar: local `/public` paths only — native `img` avoids `next/image`
 * optimizer quirks with protected-route static files; `onError` falls back to the generic icon.
 */
export function SuperinvestorProfileAvatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const trimmed = src.trim();
  if (!trimmed || failed) {
    return (
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#E4E4E7] bg-[#F4F4F5] text-[#71717A]"
        aria-hidden
      >
        <UserRound className="h-8 w-8" strokeWidth={1.75} />
      </span>
    );
  }

  const darkTile = avatarNeedsDarkTile(trimmed);

  return (
    <span
      className={cn(
        "relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#E4E4E7] ring-1 ring-white",
        darkTile ? "bg-[#09090B]" : "bg-[#F4F4F5]",
      )}
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
