import { EconomyCalendarClient } from "@/components/economy/economy-calendar-client";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { getEconomyWeekPayload } from "@/lib/market/economy-week-data";
import {
  addDaysUtc,
  mondayOfWeekUtc,
  parseWeekMondayParam,
  toYmdUtc,
} from "@/lib/market/earnings-week-data";

const ALLOWED_ECONOMY_COUNTRIES = new Set([
  "US",
  "GB",
  "DE",
  "FR",
  "JP",
  "CN",
  "CA",
  "AU",
  "IT",
  "ES",
]);

function parseEconomyCountry(param: string | undefined): string {
  const c = (param ?? "US").trim().toUpperCase();
  return ALLOWED_ECONOMY_COUNTRIES.has(c) ? c : "US";
}

type PageProps = {
  searchParams: Promise<{ week?: string; country?: string }>;
};

export default async function EconomyPage({ searchParams }: PageProps) {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const sp = await searchParams;
  const parsedMonday = parseWeekMondayParam(sp.week);
  const monday = parsedMonday ?? mondayOfWeekUtc(new Date());
  const country = parseEconomyCountry(typeof sp.country === "string" ? sp.country : undefined);
  const data = await getEconomyWeekPayload(monday, country);
  const prevMonday = addDaysUtc(monday, -7);
  const nextMonday = addDaysUtc(monday, 7);

  return (
    <div className="min-w-0 px-4 py-5 sm:px-9 sm:py-8">
      <EconomyCalendarClient
        data={data}
        prevWeekYmd={toYmdUtc(prevMonday)}
        nextWeekYmd={toYmdUtc(nextMonday)}
        country={country}
      />
    </div>
  );
}
