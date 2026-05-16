import { IndexCardSkeleton, StocksTableSkeleton } from "@/components/markets/markets-skeletons";
import { SCREENER_COMPANIES_PAGE_SIZE } from "@/lib/screener/screener-markets-page-size";

export default function ScreenerLoading() {
  return (
    <div className="min-w-0 w-full max-w-full max-md:overflow-x-visible md:overflow-x-hidden px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-6 h-9 w-full max-w-xl skeleton" />
      <div className="mb-6 -mx-4 overflow-x-auto overscroll-x-contain px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0">
        <div className="flex w-max flex-nowrap gap-3 md:grid md:w-full md:max-w-full md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {["S&P 500", "Nasdaq 100", "Dow Jones", "Russell 2000", "VIX"].map((name) => (
            <IndexCardSkeleton key={name} name={name} />
          ))}
        </div>
      </div>
      <div className="mb-5 h-10 w-48 skeleton" />
      <StocksTableSkeleton rows={SCREENER_COMPANIES_PAGE_SIZE} />
    </div>
  );
}
