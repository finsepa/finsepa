"use client";

import { useRouter } from "next/navigation";

import { ProFeatureBadge } from "@/components/account/pro-feature-badge";
import { PATH_ACCOUNT_PLANS } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

/**
 * Soft Free gate over earnings Transcript / Slides / Reports modals:
 * content peeks under blur + Pro badge → /account/plans.
 */
export function EarningsProDocGateOverlay({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const router = useRouter();
  if (!active) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-surface/40 backdrop-blur-[6px]",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Pro feature"
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={() => router.push(PATH_ACCOUNT_PLANS)}
        className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-surface px-3 py-2 text-[13px] font-medium text-fg shadow-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15"
      >
        <ProFeatureBadge zIndex={360} className="pointer-events-none" />
        <span>View plans</span>
      </button>
    </div>
  );
}
