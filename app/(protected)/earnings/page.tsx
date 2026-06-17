import { EarningsWeekGrid } from "@/components/earnings/earnings-week-grid";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { parseEarningsScopeFilter } from "@/lib/market/earnings-scope-filter";
import { computeWeekTimingGridRows } from "@/lib/market/earnings-week-grid-layout";
import {
  getEarningsWeekPageData,
  mondayOfWeekUtc,
  parseWeekMondayParam,
  toYmdUtc,
} from "@/lib/market/earnings-week-data";

type PageProps = {
  searchParams: Promise<{ week?: string; scope?: string }>;
};

export default async function EarningsPage({ searchParams }: PageProps) {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const sp = await searchParams;
  const parsedMonday = parseWeekMondayParam(sp.week);
  const monday = parsedMonday ?? mondayOfWeekUtc(new Date());
  const pack = await getEarningsWeekPageData(monday);
  const scope = parseEarningsScopeFilter(sp.scope);
  const weekTimingGridRows = computeWeekTimingGridRows(pack.payload.days);
  const todayYmd = toYmdUtc(new Date());
  const thisWeekMondayYmd = toYmdUtc(mondayOfWeekUtc(new Date()));

  return (
    <div className="flex min-w-0 flex-col px-4 py-5 sm:px-9 sm:py-8">
      <EarningsWeekGrid
        data={pack.payload}
        overflowByKey={pack.overflowByKey}
        todayYmd={todayYmd}
        thisWeekMondayYmd={thisWeekMondayYmd}
        scope={scope}
        weekTimingGridRows={weekTimingGridRows}
      />
    </div>
  );
}
