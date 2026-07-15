import { cn } from "@/lib/utils";

type ChartBrandWatermarkProps = {
  className?: string;
  /** Slightly smaller type for denser / shorter chart frames (e.g. screenshot export). */
  size?: "default" | "compact";
  /**
   * `band` — fundamentals plot inset (8%/4%).
   * `full` — fill the entire chart plot (overview PriceChart).
   */
  cover?: "band" | "full";
};

/**
 * Centered brand mark behind chart series (Bybit-style), above plot background.
 * Uses rgba color (not Tailwind opacity) so html-to-image exports keep the watermark.
 */
export function ChartBrandWatermark({
  className,
  size = "default",
  cover = "band",
}: ChartBrandWatermarkProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-[1] flex items-center justify-center",
        cover === "full" ? "inset-0" : "inset-x-0 top-[8%] bottom-[4%]",
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          "select-none font-['Inter'] font-semibold leading-none tracking-[0.05em]",
          size === "compact" ? "text-[48px] sm:text-[56px]" : "text-[60px] sm:text-[72px]",
        )}
        style={{ color: "rgba(161, 161, 170, 0.2)" }}
      >
        Finsepa
      </span>
    </div>
  );
}
