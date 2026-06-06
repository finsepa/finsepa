import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function ChartLoadingIndicator({
  className,
  minHeightPx,
  message = "Building your chart...",
}: {
  className?: string;
  /** Minimum height of the loading region; content stays vertically centered within it. */
  minHeightPx?: number;
  message?: string;
}) {
  return (
    <div
      className={cn("flex w-full min-w-0 items-center justify-center", className)}
      style={minHeightPx != null ? { minHeight: minHeightPx } : undefined}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-5 text-[#71717A]" />
        <p className="text-[14px] font-normal leading-5 text-[#71717A]">{message}</p>
      </div>
    </div>
  );
}
