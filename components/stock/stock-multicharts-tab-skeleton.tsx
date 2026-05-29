import {
  MULTICHART_CARD_CHART_HEIGHT_PX,
  MULTICHART_CARD_CLASS,
} from "@/components/stock/earnings-card-styles";
import { cn } from "@/lib/utils";

const PLACEHOLDER_KEYS = [
  "revenue",
  "net_income",
  "net_margin",
  "eps",
  "free_cash_flow",
  "ebitda",
  "pe_ratio",
  "return_on_capital_employed",
] as const;

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {PLACEHOLDER_KEYS.map((id) => (
        <div key={id} className={cn(MULTICHART_CARD_CLASS, "animate-pulse")}>
          <div className="h-5 w-28 rounded bg-neutral-200/90" />
          <div className="h-9 w-44 rounded bg-neutral-200/80" />
          <div
            className="rounded-xl bg-neutral-100"
            style={{ height: MULTICHART_CARD_CHART_HEIGHT_PX }}
          />
        </div>
      ))}
    </div>
  );
}

/** Pulse grid only — use under the Multicharts heading inside `StockMultichartsTab`. */
export function MultichartsTabSkeletonGrid() {
  return <SkeletonGrid />;
}

/** Full tab shell for `dynamic(..., { ssr: false })` loading — matches client markup, safe for SSR. */
export function MultichartsTabSkeleton() {
  return (
    <div className="space-y-6 pt-1">
      <h2 className="text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Multicharts</h2>
      <SkeletonGrid />
    </div>
  );
}
