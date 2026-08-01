"use client";

import type { NewsItem } from "@/lib/news/news-types";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { NewsSourceLogo } from "@/components/news/news-source-logo";
import { CompanyLogo } from "@/components/screener/company-logo";
import {
  DEFAULT_TABLE_ROW_HOVER_PAD_CLASS,
  SCREENER_TABLE_DATA_ROW_CLASS,
  SCREENER_TABLE_HEADER_STICKY_CLASS,
  SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
  SCREENER_TABLE_ROUNDED_HEADER_CLASS,
  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
  SCREENER_TABLE_STROKE_INSET_CLASS,
  ScreenerTableScroll,
  TABLE_START_ALIGNED_PAD_CLASS,
} from "@/components/screener/screener-table-scroll";
import { cn } from "@/lib/utils";

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

const NEWS_GRID =
  "grid w-full min-w-0 items-center gap-x-2 grid-cols-[3fr_1.2fr_1fr] sm:grid-cols-[120px_3fr_1.5fr_1fr]";

function NewsRowCells({ item }: { item: NewsItem }) {
  return (
    <>
      <div
        className={cn(
          "hidden text-[14px] font-medium leading-5 text-fg-muted tabular-nums sm:block",
          TABLE_START_ALIGNED_PAD_CLASS,
        )}
      >
        {formatTime(item.publishedAt)}
      </div>
      <div className={cn("min-w-0 pr-3", "max-sm:pl-3 sm:pl-0")}>
        <div className="text-[14px] font-medium leading-5 text-fg-muted tabular-nums sm:hidden">
          {formatTime(item.publishedAt)}
        </div>
        <div className="truncate text-[14px] font-semibold leading-5 text-fg">{item.title}</div>
      </div>
      <div className="min-w-0 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">
            <CompanyLogo
              name={item.assetLabel || item.assetSymbol}
              symbol={item.assetSymbol}
              logoUrl={
                item.assetType === "crypto"
                  ? getCryptoLogoUrl(item.assetSymbol)
                  : logoDevStockLogoUrl(item.assetSymbol) || ""
              }
              size="xs"
            />
          </span>
          <span className="inline-flex h-6 max-w-full items-center rounded-md border border-stroke-muted bg-surface px-2 text-[12px] font-semibold leading-4 text-fg shadow-[0px_1px_2px_0px_rgba(var(--fs-shadow-rgb),var(--fs-shadow-a-04))]">
            <span className="truncate">{item.assetSymbol}</span>
          </span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-fg-muted">
        {item.url ? <NewsSourceLogo articleUrl={item.url} /> : null}
        <span className="truncate font-medium text-fg">{item.source}</span>
      </div>
    </>
  );
}

export function NewsTable({ items }: { items: NewsItem[] }) {
  return (
    <ScreenerTableScroll>
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
          <div
            className={cn(
              NEWS_GRID,
              "min-h-[44px] text-[14px] font-medium leading-5 text-fg-muted [&>div]:text-left",
            )}
          >
            <div className={cn("hidden sm:block", TABLE_START_ALIGNED_PAD_CLASS)}>Time</div>
            <div className={cn("max-sm:pl-3 sm:pl-0")}>Headline</div>
            <div>Asset</div>
            <div>Source</div>
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>

      {items.map((n, i) => {
        const showDivider = i < items.length - 1;
        const cells = (
          <>
            <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
              <div
                className={cn(
                  NEWS_GRID,
                  "min-h-[56px]",
                  SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
                )}
              >
                <NewsRowCells item={n} />
              </div>
            </div>
            {showDivider ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
          </>
        );

        if (!n.url) {
          return (
            <div key={n.id} className={SCREENER_TABLE_DATA_ROW_CLASS}>
              {cells}
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
            {cells}
          </a>
        );
      })}
    </ScreenerTableScroll>
  );
}

export function NewsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <ScreenerTableScroll>
      <div
        className={cn(
          SCREENER_TABLE_HEADER_STICKY_CLASS,
          SCREENER_TABLE_ROUNDED_HEADER_CLASS,
          SCREENER_TABLE_HEADER_STROKE_HOVER_CLASS,
          "md:border-b-0",
        )}
      >
        <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
          <div className={cn(NEWS_GRID, "min-h-[44px] items-center")}>
            <div className="hidden h-3 w-16 rounded bg-stroke sm:block" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3 w-16 rounded bg-stroke" />
            ))}
          </div>
        </div>
        <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={SCREENER_TABLE_DATA_ROW_CLASS}>
          <div className={DEFAULT_TABLE_ROW_HOVER_PAD_CLASS}>
            <div
              className={cn(
                NEWS_GRID,
                "min-h-[56px]",
                SCREENER_TABLE_ROW_HOVER_SURFACE_CLASS,
              )}
            >
              <div className="hidden h-3 w-20 rounded bg-stroke sm:block" />
              <div className="h-3 w-[70%] rounded bg-stroke" />
              <div className="h-3 w-[55%] rounded bg-stroke" />
              <div className="h-3 w-16 rounded bg-stroke" />
            </div>
          </div>
          {i < rows - 1 ? <div className={SCREENER_TABLE_STROKE_INSET_CLASS} aria-hidden /> : null}
        </div>
      ))}
    </ScreenerTableScroll>
  );
}
