import { EarningsWeekGrid } from "@/components/earnings/earnings-week-grid";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import {
  addDaysUtc,
  getEarningsWeekPayload,
  mondayOfWeekUtc,
  parseWeekMondayParam,
  toYmdUtc,
} from "@/lib/market/earnings-week-data";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function EarningsPage({ searchParams }: PageProps) {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const sp = await searchParams;
  const parsedMonday = parseWeekMondayParam(sp.week);
  const monday = parsedMonday ?? mondayOfWeekUtc(new Date());
  const data = await getEarningsWeekPayload(monday);
  const prevMonday = addDaysUtc(monday, -7);
  const nextMonday = addDaysUtc(monday, 7);

  return (
    <div className="min-w-0 px-4 py-5 sm:px-9 sm:py-8">
      <EarningsWeekGrid
        data={data}
        prevWeekYmd={toYmdUtc(prevMonday)}
        nextWeekYmd={toYmdUtc(nextMonday)}
      />
    </div>
  );
}
