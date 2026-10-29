"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";

import {
  MOBILE_ELEVATED_CARD_CLASS,
  STOCK_OVERVIEW_SECTION_HEADING_CLASS,
} from "@/components/design-system/card-surface-styles";
import { SegmentedControl, type SegmentedControlOption } from "@/components/design-system";
import { CarouselArrowButton } from "@/components/portfolio-home/upcoming-earnings-carousel";
import { ChangeCaretIcon } from "@/components/screener/change-pct";
import { CompanyLogo } from "@/components/screener/company-logo";
import { SuperinvestorFollowStarToggle } from "@/components/superinvestors/superinvestor-follow-star-toggle";
import {
  FundRowAvatar,
  type SuperinvestorsFundRowModel,
} from "@/components/superinvestors/superinvestors-fund-table";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { resolveEquityLogoUrlFromListingTicker } from "@/lib/screener/resolve-equity-logo-url";
import { cn } from "@/lib/utils";

type SortKey = "size" | "performance" | "updated";

const SORT_OPTIONS: readonly SegmentedControlOption<SortKey>[] = [
  { value: "size", label: "Size" },
  { value: "performance", label: "1Y perf." },
  { value: "updated", label: "Latest" },
];

const EYEBROW_CLASS = "text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-fg-muted";
const STAT_VALUE_CLASS = "text-[16px] font-semibold leading-6 tabular-nums text-fg";
const STAT_LABEL_CLASS = "text-[12px] leading-4 text-fg-muted";

function compareRows(a: SuperinvestorsFundRowModel, b: SuperinvestorsFundRowModel, key: SortKey): number {
  if (key === "size") return b.totalValueUsd - a.totalValueUsd;
  if (key === "performance") {
    const av = a.bookReturnPct1y;
    const bv = b.bookReturnPct1y;
    if (av == null && bv == null) return b.totalValueUsd - a.totalValueUsd;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  }
  return (b.filingDate ?? "").localeCompare(a.filingDate ?? "");
}

function formatFiledDate(ymd: string | null, withYear: boolean): string {
  if (!ymd?.trim()) return "—";
  const d = parseISO(ymd.trim());
  if (!isValid(d)) return "—";
  return format(d, withYear ? "MMM d, yyyy" : "MMM d");
}

function changesLabel(count: number | undefined): string | null {
  if (count == null || count <= 0) return null;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "change" : "changes"}`;
}

function holdingSymbol(h: SuperinvestorsFundRowModel["topHoldings"][number]): string | null {
  return h.ticker?.trim() ? h.ticker.trim().toUpperCase() : null;
}

function PerfValue({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className={cn("tabular-nums text-fg-muted", className)}>—</span>;
  }
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular-nums", up ? "text-up" : "text-down", className)}>
      <ChangeCaretIcon direction={up ? "up" : "down"} size={12} />
      {Math.abs(pct).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}

function HoldingsLogoStack({ holdings }: { holdings: SuperinvestorsFundRowModel["topHoldings"] }) {
  const top = holdings.slice(0, 4);
  return (
    <div className="flex items-center">
      {top.map((h, i) => {
        const sym = holdingSymbol(h);
        return (
          <div
            key={`${sym ?? h.issuer}-${i}`}
            className="-ml-1.5 rounded-full ring-2 ring-[var(--fs-surface)] first:ml-0"
            style={{ zIndex: top.length - i }}
          >
            <CompanyLogo
              name={h.issuer}
              logoUrl={sym ? resolveEquityLogoUrlFromListingTicker(sym) : ""}
              symbol={sym ?? undefined}
              size="sm"
            />
          </div>
        );
      })}
    </div>
  );
}

function FeaturedFundCard({ row }: { row: SuperinvestorsFundRowModel }) {
  const changes = changesLabel(row.activityCount);
  return (
    <div className={cn(MOBILE_ELEVATED_CARD_CLASS, "group/card relative grid h-full gap-6 p-5 sm:p-6 lg:grid-cols-2 lg:gap-0")}>
      <div className="flex min-w-0 flex-col lg:pr-8">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-fg-muted">
            Most popular
          </span>
          <SuperinvestorFollowStarToggle profileHref={row.href} label={row.displayName} className="relative z-[1]" />
        </div>
        <Link href={row.href} className="mt-4 flex min-w-0 items-center gap-3 text-fg no-underline after:absolute after:inset-0 after:content-['']">
          <FundRowAvatar src={row.avatarSrc} displayName={row.displayName} className="h-12 w-12" />
          <span className="min-w-0">
            <span className="block truncate text-[22px] font-semibold leading-7 tracking-tight text-fg group-hover/card:underline">
              {row.displayName}
            </span>
            <span className="block text-[13px] leading-5 text-fg-muted">
              13F portfolio · {row.positionCount.toLocaleString("en-US")} positions
            </span>
          </span>
        </Link>
        <dl className="mt-auto flex flex-wrap gap-x-8 gap-y-3 pt-6">
          <div>
            <dt className="sr-only">Value</dt>
            <dd className={STAT_VALUE_CLASS}>{formatUsdCompact(row.totalValueUsd)}</dd>
            <dd className={STAT_LABEL_CLASS}>Value</dd>
          </div>
          <div>
            <dt className="sr-only">1-year performance</dt>
            <dd className={STAT_VALUE_CLASS}>
              <PerfValue pct={row.bookReturnPct1y} />
            </dd>
            <dd className={STAT_LABEL_CLASS}>1Y perf.</dd>
          </div>
          <div>
            <dt className="sr-only">Last filing</dt>
            <dd className={STAT_VALUE_CLASS}>{formatFiledDate(row.filingDate, true)}</dd>
            <dd className={STAT_LABEL_CLASS}>{changes ? `Filed · ${changes}` : "Filed"}</dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0 border-stroke-subtle lg:border-l lg:pl-8">
        <p className={EYEBROW_CLASS}>Top holdings</p>
        <ol className="mt-3 flex flex-col gap-2.5">
          {row.topHoldings.slice(0, 5).map((h, i) => {
            const sym = holdingSymbol(h);
            return (
              <li key={`${sym ?? h.issuer}-${i}`} className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-right text-[12px] tabular-nums text-fg-muted">{i + 1}</span>
                <CompanyLogo
                  name={h.issuer}
                  logoUrl={sym ? resolveEquityLogoUrlFromListingTicker(sym) : ""}
                  symbol={sym ?? undefined}
                  size="sm"
                />
                <span className="w-14 shrink-0 text-[14px] font-semibold leading-5 text-fg">{sym ?? "—"}</span>
                <span className="min-w-0 truncate text-[13px] leading-5 text-fg-muted">{h.issuer}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function FundCard({ row }: { row: SuperinvestorsFundRowModel }) {
  const changes = changesLabel(row.activityCount);
  return (
    <div className={cn(MOBILE_ELEVATED_CARD_CLASS, "group/card relative flex min-w-0 flex-col p-4 transition-colors hover:bg-surface-muted/40")}>
      <div className="flex items-start gap-3">
        <Link
          href={row.href}
          className="flex min-w-0 flex-1 items-center gap-3 text-fg no-underline after:absolute after:inset-0 after:content-['']"
        >
          <FundRowAvatar src={row.avatarSrc} displayName={row.displayName} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-5 text-fg group-hover/card:underline">
              {row.displayName}
            </span>
            <span className="block text-[12px] leading-4 text-fg-muted">
              Filed on {formatFiledDate(row.filingDate, true)}
            </span>
          </span>
        </Link>
        <SuperinvestorFollowStarToggle profileHref={row.href} label={row.displayName} className="relative z-[1] shrink-0" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <HoldingsLogoStack holdings={row.topHoldings} />
        <span className="text-[12px] leading-4 text-fg-muted">
          {row.positionCount.toLocaleString("en-US")} {row.positionCount === 1 ? "holding" : "holdings"}
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className={STAT_VALUE_CLASS}>{formatUsdCompact(row.totalValueUsd)}</p>
          <p className={STAT_LABEL_CLASS}>Value</p>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-medium leading-5">
            <PerfValue pct={row.bookReturnPct1y} />
          </p>
          <p className={STAT_LABEL_CLASS}>{changes ? `1Y perf. · ${changes}` : "1Y perf."}</p>
        </div>
      </div>
    </div>
  );
}

/** Featured "Most popular" funds, in carousel order. */
const MOST_POPULAR_FUND_HREFS = [
  "/superinvestors/berkshire-hathaway",
  "/superinvestors/bill-ackman",
  "/superinvestors/terry-smith",
] as const;

function FeaturedFundsCarousel({ rows }: { rows: SuperinvestorsFundRowModel[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanPrev(el.scrollLeft > 2);
      setCanNext(max > 2 && el.scrollLeft < max - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [rows.length]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: el.clientWidth * dir, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="mobile-scroll-x flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rows.map((row) => (
          <div key={row.href} className="min-w-0 shrink-0 basis-full snap-start">
            <FeaturedFundCard row={row} />
          </div>
        ))}
      </div>
      {canPrev ? (
        <CarouselArrowButton direction="prev" label="Previous fund" onClick={() => scrollByCard(-1)} />
      ) : null}
      {canNext ? <CarouselArrowButton direction="next" label="Next fund" onClick={() => scrollByCard(1)} /> : null}
    </div>
  );
}

/** Popular-portfolios layout: "Most popular" carousel + card grid. `showFeatured` is off for the Following view. */
export function SuperinvestorsFundCards({
  rows,
  showFeatured,
}: {
  rows: SuperinvestorsFundRowModel[];
  showFeatured: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("size");

  const featured = useMemo(() => {
    if (!showFeatured) return [];
    const byHref = new Map(rows.map((r) => [r.href, r]));
    return MOST_POPULAR_FUND_HREFS.flatMap((href) => byHref.get(href) ?? []);
  }, [rows, showFeatured]);
  const gridRows = useMemo(() => [...rows].sort((a, b) => compareRows(a, b, sortKey)), [rows, sortKey]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {featured.length ? <FeaturedFundsCarousel rows={featured} /> : null}
      <div className="flex items-center justify-between gap-3 pt-2">
        <h2 className={STOCK_OVERVIEW_SECTION_HEADING_CLASS}>
          {rows.length.toLocaleString("en-US")} {rows.length === 1 ? "Fund" : "Funds"}
        </h2>
        <SegmentedControl options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} size="sm" aria-label="Sort funds" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {gridRows.map((r) => (
          <FundCard key={r.href} row={r} />
        ))}
      </div>
    </div>
  );
}
