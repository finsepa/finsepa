/** Small pill showing 1-based Screener position (top 10 + page 2 by market cap). */
export function ScreenerRankBadge({
  rank,
  size = "md",
}: {
  rank: number;
  size?: "sm" | "md";
}) {
  const cls =
    size === "sm"
      ? "rounded px-1 py-px text-[10px] leading-4"
      : "rounded-md px-1.5 py-0.5 text-[11px] leading-4";
  return (
    <span
      className={`inline-flex shrink-0 items-center border border-stroke bg-surface-muted font-semibold tabular-nums text-fg-muted ${cls}`}
      aria-label={`Screener rank ${rank}`}
    >
      #{rank}
    </span>
  );
}
