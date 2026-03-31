"use client";

import type { NewsItem } from "@/lib/news/news-types";

function formatTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "-";
  const d = new Date(t);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const colLayout = "grid-cols-[120px_3fr_1.5fr_1fr] gap-x-2";

export function NewsTable({ items }: { items: NewsItem[] }) {
  return (
    <div className="overflow-hidden">
      <div
        className={`grid ${colLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-semibold leading-5 text-[#71717A] [&>div]:text-left`}
      >
        <div>Time</div>
        <div>Headline</div>
        <div>Asset</div>
        <div>Source</div>
      </div>

      {items.map((n) => {
        const row = (
          <div
            className={`group grid ${colLayout} min-h-[56px] items-center border-b border-[#E4E4E7] px-4 last:border-b-0 transition-colors duration-75 ${
              n.url ? "hover:bg-neutral-50" : ""
            }`}
          >
            <div className="text-[13px] leading-5 text-[#71717A] tabular-nums">{formatTime(n.publishedAt)}</div>
            <div className="min-w-0 pr-3">
              <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{n.title}</div>
            </div>
            <div className="min-w-0 pr-3">
              <div className="truncate text-[14px] font-semibold leading-5 text-[#09090B]">{n.assetLabel}</div>
              <div className="truncate text-[12px] leading-4 text-[#71717A]">{n.assetSymbol}</div>
            </div>
            <div className="text-[13px] leading-5 text-[#71717A]">{n.source}</div>
          </div>
        );

        if (!n.url) return <div key={n.id}>{row}</div>;
        return (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            aria-label={`Open article: ${n.title}`}
          >
            {row}
          </a>
        );
      })}
    </div>
  );
}

export function NewsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className={`grid ${colLayout} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-16 rounded bg-[#E4E4E7]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`grid ${colLayout} min-h-[56px] items-center border-b border-[#E4E4E7] px-4`}>
          <div className="h-3 w-20 rounded bg-[#E4E4E7]" />
          <div className="h-3 w-[70%] rounded bg-[#E4E4E7]" />
          <div className="h-3 w-[55%] rounded bg-[#E4E4E7]" />
          <div className="h-3 w-16 rounded bg-[#E4E4E7]" />
        </div>
      ))}
    </div>
  );
}

