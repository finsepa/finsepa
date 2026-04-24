import { cn } from "@/lib/utils";

const CARD =
  "flex flex-col gap-2 overflow-x-hidden overflow-y-visible rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition hover:shadow-[0px_2px_4px_0px_rgba(10,10,10,0.08)]";

const PLACEHOLDER_KEYS = ["revenue", "net_income", "eps", "free_cash_flow", "ebitda"] as const;

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {PLACEHOLDER_KEYS.map((id) => (
        <div key={id} className={cn(CARD, "animate-pulse")}>
          <div className="h-5 w-28 rounded bg-neutral-200/90" />
          <div className="h-9 w-44 rounded bg-neutral-200/80" />
          <div className="h-[278px] rounded-xl bg-neutral-100" />
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
