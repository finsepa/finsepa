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
    return <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const sp = await searchParams;
  const parsedMonday = parseWeekMondayParam(sp.week);
  const monday = parsedMonday ?? mondayOfWeekUtc(new Date());
  const data = await getEarningsWeekPayload(monday);
  const prevMonday = addDaysUtc(monday, -7);
  const nextMonday = addDaysUtc(monday, 7);

  return (
    <div className="px-9 py-6">
      <EarningsWeekGrid
        data={data}
        prevWeekYmd={toYmdUtc(prevMonday)}
        nextWeekYmd={toYmdUtc(nextMonday)}
      />
    </div>
  );
}
