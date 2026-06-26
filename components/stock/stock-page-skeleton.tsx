/** Shared loading chrome for `/stock/[ticker]` — route `loading.tsx` and client shell. */
export function StockPageSkeleton() {
  return (
    <div
      className="relative min-w-0 space-y-5 px-4 py-4 sm:px-9 sm:py-6"
      aria-busy
      aria-label="Loading stock page"
    >
      <div className="space-y-2">
        <div className="h-4 w-56 animate-pulse rounded-md bg-neutral-100" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-md bg-neutral-100" />
        <div className="h-6 w-40 animate-pulse rounded-md bg-neutral-100" />
      </div>
      <div className="h-10 w-full max-w-3xl animate-pulse rounded-md bg-neutral-100" />
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-[10px] bg-neutral-100" />
        <div className="h-9 w-28 animate-pulse rounded-[10px] bg-neutral-100" />
        <div className="h-9 w-20 animate-pulse rounded-[10px] bg-neutral-100" />
      </div>
      <div className="h-[min(420px,50vh)] w-full max-w-[1200px] animate-pulse rounded-lg bg-neutral-100" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}
