import Link from "next/link";

import { getMarketNewsTabPage, type MarketNewsTab } from "@/lib/news/market-news";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import { NewsTable } from "@/components/news/news-table";
import { NewsCards } from "@/components/news/news-cards";
import { ScreenerPaginationLinks } from "@/components/ui/screener-pagination-links";
import { Search } from "@/lib/icons";

function toInt(v: string | null | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export async function MarketNewsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isSingleAssetMode()) {
    return <div className="px-4 py-4 text-[#71717A] sm:px-9 sm:py-6">Temporarily unavailable in NVDA-only mode.</div>;
  }

  const sp = (await searchParams) ?? {};
  const pageRaw = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : undefined;
  const qRaw = typeof sp.q === "string" ? sp.q : Array.isArray(sp.q) ? sp.q[0] : undefined;
  const tabRaw = typeof sp.tab === "string" ? sp.tab : Array.isArray(sp.tab) ? sp.tab[0] : undefined;

  const page = Math.max(1, toInt(pageRaw, 1));
  const q = (qRaw ?? "").trim();
  const tab = (tabRaw === "stocks" || tabRaw === "crypto" || tabRaw === "market" ? tabRaw : "market") as MarketNewsTab;

  const { items, total, pageSize } = await getMarketNewsTabPage({ tab, page, q });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, page));

  const baseParams = new URLSearchParams();
  baseParams.set("tab", tab);
  if (q) baseParams.set("q", q);

  function pageHref(next: number) {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(next));
    return `/news?${p.toString()}`;
  }

  const tabs: { id: MarketNewsTab; label: string }[] = [
    { id: "market", label: "Market" },
    { id: "stocks", label: "Stocks" },
    { id: "crypto", label: "Crypto" },
  ];

  const title = tab === "market" ? "Market" : tab === "stocks" ? "Stocks" : "Crypto";

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-4 border-b border-[#E4E4E7]">
        <div className="flex min-w-0 items-end gap-5">
          {tabs.map((t) => {
            const active = t.id === tab;
            const p = new URLSearchParams();
            p.set("tab", t.id);
            if (q) p.set("q", q);
            p.set("page", "1");
            return (
              <Link
                key={t.id}
                href={`/news?${p.toString()}`}
                className={`relative py-2 text-[14px] font-medium leading-6 transition-colors duration-100 ${
                  active
                    ? "text-[#09090B] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#09090B] after:content-['']"
                    : "text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
        <h1 className="min-w-0 shrink-0 text-[22px] font-semibold leading-8 tracking-tight text-[#09090B]">
          {title}
        </h1>

        <form className="min-w-0 w-full max-w-[180px] flex-1 sm:max-w-[320px]" action="/news">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="tab" value={tab} />
          <div className="relative block w-full max-w-full">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#09090B]"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search..."
              className="h-9 w-full min-w-0 rounded-lg bg-[#F4F4F5] py-2 pl-9 pr-3 text-sm text-[#09090B] placeholder:text-[#A1A1AA] outline-none transition-all duration-100 hover:bg-[#EBEBEB] focus:ring-2 focus:ring-[#09090B]/10"
              aria-label="Search news"
            />
          </div>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-sm text-[#71717A]">
          No news yet
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            <NewsCards items={items} />
          </div>
          <div className="hidden sm:block">
            <NewsTable items={items} />
          </div>
        </>
      )}

      <div className="pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-0">
        <ScreenerPaginationLinks
          page={safePage}
          totalPages={totalPages}
          hrefForPage={pageHref}
          aria-label="News pages"
        />
      </div>
    </div>
  );
}

