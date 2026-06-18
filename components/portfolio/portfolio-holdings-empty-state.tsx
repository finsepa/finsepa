import { Layers2 } from "@/lib/icons";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function PortfolioHoldingsEmptyState({
  readOnly = false,
  className,
}: {
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <Empty variant="card" className={cn("min-h-[min(50vh,400px)]", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Layers2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No holdings yet</EmptyTitle>
        <EmptyDescription>
          {readOnly ?
            "This public portfolio has no holdings in its published snapshot."
          : "Add trades or cash movements to build your holdings."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
