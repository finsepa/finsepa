import Link from "next/link";

import { Star } from "@/lib/icons";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function WatchlistEmptyState({
  variant = "card",
  className,
  showLink = variant === "card",
}: {
  variant?: "card" | "plain";
  className?: string;
  showLink?: boolean;
}) {
  return (
    <Empty
      variant={variant}
      className={cn(variant === "card" && "min-h-[min(50vh,400px)]", className)}
    >
      <EmptyHeader className={variant === "plain" ? "gap-2" : undefined}>
        <EmptyMedia variant="icon">
          <Star className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No saved assets yet</EmptyTitle>
        <EmptyDescription className={variant === "plain" ? "max-w-[260px]" : "max-w-sm"}>
          {variant === "plain" ?
            "Star symbols from any page to build your watchlist."
          : "Add stocks from the screener or a stock page, crypto from a crypto asset page, and indices from the markets table. They will show up here."}
        </EmptyDescription>
      </EmptyHeader>
      {showLink ? (
        <Link
          href="/screener"
          className="mt-6 text-sm font-semibold text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4 transition-colors hover:decoration-[#A1A1AA]"
        >
          Go to Markets
        </Link>
      ) : null}
    </Empty>
  );
}
