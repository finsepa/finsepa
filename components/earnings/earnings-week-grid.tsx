"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { EarningsPreviewModal } from "@/components/earnings/earnings-preview-modal";
import { PostMarketEarningsIcon } from "@/components/stock/post-market-earnings-icon";
import { PreMarketEarningsIcon } from "@/components/stock/pre-market-earnings-icon";
import { CompanyLogo } from "@/components/screener/company-logo";
import type {
  EarningsCalendarItem,
  EarningsDayColumn,
  EarningsReportTiming,
  EarningsTimingBucket,
  EarningsWeekPayload,
} from "@/lib/market/earnings-calendar-types";
import { prefetchStockEarningsTabPayload } from "@/lib/market/stock-earnings-tab-client";
import { cn } from "@/lib/utils";

/** Match server `earningsUniverseKey` so preview + overflow merges dedupe the same symbol. */
function canonicalEarningsTicker(raw: string): string {
  const t = raw
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/\//g, ".")
    .replace(/-/g, ".");

  // Collapse share classes / series into one (e.g. BRK.A / BRK.B → BRK).
  // Heuristic: treat `<BASE>.<SUFFIX>` as a class when BASE is normal equity ticker.
  const m = /^([A-Z]{1,10})\.([A-Z0-9]{1,3})$/.exec(t);
  if (m) return m[1]!;

  return t;
}

/** Raw upper symbol after exchange normalization (before base-only collapse). */
function normalizedEarningsSymbol(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.US$/i, "")
    .replace(/\//g, ".")
    .replace(/-/g, ".");
}

/**
 * One tile per issuer per day+timing.
 * Always key by canonical base symbol (AGM.A / AGM.PD / AGM → AGM) so provider name quirks can’t split rows.
 * Different tickers that only share a company name but are different issuers stay separate (e.g. different bases).
 */
function earningsGridDedupeKey(it: EarningsCalendarItem): string {
  const base = canonicalEarningsTicker(it.ticker);
  return `${it.reportDate}|b:${base}|${it.timing}`;
}

/** Lower score wins — pick a “main” listing when duplicates collapse (e.g. AGM.A over AGM.PD). */
function earningsItemPreferenceScore(it: EarningsCalendarItem): number {
  const raw = normalizedEarningsSymbol(it.ticker);
  let s = 0;
  // Common “primary” common share
  if (/\.A$/.test(raw)) s -= 200;
  // Deprioritize preferred / depositary series
  if (/\.(PD|PR|PRB|PRC|PRE|PF|PFD)$/i.test(raw)) s += 120;
  if (/\.P$/.test(raw)) s += 80;
  const rank = it.screenerRank;
  if (rank != null) s += rank;
  // Tie-break: shorter symbol, then lexicographic
  s += raw.length * 0.001;
  return s;
}

function pickPreferredEarningsItem(a: EarningsCalendarItem, b: EarningsCalendarItem): EarningsCalendarItem {
  const sa = earningsItemPreferenceScore(a);
  const sb = earningsItemPreferenceScore(b);
  if (sa !== sb) return sa < sb ? a : b;
  const ca = normalizedEarningsSymbol(a.ticker);
  const cb = normalizedEarningsSymbol(b.ticker);
  return ca.localeCompare(cb) <= 0 ? a : b;
}

function dedupeEarningsCalendarItems(items: readonly EarningsCalendarItem[]): EarningsCalendarItem[] {
  const byKey = new Map<string, EarningsCalendarItem>();
  for (const it of items) {
    const k = earningsGridDedupeKey(it);
    const prev = byKey.get(k);
    byKey.set(k, prev ? pickPreferredEarningsItem(prev, it) : it);
  }
  return [...byKey.values()];
}

function todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday `YYYY-MM-DD` (UTC) for the week containing today — matches `mondayOfWeekUtc` + `toYmdUtc` on the server. */
function currentWeekMondayYmdUtc(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Same 20×20 Figma asset as the stock earnings card. */
const EARNINGS_CALENDAR_BMO_ICON_PX = 20;

function EarningsTimingSectionHeading({ timing, title }: { timing: EarningsReportTiming; title: string }) {
  if (timing === "bmo") {
    return (
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-5 w-5 shrink-0 flex-none items-center justify-center overflow-hidden"
          title="Before market"
          role="img"
          aria-label="Before market"
        >
          <PreMarketEarningsIcon size={EARNINGS_CALENDAR_BMO_ICON_PX} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717A]">{title}</p>
      </div>
    );
  }

  if (timing === "amc") {
    return (
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-5 w-5 shrink-0 flex-none items-center justify-center overflow-hidden"
          title="After market"
          role="img"
          aria-label="After market"
        >
          <PostMarketEarningsIcon size={20} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717A]">{title}</p>
      </div>
    );
  }

  /* Time TBD — 20×20 px badge (same footprint as pre/post Figma icons), Lucide clock centered inside. */
  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className="inline-flex h-5 w-5 shrink-0 flex-none items-center justify-center overflow-hidden rounded-full bg-[#F4F4F5]"
        title="Time TBD"
        role="img"
        aria-label="Time TBD"
      >
        <Clock className="text-[#71717A]" size={12} strokeWidth={2} />
      </span>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#71717A]">{title}</p>
    </div>
  );
}

function EarningsTimingBlock({
  title,
  bucket,
  timing,
  weekMondayYmd,
  dayYmd,
  onOpenCard,
  showTopRule,
}: {
  title: string;
  bucket: EarningsTimingBucket;
  timing: EarningsReportTiming;
  weekMondayYmd: string;
  dayYmd: string;
  onOpenCard: (item: EarningsCalendarItem) => void;
  /** Extra top spacing when this block follows another timing group in the same day. */
  showTopRule?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [extraItems, setExtraItems] = useState<EarningsCalendarItem[]>([]);
  const [loadingOverflow, setLoadingOverflow] = useState(false);
  const [overflowError, setOverflowError] = useState(false);
  const [loadedOverflowCount, setLoadedOverflowCount] = useState(0);

  const hasPreview = bucket.items.length > 0;
  const hasOverflowOnly = !hasPreview && bucket.overflowCount > 0;

  const gridItems = useMemo(() => {
    const merged = expanded ? [...bucket.items, ...extraItems] : [...bucket.items];
    return dedupeEarningsCalendarItems(merged);
  }, [expanded, bucket.items, extraItems]);

  const remainingOverflow = Math.max(0, bucket.overflowCount - loadedOverflowCount);
  const showExpandTile = remainingOverflow > 0;
  const showCollapse = expanded && (bucket.overflowCount > 0 || extraItems.length > 0);

  if (!hasPreview && !hasOverflowOnly) return null;

  const loadOverflowAndExpand = async () => {
    setLoadingOverflow(true);
    setOverflowError(false);
    try {
      const qs = new URLSearchParams({
        week: weekMondayYmd,
        day: dayYmd,
        timing,
        offset: String(loadedOverflowCount),
        limit: "10",
      });
      const res = await fetch(`/api/earnings/week-bucket?${qs.toString()}`);
      if (!res.ok) throw new Error("overflow");
      const body: unknown = await res.json();
      const raw = body && typeof body === "object" && "items" in body ? (body as { items: unknown }).items : null;
      const items = Array.isArray(raw) ? (raw as EarningsCalendarItem[]) : [];
      if (items.length > 0) {
        setExtraItems((prev) => [...prev, ...items]);
        setLoadedOverflowCount((n) => n + items.length);
      }
      setExpanded(true);
    } catch {
      setOverflowError(true);
    } finally {
      setLoadingOverflow(false);
    }
  };

  return (
    <div className={cn(showTopRule ? "mt-3" : "")}>
      <EarningsTimingSectionHeading timing={timing} title={title} />
      <div className="grid grid-cols-2 gap-2">
        {gridItems.map((item, index) => (
          <EarningsCard
            key={`${earningsGridDedupeKey(item)}-${index}`}
            ticker={item.ticker}
            companyName={item.companyName}
            logoUrl={item.logoUrl}
            onOpen={() => onOpenCard(item)}
          />
        ))}
        {showExpandTile ? (
          <button
            type="button"
            disabled={loadingOverflow}
            onClick={() => void loadOverflowAndExpand()}
            className="flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFAFA] px-2 py-2.5 text-center shadow-[0px_1px_2px_0px_rgba(10,10,10,0.04)] transition-colors hover:border-[#2563EB]/35 hover:bg-[#EFF6FF] disabled:opacity-60"
            aria-expanded={expanded}
            aria-busy={loadingOverflow}
            aria-label={`Show ${Math.min(10, remainingOverflow)} more in ${title}`}
          >
            {loadingOverflow ? (
              <span className="text-[12px] font-medium text-[#71717A]">Loading…</span>
            ) : overflowError ? (
              <span className="text-[12px] font-medium text-[#DC2626]">Tap to retry</span>
            ) : (
              <span className="text-[15px] font-semibold tabular-nums leading-5 text-[#2563EB]">
                +{remainingOverflow}
              </span>
            )}
          </button>
        ) : null}
      </div>
      {showCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full rounded-[10px] border border-[#E4E4E7] bg-white py-2 text-[13px] font-medium leading-5 text-[#2563EB] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}

function EarningsDayColumnBody({
  day,
  weekMondayYmd,
  onOpenCard,
}: {
  day: EarningsDayColumn;
  weekMondayYmd: string;
  onOpenCard: (item: EarningsCalendarItem) => void;
}) {
  const { date, beforeMarket, afterMarket, timeTbd } = day;
  const totalSignals =
    beforeMarket.items.length +
    beforeMarket.overflowCount +
    afterMarket.items.length +
    afterMarket.overflowCount +
    timeTbd.items.length +
    timeTbd.overflowCount;

  if (totalSignals === 0) {
    return <p className="text-[12px] leading-4 text-[#A1A1AA]">No reports</p>;
  }

  const beforeHasBody = beforeMarket.items.length > 0 || beforeMarket.overflowCount > 0;

  return (
    <div className="min-w-0">
      <EarningsTimingBlock
        title="Before market"
        bucket={beforeMarket}
        timing="bmo"
        weekMondayYmd={weekMondayYmd}
        dayYmd={date}
        onOpenCard={onOpenCard}
      />
      <EarningsTimingBlock
        title="After market"
        bucket={afterMarket}
        timing="amc"
        weekMondayYmd={weekMondayYmd}
        dayYmd={date}
        onOpenCard={onOpenCard}
        showTopRule={beforeHasBody}
      />
      <EarningsTimingBlock
        title="Time TBD"
        bucket={timeTbd}
        timing="unknown"
        weekMondayYmd={weekMondayYmd}
        dayYmd={date}
        onOpenCard={onOpenCard}
        showTopRule={
          beforeMarket.items.length +
            beforeMarket.overflowCount +
            afterMarket.items.length +
            afterMarket.overflowCount >
          0
        }
      />
    </div>
  );
}

function EarningsCard({
  ticker,
  companyName,
  logoUrl,
  onOpen,
}: {
  ticker: string;
  companyName: string;
  logoUrl: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={() => prefetchStockEarningsTabPayload(ticker, true)}
      onFocus={() => prefetchStockEarningsTabPayload(ticker, true)}
      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-2 py-2.5 text-center shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-colors hover:bg-[#FAFAFA]"
    >
      <CompanyLogo name={companyName || ticker} logoUrl={logoUrl} symbol={ticker} size="40" />
      <span className="w-full min-w-0 truncate text-[13px] font-semibold leading-5 tabular-nums text-[#09090B]">
        {ticker}
      </span>
    </button>
  );
}

const navBtnClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#09090B] transition-colors hover:bg-[#F4F4F5]";

/** Matches `topbarSquircleIconClass` in `components/design-system/topbar-control-classes.ts`. */
const todayBtnClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white px-3 text-[14px] font-medium leading-5 text-[#09090B] shadow-[0px_1px_2px_0px_rgba(10,10,10,0.06)] transition-all duration-100 hover:bg-[#F4F4F5]";

/**
 * Weekly earnings calendar — layout aligned with Figma (Web App Design, Earnings Calendar week view).
 * Weeks with no events still show the five-column grid; empty days display “No reports”.
 */
export function EarningsWeekGrid({
  data,
  prevWeekYmd,
  nextWeekYmd,
}: {
  data: EarningsWeekPayload;
  prevWeekYmd: string;
  nextWeekYmd: string;
}) {
  const [previewItem, setPreviewItem] = useState<EarningsCalendarItem | null>(null);
  const todayKey = useMemo(() => todayYmdUtc(), []);
  const thisWeekMondayYmd = useMemo(() => currentWeekMondayYmdUtc(), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[16px] font-normal leading-6 text-[#71717A]">Earnings Calendar</p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-semibold leading-9 tracking-tight text-[#09090B]">{data.weekLabel}</h1>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/earnings?week=${encodeURIComponent(prevWeekYmd)}`}
                prefetch={false}
                className={navBtnClass}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <Link
                href={`/earnings?week=${encodeURIComponent(thisWeekMondayYmd)}`}
                prefetch={false}
                className={todayBtnClass}
                aria-label="Go to this week"
                aria-current={data.weekMondayYmd === thisWeekMondayYmd ? "page" : undefined}
              >
                Today
              </Link>
              <Link
                href={`/earnings?week=${encodeURIComponent(nextWeekYmd)}`}
                prefetch={false}
                className={navBtnClass}
                aria-label="Next week"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Desktop: weekday strip + today indicator — matches Figma */}
        <div className="relative hidden border-b border-t border-[#E4E4E7] pt-2 pb-0 md:block">
          <div className="flex w-full gap-6 text-center text-[18px] leading-7">
            {data.days.map((day: EarningsDayColumn) => {
              const isToday = day.date === todayKey;
              return (
                <div
                  key={day.date}
                  className={`flex min-h-px min-w-0 flex-1 flex-wrap items-center justify-center gap-1 py-1 ${
                    isToday ? "text-[#DC2626]" : "text-[#09090B]"
                  }`}
                >
                  <span className="font-normal">{day.weekdayLabel}</span>
                  <span className="font-semibold tabular-nums">{day.dayNumber}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex w-full gap-6" aria-hidden>
            {data.days.map((day: EarningsDayColumn) => {
              const isToday = day.date === todayKey;
              return (
                <div key={`u-${day.date}`} className="min-h-px min-w-0 flex-1">
                  <div className={`h-0.5 w-full ${isToday ? "bg-[#DC2626]" : "bg-transparent"}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1 md:mx-0 md:overflow-visible">
          <div className="flex min-h-[min(60vh,716px)] min-w-0 md:grid md:grid-cols-5 md:gap-0">
            {data.days.map((day: EarningsDayColumn, i: number) => (
              <div
                key={day.date}
                className={`flex w-[min(100%,220px)] shrink-0 flex-col border-[#E4E4E7] px-2 py-3 md:w-auto md:border-r md:px-3 md:py-4 ${
                  i === data.days.length - 1 ? "md:border-r-0" : ""
                }`}
              >
                <div className="mb-3 border-b border-[#E4E4E7] pb-2 md:hidden">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">
                    {day.weekdayLabel}
                  </div>
                  <div
                    className={`text-[15px] font-semibold tabular-nums ${
                      day.date === todayKey ? "text-[#DC2626]" : "text-[#09090B]"
                    }`}
                  >
                    {day.dayNumber}
                  </div>
                </div>
                <EarningsDayColumnBody
                  key={`${data.weekMondayYmd}-${day.date}`}
                  day={day}
                  weekMondayYmd={data.weekMondayYmd}
                  onOpenCard={setPreviewItem}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <EarningsPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
