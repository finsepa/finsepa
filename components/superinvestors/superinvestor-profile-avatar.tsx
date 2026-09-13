"use client";

import { useState } from "react";
import { UserRound } from "@/lib/icons";

import { cn } from "@/lib/utils";

/**
 * Profile header avatar: local `/public` paths only — native `img` avoids `next/image`
 * optimizer quirks with protected-route static files; `onError` falls back to the generic icon.
 */
const headerShell =
  "relative block h-14 w-14 shrink-0 overflow-hidden rounded-full border border-stroke-muted bg-surface-muted";
const donutShell =
  "relative block h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border border-stroke-muted bg-surface-muted shadow-[0px_1px_4px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08))]";

export function SuperinvestorProfileAvatar({
  src,
  name,
  size = "header",
}: {
  src: string;
  name: string;
  /** `donut` matches portfolio allocation center avatar (60px). */
  size?: "header" | "donut";
}) {
  const [failed, setFailed] = useState(false);
  const trimmed = src.trim();
  const iconClass = "h-8 w-8";

  if (!trimmed || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-stroke-muted bg-surface-muted text-fg-muted",
          size === "donut"
            ? "h-[60px] w-[60px] shadow-[0px_1px_4px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-08))]"
            : "h-14 w-14",
        )}
        aria-hidden
      >
        <UserRound className={iconClass} strokeWidth={1.75} />
      </span>
    );
  }

  const shell = size === "donut" ? donutShell : headerShell;

  return (
    <span className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element -- public /superinvestors avatars */}
      <img
        src={trimmed}
        alt={name}
        width={56}
        height={56}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
