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
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "-";
  const d = new Date(t);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function NewsCards({ items }: { items: NewsItem[] }) {
  return (
    <div className="bg-white">
      {items.map((n, idx) => {
        const logoUrl =
          n.assetType === "crypto" ? getCryptoLogoUrl(n.assetSymbol) : logoDevStockLogoUrl(n.assetSymbol) || "";

        const content = (
          <div className="px-0 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-[#71717A]">
              <span className="tabular-nums">
                {formatTime(n.publishedAt)} · {formatDate(n.publishedAt)}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <CompanyLogo
                  name={n.assetLabel || n.assetSymbol}
                  symbol={n.assetSymbol}
                  logoUrl={logoUrl}
                  size="xs"
                />
                <span className="inline-flex h-6 max-w-[140px] items-center rounded-md border border-[#E4E4E7] bg-white px-2 text-[12px] font-semibold leading-4 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)]">
                  <span className="truncate">{n.assetSymbol}</span>
                </span>
              </span>
              <span aria-hidden>·</span>
              <span className="min-w-0 truncate">{n.source}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-[16px] font-semibold leading-6 text-[#09090B]">
              {n.title}
            </div>
          </div>
        );

        const row = <div key={n.id}>{content}</div>;

        if (!n.url) return row;
        return (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            aria-label={`Open article: ${n.title}`}
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}

