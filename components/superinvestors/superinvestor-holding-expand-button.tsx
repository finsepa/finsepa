"use client";

import { ChevronDown, ChevronUp } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Expand/collapse control — matches portfolio holdings table. */
export function SuperinvestorHoldingExpandButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-holding-expand
      aria-label={expanded ? "Collapse transactions" : "Show transactions"}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-fg",
        "transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/15",
        expanded && "bg-surface-muted",
      )}
    >
      {expanded ?
        <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden />
      : <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden />}
    </button>
  );
}
