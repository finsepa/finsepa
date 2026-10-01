import { WatchlistEmptyIllustration } from "@/components/portfolio-home/portfolio-empty-illustration";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
        <WatchlistEmptyIllustration className="mb-6" />
        <EmptyTitle>No saved assets yet</EmptyTitle>
        <EmptyDescription className={variant === "plain" ? "max-w-[260px]" : "max-w-sm"}>
          Star symbols from any page to add them to this watchlist.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
