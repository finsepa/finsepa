"use client";

import { FinsepaLogo } from "@/components/brand/finsepa-logo";
import { cn } from "@/lib/utils";

type Props = {
  /** When false, solid screen only (short probe before we know if a session exists). */
  showLogo?: boolean;
  className?: string;
};

/**
 * Full-viewport boot/resume cover — used instead of flashing the login form while a session is restored.
 * Background matches auth surfaces (`bg-nav`); logo gently pulses via opacity.
 */
export function AuthSessionLoadingScreen({ showLogo = true, className }: Props) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[300] flex items-center justify-center bg-nav",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {showLogo ? (
        <FinsepaLogo
          size={56}
          title="Finsepa"
          className="text-fg motion-reduce:opacity-80 animate-finsepa-logo-pulse"
        />
      ) : null}
    </div>
  );
}
