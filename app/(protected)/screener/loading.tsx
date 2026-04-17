import { IndexCardSkeleton, StocksTableSkeleton } from "@/components/markets/markets-skeletons";

export default function ScreenerLoading() {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-6 h-9 w-full max-w-xl skeleton" />
      <div className="mb-6 grid grid-cols-5 gap-6">
        {["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"].map((name) => (
          <IndexCardSkeleton key={name} name={name} />
        ))}
      </div>
      <div className="mb-5 h-10 w-48 skeleton" />
      <StocksTableSkeleton rows={10} />
    </div>
  );
}
