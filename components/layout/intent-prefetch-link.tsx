"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link>;

/**
 * Soft navigation helper: keep `prefetch={false}` so the screener doesn’t
 * fan-out RSC for every visible row, but warm the route on hover/focus so
 * screener → asset clicks don’t wait on a cold compile + data load.
 */
export function IntentPrefetchLink({
  href,
  onPointerEnter,
  onFocus,
  prefetch = false,
  ...rest
}: Props) {
  const router = useRouter();
  const hrefStr = typeof href === "string" ? href : null;

  return (
    <Link
      href={href}
      prefetch={prefetch}
      {...rest}
      onPointerEnter={(e) => {
        if (hrefStr) router.prefetch(hrefStr);
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        if (hrefStr) router.prefetch(hrefStr);
        onFocus?.(e);
      }}
    />
  );
}
