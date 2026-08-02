"use client";

import type { NewsItem } from "@/lib/news/news-types";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

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

function NewsCardBody({ item }: { item: NewsItem }) {
  const logoUrl =
    item.assetType === "crypto"
      ? getCryptoLogoUrl(item.assetSymbol)
      : logoDevStockLogoUrl(item.assetSymbol) || "";

  return (
    <div className={cn("py-3", SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium leading-5 text-fg-muted">
        <span className="tabular-nums">
          {formatTime(item.publishedAt)} · {formatDate(item.publishedAt)}
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <CompanyLogo
            name={item.assetLabel || item.assetSymbol}
            symbol={item.assetSymbol}
            logoUrl={logoUrl}
            size="xs"
          />
          <span className="inline-flex h-6 max-w-[140px] items-center rounded-md border border-stroke bg-surface px-2 text-[12px] font-semibold leading-4 text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
            <span className="truncate">{item.assetSymbol}</span>
          </span>
        </span>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate">{item.source}</span>
      </div>
      <div className="mt-2 line-clamp-2 text-[16px] font-semibold leading-6 text-fg">{item.title}</div>
    </div>
  );
}

/** Mobile news list — same card chrome, row hover, and 16px inset strokes as screener tables. */
export function NewsCards({ items }: { items: NewsItem[] }) {
  return (
    <ScreenerTableScroll minWidthClassName="min-w-0">
      <div className="bg-surface">
        {items.map((n, idx) => {
          const showDivider = idx < items.length - 1;
          const body = (
            <>
              <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
                <NewsCardBody item={n} />
              </div>
              {showDivider ? (
                <div className={cn(SCREENER_TABLE_STROKE_INSET_CLASS, "md:hidden")} aria-hidden />
              ) : null}
            </>
          );

          if (!n.url) {
            return (
              <div key={n.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
                {body}
              </div>
            );
          }

          return (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(SCREENER_TABLE_DATA_ROW_CLASS, "block")}
              aria-label={`Open article: ${n.title}`}
            >
              {body}
            </a>
          );
        })}
      </div>
    </ScreenerTableScroll>
  );
}
