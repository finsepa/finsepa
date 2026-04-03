import Link from "next/link";
import { SCREENER_INDICES_HREF } from "@/lib/screener/screener-market-url";
import { formatIndexValue, getIndexDisplayMeta, getIndicesTop10 } from "@/lib/market/indices-top10";
import { isSingleAssetMode } from "@/lib/features/single-asset";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

export default async function IndexSymbolPage({ params }: PageProps) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim();

  if (isSingleAssetMode()) {
    return (
      <div className="px-9 py-6 text-[#71717A]">Temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const meta = getIndexDisplayMeta(symbol);
  const rows = await getIndicesTop10();
  const live = rows.find((r) => r.symbol.toUpperCase() === symbol.toUpperCase());

  const title = meta?.name ?? live?.name ?? symbol;
  const displayValue = live != null ? formatIndexValue(live.value) : "—";

  return (
    <div className="px-9 py-8">
      <div className="mb-6 flex items-center gap-1 text-[14px] text-[#71717A]">
        <Link href={SCREENER_INDICES_HREF} className="transition-colors hover:text-[#09090B]">
          Markets
        </Link>
        <span>/</span>
        <span className="font-medium text-[#09090B]">Indices</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-[22px] font-semibold leading-8 text-[#09090B]">{title}</h1>
        <p className="text-[14px] font-medium text-[#71717A]">{symbol}</p>
        <p className="pt-2 text-[28px] font-semibold tabular-nums text-[#09090B]">{displayValue}</p>
        <p className="text-[12px] text-[#71717A]">Last update from markets data</p>
      </div>

      <p className="mt-8 max-w-md text-[14px] leading-6 text-[#71717A]">
        Index detail view uses the same benchmark list as the markets screener. For full context, open the{" "}
        <Link
          href={SCREENER_INDICES_HREF}
          className="font-medium text-[#09090B] underline decoration-[#E4E4E7] underline-offset-4"
        >
          screener
        </Link>
        .
      </p>
    </div>
  );
}
