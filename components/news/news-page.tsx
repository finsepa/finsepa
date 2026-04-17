"use client";

import { useEffect, useMemo, useState } from "react";

import type { NewsItem, NewsTab } from "@/lib/news/news-types";
import { NewsTable, NewsTableSkeleton } from "@/components/news/news-table";

const tabs: { id: NewsTab; label: string }[] = [
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "indices", label: "Indices" },
];

export function NewsPage() {
  const [tab, setTab] = useState<NewsTab>("stocks");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, page));

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setItems(null);
      try {
        const res = await fetch(`/api/news?tab=${encodeURIComponent(tab)}&page=${safePage}`);
        if (!res.ok) {
          if (!cancelled) {
            setItems([]);
            setTotal(0);
            setError("Failed to load news.");
          }
          return;
        }
        const json = (await res.json()) as { items?: NewsItem[]; total?: number };
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
        setTotal(typeof json.total === "number" && Number.isFinite(json.total) ? json.total : 0);
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError("Failed to load news.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, safePage]);

  const showEmpty = useMemo(() => !loading && !error && items != null && items.length === 0, [loading, error, items]);

  return (
    <div className="min-w-0 px-4 py-4 sm:px-9 sm:py-6">
      <div className="mb-6 flex items-end justify-between border-b border-[#E4E4E7]">
        <div className="flex items-end gap-5">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative py-2 text-[14px] leading-6 font-medium transition-colors duration-100 ${
                  active
                    ? "text-[#09090B] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#09090B] after:content-['']"
                    : "text-[#71717A] hover:text-[#09090B]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && !items ? <NewsTableSkeleton rows={25} /> : null}

      {!loading && error ? (
        <div className="rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-4 text-sm text-[#71717A]">
          {error}
        </div>
      ) : null}

      {items ? <NewsTable items={items} /> : null}

      {showEmpty ? (
        <div className="mt-4 rounded-[12px] border border-[#E4E4E7] bg-white px-4 py-6 text-sm text-[#71717A]">
          No news yet
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1 || loading}
          className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>

        <div className="text-sm font-medium text-[#71717A]">
          Page <span className="font-semibold text-[#09090B]">{safePage}</span> of{" "}
          <span className="font-semibold text-[#09090B]">{totalPages}</span>
        </div>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages || loading}
          className="h-9 rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-sm font-semibold text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  );
}

