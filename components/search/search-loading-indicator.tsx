import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function SearchLoadingIndicator({
  className,
  spinnerClassName,
}: {
  className?: string;
  spinnerClassName?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center py-8", className)}
      role="status"
      aria-live="polite"
      aria-label="Searching"
    >
      <Spinner className={cn("size-5 text-[#71717A]", spinnerClassName)} />
    </div>
  );
}
