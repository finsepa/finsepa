import { SearchEmptyIllustration } from "@/components/portfolio-home/portfolio-empty-illustration";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function SearchRecentEmpty({ className }: { className?: string }) {
  return (
    <Empty variant="plain" className={cn("min-h-0 py-10", className)}>
      <EmptyHeader>
        <SearchEmptyIllustration className="mb-6" />
        <EmptyTitle>No recent searches</EmptyTitle>
        <EmptyDescription className="max-w-[260px]">
          Type to find stocks, crypto, etf&apos;s and indices
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
