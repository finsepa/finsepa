"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { WatchlistStarButton } from "@/components/watchlist/watchlist-star-button";

export function StockHeader({ ticker }: { ticker: string }) {
  const meta = getStockDetailMetaFromTicker(ticker);
  const symbol = meta.ticker;
  const titleName = meta.name;

  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // Best-effort: if this ticker is in the top-10 universe, reuse the existing batch API.
        const res = await fetch("/api/screener/top-ten", { cache: "no-store" });
        if (!res.ok) {
          if (!mounted) return;
          setPrice(null);
          setChangePct(null);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { rows?: Array<{ ticker: string; price: number; changePercent1D: number }> };
        const rows = Array.isArray(json.rows) ? json.rows : [];
        const match = rows.find((r) => r.ticker?.toUpperCase?.() === symbol);
        if (!mounted) return;
        setPrice(typeof match?.price === "number" ? match!.price : null);
        setChangePct(typeof match?.changePercent1D === "number" ? match!.changePercent1D : null);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setPrice(null);
        setChangePct(null);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  const derived = useMemo(() => {
    if (price == null || changePct == null) return { change: null, isPositive: true };
    const change = (price * changePct) / 100;
    return { change, isPositive: change >= 0 };
  }, [price, changePct]);

  return (
    <div className="space-y-3">
      {/* Row 1: Breadcrumb */}
      <div className="flex items-center">
        <div className="flex items-center gap-1 text-[14px] text-[#71717A]">
          <Link href="/screener" className="hover:text-[#09090B] transition-colors">Stocks</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#09090B] font-medium">{symbol}</span>
        </div>
      </div>

      {/* Row 2: Logo + Company info + Watchlist */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {/* Logo */}
          {meta.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote favicon with onError fallback in-browser
            <img
              src={meta.logoUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]"
              onError={(e) => {
                // If logo fails, hide image and rely on initials block below.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          {!meta.logoUrl ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F5] text-[#09090B] text-[18px] font-bold shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] border border-[#E4E4E7]">
              {meta.ticker.slice(0, 1)}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-7 text-[#09090B]">{titleName}</h1>
              <span className="text-[14px] font-medium text-[#71717A]">{symbol}</span>
            </div>
          </div>
        </div>

        <div className="group shrink-0">
          <WatchlistStarButton variant="detail" storageKey={symbol} label={symbol} />
        </div>
      </div>

      {/* Row 3: Price */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold leading-9 tabular-nums text-[#09090B]">
            {loading || price == null ? "—" : `$${price.toFixed(2)}`}
          </span>
          <span
            className={`text-[15px] font-medium tabular-nums ${
              derived.isPositive ? "text-[#16A34A]" : "text-[#DC2626]"
            }`}
          >
            {loading || derived.change == null || changePct == null
              ? "—"
              : `${derived.isPositive ? "+" : ""}${derived.change.toFixed(2)} (${derived.isPositive ? "+" : ""}${changePct.toFixed(2)}%)`}
          </span>
          <span className="text-[13px] text-[#71717A]">Past year</span>
        </div>
        <div className="mt-0.5 text-[12px] text-[#71717A]">
          {loading ? "Loading…" : "USD"}
        </div>
      </div>
    </div>
  );
}
