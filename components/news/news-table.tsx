"use client";

import type { NewsItem } from "@/lib/news/news-types";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { CompanyLogo } from "@/components/screener/company-logo";

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

const colLayoutDesktop = "sm:grid-cols-[120px_3fr_1.5fr_1fr] sm:gap-x-2";
const colLayoutMobile = "grid-cols-[3fr_1.2fr_1fr] gap-x-2";

export function NewsTable({ items }: { items: NewsItem[] }) {
  return (
    <div className="overflow-hidden">
      <div
        className={`grid ${colLayoutMobile} ${colLayoutDesktop} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3 text-[14px] font-medium leading-5 text-[#71717A] [&>div]:text-left`}
      >
        <div className="hidden sm:block">Time</div>
        <div>Headline</div>
        <div>Asset</div>
        <div>Source</div>
      </div>

      {items.map((n) => {
        const row = (
          <div
            className={`group grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[56px] items-center border-b border-[#E4E4E7] px-4 last:border-b-0 transition-colors duration-75 ${
              n.url ? "hover:bg-neutral-50" : ""
            }`}
          >
            <div className="hidden text-[13px] leading-5 text-[#71717A] tabular-nums sm:block">
              {formatTime(n.publishedAt)}
            </div>
            <div className="min-w-0 pr-3">
              <div className="text-[12px] leading-4 text-[#71717A] tabular-nums sm:hidden">
                {formatTime(n.publishedAt)}
              </div>
              <div className="truncate text-[14px] font-semibold leading-5 text-[#0F0F0F]">{n.title}</div>
            </div>
            <div className="min-w-0 pr-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0">
                  <CompanyLogo
                    name={n.assetLabel || n.assetSymbol}
                    symbol={n.assetSymbol}
                    logoUrl={
                      n.assetType === "crypto"
                        ? getCryptoLogoUrl(n.assetSymbol)
                        : logoDevStockLogoUrl(n.assetSymbol) || ""
                    }
                    size="xs"
                  />
                </span>
                <span className="inline-flex h-6 max-w-full items-center rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-semibold leading-4 text-[#0F0F0F] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
                  <span className="truncate">{n.assetSymbol}</span>
                </span>
              </div>
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
      <div
        className={`grid ${colLayoutMobile} ${colLayoutDesktop} items-center border-t border-b border-[#E4E4E7] bg-white px-4 py-3`}
      >
        <div className="hidden h-3 w-16 rounded bg-[#E4E4E7] sm:block" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 w-16 rounded bg-[#E4E4E7]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid ${colLayoutMobile} ${colLayoutDesktop} min-h-[56px] items-center border-b border-[#E4E4E7] px-4`}
        >
          <div className="hidden h-3 w-20 rounded bg-[#E4E4E7] sm:block" />
          <div className="h-3 w-[70%] rounded bg-[#E4E4E7]" />
          <div className="h-3 w-[55%] rounded bg-[#E4E4E7]" />
          <div className="h-3 w-16 rounded bg-[#E4E4E7]" />
        </div>
      ))}
    </div>
  );
}

