import { cn } from "@/lib/utils";

function pieSlicePath(cx: number, cy: number, r: number, pct: number): string | null {
  if (pct <= 0) return null;
  if (pct >= 100) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const angle = (pct / 100) * Math.PI * 2;
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = pct > 50 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

type AllocationWeightPieProps = {
  /** Allocation 0–100. */
  pct: number;
  className?: string;
  size?: number;
};

/** Tiny filled pie (12 o’clock, clockwise) for portfolio weight / allocation cells. */
export function AllocationWeightPie({ pct, className, size = 14 }: AllocationWeightPieProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const vb = 16;
  const cx = vb / 2;
  const cy = vb / 2;
  const r = 6.5;
  const slice = pieSlicePath(cx, cy, r, clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      className={cn("shrink-0 text-fg-muted", className)}
      aria-hidden
    >
      {slice ? <path d={slice} fill="currentColor" /> : null}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
      />
    </svg>
  );
}

type AllocationWeightValueProps = {
  pct: number;
  /** Already-formatted percent digits without `%` (e.g. `11.89`). */
  label: string;
  className?: string;
};

/** Right-aligned `11.89%` + pie icon. */
export function AllocationWeightValue({ pct, label, className }: AllocationWeightValueProps) {
  return (
    <span className={cn("inline-flex items-center justify-end gap-1.5", className)}>
      <span>
        {label}%
      </span>
      <AllocationWeightPie pct={pct} />
    </span>
  );
}
