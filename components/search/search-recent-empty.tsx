import { Search } from "@/lib/icons";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function SearchRecentEmpty({ className }: { className?: string }) {
  return (
    <Empty variant="plain" className={cn("min-h-0 py-10", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No recent searches</EmptyTitle>
        <EmptyDescription className="max-w-[260px]">
          Type to find stocks, crypto, etf&apos;s and indices
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
