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
}: {
  variant?: "card" | "plain";
  className?: string;
}) {
  return (
    <Empty
      variant={variant}
      className={cn(variant === "card" && "min-h-[min(50vh,400px)]", className)}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Star className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No saved assets yet</EmptyTitle>
        <EmptyDescription className={variant === "plain" ? "max-w-[260px]" : "max-w-sm"}>
          Star symbols from any page to add them to this watchlist.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
